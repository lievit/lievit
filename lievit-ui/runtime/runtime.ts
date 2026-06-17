/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The lievit client runtime: it binds `l:*` directives on every component on the page, turns the
 * bound DOM events into wire calls, applies the returned effects, and morphs the component's DOM
 * (wire-protocol.md §1 phases 3-4, §5, §5b). It is the orchestrator that composes the four
 * single-purpose modules — {@link DirectiveRegistry}, {@link LifecycleBus}, `wire.send`,
 * `morph` — into the running loop, and it exposes the two extension points (directives + lifecycle)
 * so later features plug in without editing this file.
 *
 * State ownership (wire-protocol.md §1): the server is the single source of truth. The runtime
 * holds, per component on the page, only the current signed snapshot and the *pending* deferred
 * `l:model` updates that have not yet ridden an action — never domain data.
 */

import { applyEffects } from "./effects.js";
import {
  DirectiveRegistry,
  type DirectiveRuntime,
  builtinDirectives,
} from "./directives.js";
import {
  type CallOutcome,
  type ComponentContext,
  LifecycleBus,
  type LifecycleHook,
} from "./lifecycle.js";
import { morph } from "./morph.js";
import { type SendOptions, send } from "./wire.js";
import {
  type Interceptor,
  type InterceptorOutcome,
  type InterceptorScope,
  InterceptorChain,
  actionScope,
} from "./interceptors.js";
import { type MergeIntent, type WireState, mergeNewSnapshot } from "./merge.js";
import { morphIslands, parseIslands } from "./islands.js";
import { JsRegistry } from "./js-registry.js";
import { RefRegistry, registerV4Directives } from "./v4-directives.js";
import { releaseMismatch } from "./release-token.js";

/** The attribute the server renders on a component root carrying its current signed snapshot. */
export const SNAPSHOT_ATTR = "data-lievit-snapshot";
/** The attribute the server renders on a component root carrying its component id (`cid`). */
export const COMPONENT_ID_ATTR = "data-lievit-id";
/** The attribute marking a component root (its value is the FQN, for diagnostics). */
export const COMPONENT_ATTR = "data-lievit-component";

/** Per-component live state the runtime owns (snapshot + pending deferred model updates). */
interface ComponentState {
  readonly root: Element;
  readonly componentId: string;
  snapshot: string;
  readonly pendingUpdates: Record<string, unknown>;
  /**
   * The ephemeral client mirror of the component's `@Wire` state (ADR-0024 #87): seeded lazily,
   * updated on every `l:model` input before any network call, so `$lievit.prop` is readable
   * immediately and the surgical merge has a baseline to reconcile against.
   */
  readonly ephemeral: WireState;
  /** The paths edited locally since the last commit (the surgical-merge pending set, #87). */
  readonly pendingPaths: Set<string>;
  /** A promise chain that serializes this component's commits (request bundling, #95). */
  inFlight: Promise<void>;
  /** True while a (non-async) call for this component is on the wire (disable-during-request, #125). */
  busy: boolean;
}

/** Options for {@link LievitRuntime}: CSRF wiring, a custom fetch, an error reporter. */
export interface RuntimeOptions extends SendOptions {
  /** Reporter for a transport error or an unexpected failure (defaults to `console.error`). */
  readonly onError?: (message: string, detail: unknown) => void;
}

/**
 * The client runtime. Construct once, call {@link start} to bind every component on the page, then
 * {@link directives} and {@link lifecycle} are the public extension points for later features.
 */
export class LievitRuntime {
  /** The directive registry (public extension point: `register` an `l:*` directive). */
  readonly directives = new DirectiveRegistry();
  /** The lifecycle hook bus (public extension point: `register` a {@link LifecycleHook}). */
  readonly lifecycle: LifecycleBus;
  /** The interceptor chain (ADR-0024 #93): the *participating* request-lifecycle seam. */
  readonly interceptors: InterceptorChain;
  /** The named-ref registry (`l:ref`, #109). */
  readonly refs = new RefRegistry();
  /** The CSP-safe `$js` handler registry (#131): register named client functions here. */
  readonly js = new JsRegistry();

  private readonly states = new WeakMap<Element, ComponentState>();
  private readonly options: RuntimeOptions;
  private readonly directiveRuntime: DirectiveRuntime;

  /**
   * @param options CSRF token/header, an injectable fetch, and an error reporter
   */
  constructor(options: RuntimeOptions = {}) {
    this.options = options;
    this.lifecycle = new LifecycleBus();
    this.interceptors = new InterceptorChain();
    for (const directive of builtinDirectives()) {
      this.directives.register(directive);
    }
    this.directiveRuntime = {
      callAction: (element, action) => void this.callAction(element, action),
      setModel: (element, field, value, sendNow) =>
        void this.setModel(element, field, value, sendNow),
    };
    // The island directive (#89) lives here (the one built-in core touch, fenced) so it can route
    // an action as island-targeted through `dispatch`; the rest of the v4 cluster is in
    // v4-directives.ts. A sibling adding directives touches that file, not this fence.
    this.directives.register(islandDirective(this));
    // The async action directive (#97): `l:click.async` races instead of queueing.
    this.directives.register(asyncActionDirective(this));
    // Register the v4 directive cluster (#75/#77/#85/#97/#101/#109/#111/#125) through the seams.
    registerV4Directives({
      registerDirective: (d) => this.directives.register(d),
      use: (hook) => this.use(hook),
      ephemeral: (element, field) => this.readEphemeral(element, field),
      inFlight: (element) => this.stateOf(element)?.busy === true,
      refs: this.refs,
      errorsFor: (root) => this.lastErrors.get(root) ?? {},
    });
  }

  /** The latest `errors` effect per component, captured pre-`afterCall` for the error directives. */
  private readonly lastErrors = new WeakMap<Element, Record<string, readonly string[]>>();

  /**
   * Convenience to register a {@link LifecycleHook} (delegates to {@link LifecycleBus.register}).
   *
   * @param hook the hook to add
   * @returns an unsubscribe function
   */
  use(hook: LifecycleHook): () => void {
    return this.lifecycle.register(hook);
  }

  /**
   * Registers a client interceptor (ADR-0024 #93). Global by default; pass a scope for per-action
   * or per-component. The interceptor may `cancel()` a call, mutate its headers, and block a
   * redirect.
   *
   * @param interceptor the interceptor
   * @param scope which calls it applies to (defaults to global)
   * @returns an unsubscribe function
   */
  intercept(interceptor: Interceptor, scope?: InterceptorScope): () => void {
    return this.interceptors.register(interceptor, scope);
  }

  /**
   * Registers a per-action interceptor: it fires only for calls invoking `action` (#93).
   *
   * @param action the action name to scope to
   * @param interceptor the interceptor
   * @returns an unsubscribe function
   */
  interceptAction(action: string, interceptor: Interceptor): () => void {
    return this.interceptors.register(interceptor, actionScope(action));
  }

  /** Reads a component's ephemeral `@Wire` value for `field` (the v4 `$lievit.prop`, #87). */
  private readEphemeral(element: Element, field: string): unknown {
    const state = this.stateOf(element);
    if (state == null) {
      return undefined;
    }
    if (field in state.ephemeral) {
      return state.ephemeral[field];
    }
    // Fall back to a pending edit not yet mirrored, else undefined.
    return state.pendingUpdates[field];
  }

  /**
   * Binds every lievit component found under `root` (defaults to `document.body`): registers its
   * snapshot, scans its subtree for `l:*` directives, and fires `onComponentInit`. Safe to call
   * again on a subtree introduced later (idempotent per element via the directive bind markers).
   *
   * @param root the subtree to scan for components (defaults to the document body)
   */
  start(root: ParentNode = document.body): void {
    for (const el of Array.from(root.querySelectorAll(`[${COMPONENT_ATTR}]`))) {
      this.bindComponent(el);
    }
  }

  /** Registers a component root and binds its directives. Idempotent. */
  private bindComponent(rootEl: Element): void {
    if (!this.states.has(rootEl)) {
      const snapshot = rootEl.getAttribute(SNAPSHOT_ATTR) ?? "";
      this.states.set(rootEl, {
        root: rootEl,
        componentId: rootEl.getAttribute(COMPONENT_ID_ATTR) ?? "",
        snapshot,
        pendingUpdates: {},
        ephemeral: decodeWire(snapshot),
        pendingPaths: new Set(),
        inFlight: Promise.resolve(),
        busy: false,
      });
    }
    this.directives.scan(rootEl, this.directiveRuntime);
    const state = this.states.get(rootEl)!;
    this.lifecycle.componentInit(this.contextOf(state));
  }

  /** Finds the component root that owns `element` (the nearest ancestor with the component attr). */
  private rootOf(element: Element): Element | null {
    return element.closest(`[${COMPONENT_ATTR}]`);
  }

  private stateOf(element: Element): ComponentState | null {
    const rootEl = this.rootOf(element);
    if (rootEl == null) {
      return null;
    }
    if (!this.states.has(rootEl)) {
      this.bindComponent(rootEl);
    }
    return this.states.get(rootEl) ?? null;
  }

  private contextOf(state: ComponentState): ComponentContext {
    return { root: state.root, componentId: state.componentId };
  }

  /** Records a deferred `l:model` update, optionally sending immediately (`.live`/`.lazy`/`.blur`). */
  private async setModel(
    element: Element,
    field: string,
    value: unknown,
    sendNow: boolean,
  ): Promise<void> {
    const state = this.stateOf(element);
    if (state == null) {
      return;
    }
    state.pendingUpdates[field] = value;
    // Update the ephemeral mirror immediately so `$lievit.prop` and l:bind/l:text read it before
    // any network call, and record the path for the surgical merge (#87).
    state.ephemeral[field] = value as never;
    state.pendingPaths.add(field);
    this.lifecycle.modelChange(this.contextOf(state), field, value);
    if (sendNow) {
      await this.enqueue(state, []);
    }
  }

  /**
   * Queues an action and issues the wire call, draining any pending deferred model updates. By
   * default the call is *bundled* into the per-component commit queue (#95): a burst of clicks
   * sends one round-trip. An async action ({@link callActionAsync}) races instead.
   */
  private async callAction(element: Element, action: string): Promise<void> {
    const state = this.stateOf(element);
    if (state == null) {
      return;
    }
    await this.enqueue(state, [action]);
  }

  /**
   * The async action path (`l:click.async`, #97): issue the call concurrently, NOT through the
   * per-component commit queue, so two `.async` actions run in parallel.
   *
   * @param element any element inside the component
   * @param action the action to invoke
   */
  async callActionAsync(element: Element, action: string): Promise<void> {
    const state = this.stateOf(element);
    if (state == null) {
      return;
    }
    await this.dispatch(state, [action]);
  }

  /**
   * Routes an action as island-targeted (`l:island`, #89): the server skips the parent render and
   * returns only the island fragment(s), morphed in place via the `islands` effect.
   *
   * @param element any element inside the component
   * @param action the action to invoke
   * @param island the island name to re-render
   */
  async callIsland(element: Element, action: string, island: string): Promise<void> {
    const state = this.stateOf(element);
    if (state == null) {
      return;
    }
    await this.dispatch(state, [action], island);
  }

  /**
   * Bundles a commit into the component's serialized in-flight chain (#95 request bundling): the
   * call waits for the previous one, so a burst of clicks/model commits collapses to one round-trip
   * worth of ordering rather than racing. Returns the promise for this commit.
   */
  private enqueue(state: ComponentState, calls: readonly string[]): Promise<void> {
    const next = state.inFlight.then(() => this.dispatch(state, calls));
    // Keep the chain alive even if a commit rejects (a failure must not freeze the queue).
    state.inFlight = next.catch(() => {});
    return next;
  }

  /**
   * The core call loop (ADR-0024): thread the interceptor chain (cancel / mutate headers / block
   * redirect, #93) around the wire call; on a 200 surgically merge the wire state (#87), morph the
   * DOM (whole component, or only the named islands if the response carried an `islands` effect,
   * #89), store the rotated snapshot, and apply effects (including the new `js` / `release` keys);
   * on a failure surface it fail-closed and re-mount for `409`/`410`.
   *
   * @param state the component's live state
   * @param calls the action names to invoke
   * @param island the island name this call targets (`l:island`), or `null` for a full call
   */
  private async dispatch(
    state: ComponentState,
    calls: readonly string[],
    island: string | null = null,
  ): Promise<void> {
    const baseWire: WireState = { ...state.ephemeral };
    const pendingPaths = Array.from(state.pendingPaths);
    const updates: Record<string, unknown> = { ...state.pendingUpdates };
    if (island != null) {
      updates._island = island;
    }
    const ctx = this.contextOf(state);

    // --- Interceptors: onInit -> onSend (the pre-flight, participating phases, #93) -------------
    const { request, cancelled } = this.interceptors.buildRequest(
      state.componentId,
      state.root,
      calls,
      updates,
    );
    this.interceptors.init(request);
    if (cancelled()) {
      this.interceptors.cancelled(request);
      return;
    }
    this.lifecycle.beforeCall({ ...ctx, calls, updates: request.updates });
    state.busy = true;
    this.interceptors.send(request);
    if (cancelled()) {
      state.busy = false;
      this.interceptors.cancelled(request);
      return;
    }

    let response;
    try {
      response = await send(
        state.componentId,
        { snapshot: state.snapshot, updates: request.updates, calls },
        { ...this.options, extraHeaders: request.headers },
      );
    } catch (error) {
      state.busy = false;
      this.reportError("wire call transport failed", error);
      const out: CallOutcome = { ...ctx, status: 0, ok: false, reason: "transport-error" };
      this.lifecycle.error(out);
      this.interceptors.errored(out);
      this.interceptors.finish(out);
      return;
    }

    if (!response.ok) {
      state.busy = false;
      const outcome: CallOutcome = {
        ...ctx,
        status: response.status,
        ok: false,
        reason: response.reason,
      };
      this.lifecycle.error(outcome);
      this.interceptors.errored(outcome);
      this.interceptors.finish(outcome);
      if (response.remount) {
        // 409 (expired) / 410 (class gone): the snapshot no longer matches the server. The only
        // safe recovery is a fresh render of the host page (wire-protocol.md §4).
        this.remount();
      } else {
        this.reportError(`wire call failed: ${response.status} ${response.reason ?? ""}`, response);
      }
      return;
    }

    const okOutcome: InterceptorOutcome = { ...ctx, status: 200, ok: true, reason: null };
    this.interceptors.success(okOutcome);

    // --- Surgical merge (#87): the server is authoritative, but a pending edit to a path the
    // server did not change survives. Rebuild the ephemeral mirror from the merged state. ---------
    const serverWire = decodeWire(response.snapshot);
    if (Object.keys(serverWire).length > 0) {
      const intent: MergeIntent = { pendingPaths };
      const merged = mergeNewSnapshot(baseWire, serverWire, intent);
      // The pending edits the server reconciled are now committed; drop them.
      for (const key of Object.keys(state.pendingUpdates)) {
        delete state.pendingUpdates[key];
      }
      state.pendingPaths.clear();
      for (const key of Object.keys(state.ephemeral)) {
        delete state.ephemeral[key];
      }
      Object.assign(state.ephemeral, merged);
    } else {
      for (const key of Object.keys(state.pendingUpdates)) {
        delete state.pendingUpdates[key];
      }
      state.pendingPaths.clear();
    }
    this.interceptors.sync(okOutcome);

    // Capture validation errors for the error directives before they fire on `afterCall` (#101).
    this.lastErrors.set(state.root, response.effects?.errors ?? {});

    // --- Apply non-DOM effects (dispatch / redirect blockable / url / js), then morph (#93 order)
    this.applyNonDomEffects(state, response.effects, okOutcome);
    this.interceptors.effect(okOutcome);

    // --- Morph: only the named islands if the call was island-targeted (#89), else the whole root.
    const islandNames = response.effects?.islands;
    if (islandNames != null && islandNames.length > 0) {
      const fragments = parseIslands(response.html).filter((f) => islandNames.includes(f.name));
      morphIslands(state.root, fragments);
    } else {
      morph(state.root, response.html);
    }
    // Stash the rotated snapshot AFTER the morph (the snapshot rides the header, not the body).
    if (response.snapshot.length > 0) {
      state.snapshot = response.snapshot;
      state.root.setAttribute(SNAPSHOT_ATTR, response.snapshot);
    }
    // Re-scan: a morph may have introduced new `l:*` elements (idempotent on existing ones).
    this.directives.scan(state.root, this.directiveRuntime);
    state.busy = false;

    this.interceptors.morphed(okOutcome);
    this.lifecycle.afterCall({ ...ctx, status: 200, ok: true, reason: null });
    this.interceptors.finish(okOutcome);
    this.interceptors.render(okOutcome);
  }

  /**
   * Applies the non-DOM effects of a successful call (ADR-0012 + ADR-0024 new keys): the dispatch
   * events + URL (via {@link applyEffects}), a redirect (blockable by an `onRedirect` interceptor),
   * the `js` named-handler calls (#131), and the `release`-token mismatch check (#105).
   */
  private applyNonDomEffects(
    state: ComponentState,
    effects: import("./effects.js").Effects | null,
    outcome: InterceptorOutcome,
  ): void {
    if (effects == null) {
      return;
    }
    // A redirect is offered to interceptors first; a blocked one is suppressed.
    let navigate: ((url: string) => void) | undefined;
    if (effects.redirect != null && this.interceptors.redirect(effects.redirect, outcome)) {
      navigate = () => {}; // prevented: do not navigate
    }
    // dispatch + url ride applyEffects; redirect navigation honors the interceptor decision.
    applyEffects(
      { redirect: effects.redirect, dispatch: effects.dispatch, returns: effects.returns },
      window,
      navigate ?? ((url) => window.location.assign(url)),
    );
    // CSP-safe $js: invoke each named handler from the registry (never an eval, #131).
    if (effects.js != null) {
      this.js.applyEffect(effects.js, { root: state.root });
    }
    // Release-token mismatch (#105): a deploy moved on; the next stale-snapshot failure is expected.
    if (releaseMismatch(effects.release)) {
      this.reportError(
        "release mismatch: a deploy moved on; a re-mount is expected on the next call",
        effects.release,
      );
    }
  }

  /** Re-mount path for a stale snapshot (`409`/`410`): reload the host page. Overridable in tests. */
  protected remount(): void {
    window.location.reload();
  }

  private reportError(message: string, detail: unknown): void {
    (this.options.onError ?? ((m, d) => console.error(`[lievit] ${m}`, d)))(message, detail);
  }
}

/**
 * Convenience entry point: construct a {@link LievitRuntime}, start it on the document, and return
 * it so the page can register features. This is what an app's `main.ts` calls.
 *
 * @param options runtime options (CSRF, fetch, error reporter)
 * @returns the started runtime (its `directives` / `lifecycle` are the extension points)
 */
export function startLievit(options: RuntimeOptions = {}): LievitRuntime {
  const runtime = new LievitRuntime(options);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => runtime.start(), { once: true });
  } else {
    runtime.start();
  }
  return runtime;
}

/**
 * `l:island="action"` (with the island name in `l:island.<name>` or a sibling `data-lievit-island`
 * attribute): routes the action as island-targeted, so only the named island re-renders (#89). The
 * island name is the value of a `data-lievit-island` attribute on the same element (set by the
 * server when it compiles the island button), falling back to the first directive modifier.
 */
function islandDirective(runtime: LievitRuntime) {
  return {
    name: "island",
    bind(element: Element, attribute: string, action: string) {
      const marker = `data-lievit-bound-${attribute.replace(/[^a-z]/gi, "-")}`;
      if (element.hasAttribute(marker)) {
        return;
      }
      element.setAttribute(marker, "");
      const name =
        element.getAttribute("data-lievit-island") ?? attribute.split(".").slice(1).join(".");
      element.addEventListener("click", () => void runtime.callIsland(element, action, name));
    },
  };
}

/**
 * `l:click.async="action"`: invoke an action concurrently, NOT through the per-component commit
 * queue (#97), so two `.async` actions run in parallel. A `l:click` without `.async` is the default
 * queued path (the built-in `click` directive).
 */
function asyncActionDirective(runtime: LievitRuntime) {
  return {
    name: "async",
    bind(element: Element, attribute: string, action: string) {
      const marker = `data-lievit-bound-${attribute.replace(/[^a-z]/gi, "-")}`;
      if (element.hasAttribute(marker)) {
        return;
      }
      element.setAttribute(marker, "");
      element.addEventListener("click", () => void runtime.callActionAsync(element, action));
    },
  };
}

/**
 * Decodes a signed snapshot's `wire` payload (the JWT-like middle segment, base64url JSON) into the
 * client's ephemeral wire mirror (ADR-0024 #87). Returns an empty object for an empty/malformed
 * token: the snapshot is signed (the client cannot forge it), so reading the *payload* client-side
 * is safe (the payload is readable by design, wire-protocol.md §3); the client never trusts it for
 * authorization, only mirrors it for ephemeral reads.
 */
function decodeWire(snapshot: string): WireState {
  if (snapshot.length === 0) {
    return {};
  }
  const parts = snapshot.split(".");
  if (parts.length < 2) {
    return {};
  }
  try {
    const json = base64UrlDecode(parts[1]!);
    const payload = JSON.parse(json) as { wire?: WireState };
    return payload.wire ?? {};
  } catch {
    return {};
  }
}

/** Decodes a base64url string to UTF-8 text (CSP-safe, uses `atob`, no eval). */
function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
