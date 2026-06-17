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
  type CallContext,
  type CallMeta,
  type CallOutcome,
  type ComponentContext,
  LifecycleBus,
  type LifecycleHook,
} from "./lifecycle.js";
import { type MorphHooks, type MorphMode, morph } from "./morph.js";
import { type SendOptions, send } from "./wire.js";

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
}

/** Options for {@link LievitRuntime}: CSRF wiring, a custom fetch, an error reporter. */
export interface RuntimeOptions extends SendOptions {
  /** Reporter for a transport error or an unexpected failure (defaults to `console.error`). */
  readonly onError?: (message: string, detail: unknown) => void;
}

/**
 * An action interceptor: a feature-registered gate run BEFORE a wire call leaves the browser. It
 * lets a feature (e.g. `wire:confirm`) veto or defer a call without editing the core. Each
 * interceptor returns whether the call may proceed; returning `false` (or a promise of `false`)
 * aborts the call silently (no network, no lifecycle phases). This is the seam ADR-0019 left open
 * for `wire:confirm` ("intercepts the action, aborts on cancel").
 */
export interface ActionInterceptor {
  /**
   * @param ctx the call about to be sent (component, calls, updates, meta)
   * @returns true to proceed, false to abort the call
   */
  (ctx: CallContext): boolean | Promise<boolean>;
}

/**
 * A morph-hook provider: a feature returns the {@link MorphHooks} it wants applied to a given
 * component root's morph (or `null` to opt out). The runtime composes every provider's hooks into
 * one set per morph, so `l:ignore` (skip subtrees) and `l:transition` (defer removal) plug in
 * WITHOUT editing the morph algorithm (ADR-0019 morph seam).
 */
export interface MorphHookProvider {
  /**
   * @param root the component root being morphed
   * @returns the hooks to apply for this morph, or `null` to contribute none
   */
  (root: Element): MorphHooks | null;
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

  private readonly states = new WeakMap<Element, ComponentState>();
  private readonly options: RuntimeOptions;
  private readonly directiveRuntime: DirectiveRuntime;
  private readonly interceptors: ActionInterceptor[] = [];
  private readonly morphHookProviders: MorphHookProvider[] = [];

  /**
   * @param options CSRF token/header, an injectable fetch, and an error reporter
   */
  constructor(options: RuntimeOptions = {}) {
    this.options = options;
    this.lifecycle = new LifecycleBus();
    for (const directive of builtinDirectives()) {
      this.directives.register(directive);
    }
    this.directiveRuntime = {
      callAction: (element, action, meta) => void this.callAction(element, action, meta ?? {}),
      setModel: (element, field, value, sendNow) =>
        void this.setModel(element, field, value, sendNow),
    };
  }

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
   * Registers an {@link ActionInterceptor}: a gate run before every wire call (in registration
   * order). The first interceptor that returns `false` aborts the call. `wire:confirm` registers one
   * here so a cancel stops the action without touching the core loop.
   *
   * @param interceptor the gate to add
   * @returns an unsubscribe function
   */
  intercept(interceptor: ActionInterceptor): () => void {
    this.interceptors.push(interceptor);
    return () => {
      const i = this.interceptors.indexOf(interceptor);
      if (i >= 0) {
        this.interceptors.splice(i, 1);
      }
    };
  }

  /**
   * Registers a {@link MorphHookProvider}: every provider is asked for {@link MorphHooks} on each
   * component morph and the results are composed into one set. `l:ignore` and `l:transition`
   * register here so they shape the morph without editing it (ADR-0019 morph seam).
   *
   * @param provider the morph-hook provider to add
   * @returns an unsubscribe function
   */
  morphWith(provider: MorphHookProvider): () => void {
    this.morphHookProviders.push(provider);
    return () => {
      const i = this.morphHookProviders.indexOf(provider);
      if (i >= 0) {
        this.morphHookProviders.splice(i, 1);
      }
    };
  }

  /**
   * Issues a wire call for the component owning `element`, invoking the named action (the public
   * form of the directive seam: poll / navigate / init / confirm features call this). Drains any
   * pending deferred `l:model` updates, like a `l:click`.
   *
   * @param element any element inside the target component
   * @param action the `@LievitAction` name to invoke
   * @param meta coarse call metadata (e.g. `{ poll: true }`) made visible to lifecycle hooks
   */
  async callAction(element: Element, action: string, meta: CallMeta = {}): Promise<void> {
    const state = this.stateOf(element);
    if (state == null) {
      return;
    }
    await this.dispatch(state, [action], meta);
  }

  /**
   * Refreshes the component owning `element` with no action call (drains pending updates + re-renders
   * server-side). This is the `$refresh` / poll-tick primitive.
   *
   * @param element any element inside the target component
   * @param meta coarse call metadata (e.g. `{ poll: true }`)
   */
  async refresh(element: Element, meta: CallMeta = {}): Promise<void> {
    const state = this.stateOf(element);
    if (state == null) {
      return;
    }
    await this.dispatch(state, [], meta);
  }

  /** Re-scans a subtree for `l:*` directives (a feature that injects DOM calls this to bind it). */
  scan(root: Element): void {
    this.directives.scan(root, this.directiveRuntime);
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
      this.states.set(rootEl, {
        root: rootEl,
        componentId: rootEl.getAttribute(COMPONENT_ID_ATTR) ?? "",
        snapshot: rootEl.getAttribute(SNAPSHOT_ATTR) ?? "",
        pendingUpdates: {},
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
    this.lifecycle.modelChange(this.contextOf(state), field, value);
    if (sendNow) {
      await this.dispatch(state, []);
    }
  }

  /**
   * The core call loop: run interceptors, then send the snapshot + drained pending updates + calls;
   * on a 200 morph the DOM (through the composed morph hooks), store the rotated snapshot, and apply
   * effects; on a failure surface it fail-closed and re-mount (reload) for `409`/`410`.
   */
  private async dispatch(
    state: ComponentState,
    calls: readonly string[],
    meta: CallMeta = {},
  ): Promise<void> {
    const updates = { ...state.pendingUpdates };
    const ctx = this.contextOf(state);
    const callCtx: CallContext = { ...ctx, calls, updates, meta };

    // Interceptors (ADR-0019 seam): the first to veto aborts the call entirely (no network, no
    // lifecycle phases). `wire:confirm` registers one so a cancel stops the action here.
    for (const interceptor of [...this.interceptors]) {
      let proceed: boolean;
      try {
        proceed = await interceptor(callCtx);
      } catch (error) {
        this.reportError("action interceptor threw", error);
        proceed = true; // fail-soft: a buggy interceptor must not block interactivity.
      }
      if (!proceed) {
        return;
      }
    }

    this.lifecycle.beforeCall(callCtx);

    let response;
    try {
      response = await send(state.componentId, { snapshot: state.snapshot, updates, calls }, this.options);
    } catch (error) {
      this.reportError("wire call transport failed", error);
      this.lifecycle.error({ ...ctx, status: 0, ok: false, reason: "transport-error" });
      return;
    }

    if (!response.ok) {
      const outcome: CallOutcome = {
        ...ctx,
        status: response.status,
        ok: false,
        reason: response.reason,
      };
      this.lifecycle.error(outcome);
      if (response.remount) {
        // 409 (expired) / 410 (class gone): the snapshot no longer matches the server. The only
        // safe recovery is a fresh render of the host page (wire-protocol.md §4).
        this.remount();
      } else {
        this.reportError(`wire call failed: ${response.status} ${response.reason ?? ""}`, response);
      }
      return;
    }

    // Success: the deferred updates have been consumed by the server, clear them.
    for (const key of Object.keys(state.pendingUpdates)) {
      delete state.pendingUpdates[key];
    }

    morph(state.root, response.html, this.composedMorphHooks(state.root));
    // Stash the rotated snapshot AFTER the morph: the server's re-rendered root carries no
    // data-lievit-snapshot attribute (the snapshot rides the header, never the body), so morphing
    // first then writing the attribute keeps the live snapshot from being reconciled away.
    if (response.snapshot.length > 0) {
      state.snapshot = response.snapshot;
      state.root.setAttribute(SNAPSHOT_ATTR, response.snapshot);
    }
    // Re-scan: a morph may have introduced new `l:*` elements (idempotent on existing ones).
    this.directives.scan(state.root, this.directiveRuntime);

    this.lifecycle.afterCall({ ...ctx, status: 200, ok: true, reason: null });
    applyEffects(response.effects);
  }

  /**
   * Composes every {@link MorphHookProvider}'s hooks for `root` into one {@link MorphHooks} set: the
   * first provider that returns a mode for an element wins (`l:ignore` before a no-op), and every
   * provider's `beforeRemove` is offered the leftover node (a single claim suffices to defer
   * removal). A provider that throws is reported and skipped (fail-soft).
   */
  private composedMorphHooks(root: Element): MorphHooks {
    const hooks: MorphHooks[] = [];
    for (const provider of [...this.morphHookProviders]) {
      try {
        const h = provider(root);
        if (h != null) {
          hooks.push(h);
        }
      } catch (error) {
        this.reportError("morph-hook provider threw", error);
      }
    }
    if (hooks.length === 0) {
      return {};
    }
    return {
      elementMode: (oldEl, newEl): MorphMode | undefined => {
        for (const h of hooks) {
          const mode = h.elementMode?.(oldEl, newEl);
          if (mode != null && mode !== "morph") {
            return mode;
          }
        }
        return undefined;
      },
      beforeRemove: (node): boolean => {
        let claimed = false;
        for (const h of hooks) {
          if (h.beforeRemove?.(node) === true) {
            claimed = true;
          }
        }
        return claimed;
      },
    };
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
