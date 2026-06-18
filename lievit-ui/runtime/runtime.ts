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
import {
  type Interceptor,
  type InterceptorOutcome,
  type InterceptorRequest,
  type InterceptorScope,
  InterceptorChain,
  actionScope,
} from "./interceptors.js";
import { type MergeIntent, type WireState, mergeNewSnapshot } from "./merge.js";
import { morphIslands, parseIslands } from "./islands.js";
import { JsRegistry } from "./js-registry.js";
import { RefRegistry, registerV4Directives } from "./v4-directives.js";
import { releaseMismatch } from "./release-token.js";
import {
  ClientEventBus,
  type ClientEventListener,
  ComponentRegistry,
  routeDispatchedEvents,
} from "./events.js";
import {
  type LievitObject,
  type WatchListener,
  lievitObject,
} from "./lievit-object.js";

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
  /** The interceptor chain (ADR-0024 #93): the *participating* request-lifecycle seam. */
  readonly interceptors: InterceptorChain;
  /** The named-ref registry (`l:ref`, #109). */
  readonly refs = new RefRegistry();
  /** The CSP-safe `$js` handler registry (#131): register named client functions here. */
  readonly js = new JsRegistry();
  /** The mounted-component registry (#43): resolves `dispatchTo` / global event fan-out to roots. */
  readonly components = new ComponentRegistry();
  /** The JS-side event listener bus (#43): `runtime.on(name, fn)` reacts to server events. */
  readonly events = new ClientEventBus();

  /** `$watch` listeners per component root, keyed by field (the `$lievit.$watch` backing, ADR-0030). */
  private readonly watchers = new WeakMap<Element, Map<string, Set<WatchListener>>>();

  private readonly states = new WeakMap<Element, ComponentState>();
  private readonly options: RuntimeOptions;
  private readonly directiveRuntime: DirectiveRuntime;
  private readonly morphHookProviders: MorphHookProvider[] = [];
  /** Async veto decisions in flight for a given pre-flight request (the `intercept(fn)` form). */
  private readonly vetoPending = new WeakMap<InterceptorRequest, Promise<void>[]>();

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
      callAction: (element, action, meta) => void this.callAction(element, action, meta ?? {}),
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

  /** The latest `transition` effect per component (#113), read by the transition feature per morph. */
  private readonly lastTransition = new WeakMap<
    Element,
    import("./effects.js").TransitionEffect | null
  >();

  /**
   * Reads the server transition effect (`@LievitTransition`, #113) for a component root's current
   * update, or `null` when the last call carried none (the static `l:transition` markup decides).
   * The transition feature reads this across the morph rather than a DOM attribute the morph would
   * reconcile away.
   *
   * @param root the component root
   * @returns the transition effect for this update, or `null`
   */
  transitionFor(root: Element): import("./effects.js").TransitionEffect | null {
    return this.lastTransition.get(root) ?? null;
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
   * Registers a JS listener for a server-dispatched event (the client half of the event system, #43,
   * the `$lievit.$on` / Livewire `Livewire.on` analogue). The listener fires whenever an action
   * dispatches an event of `name`, regardless of routing target, so page code reacts without a DOM
   * `addEventListener`. Component-to-component delivery (the server `@LievitOn` re-run) is automatic
   * and separate; this is for app-level JS only.
   *
   * @param name the event name
   * @param listener the callback (receives the event detail, or `null` for a bare signal)
   * @returns an unsubscribe function
   */
  on(name: string, listener: ClientEventListener): () => void {
    return this.events.on(name, listener);
  }

  /**
   * Returns the `$lievit` component object for the component owning `element` (Livewire's `$wire`,
   * ADR-0030 magic actions, the client half): `$get` / `$set` / `$call` / `$refresh` / `$watch` /
   * `$parent`. A page's JS (or a Lit island) uses it to drive the component without touching the
   * runtime internals. Returns `null` when `element` is not inside a mounted component.
   *
   * `$set` rides the same model-update path a `l:model` edit takes (the server settable allowlist
   * applies); `$call` invokes a bare `@LievitAction` by name (inline args to a regular action are a
   * server-side parity gap, so args are not forwarded — only magic actions parse inline args today).
   *
   * @param element any element inside the target component
   * @returns the component's `$lievit` object, or `null` if `element` is outside any component
   */
  $lievit(element: Element): LievitObject | null {
    const root = this.rootOf(element);
    if (root == null) {
      return null;
    }
    return lievitObject(root, {
      get: (el, field) => this.readEphemeral(el, field),
      set: (el, field, value) => void this.setModel(el, field, value, true),
      // Args to a regular action are not forwarded (server parses inline args for magic actions
      // only); the bare name preserves the wire's authorization allowlist (ADR-0013).
      call: (el, action) => void this.callAction(el, action),
      refresh: (el) => void this.refresh(el),
      parent: (childRoot) => this.parentObjectOf(childRoot),
      watch: (watchRoot, field, listener) => this.addWatcher(watchRoot, field, listener),
    });
  }

  /** Resolves the `$lievit` object of the component ENCLOSING `childRoot`, or null at the top. */
  private parentObjectOf(childRoot: Element): LievitObject | null {
    const parent = childRoot.parentElement?.closest(`[${COMPONENT_ATTR}]`) ?? null;
    return parent == null ? null : this.$lievit(parent);
  }

  /** Registers a `$watch` listener for a field on a component root; returns an unsubscribe. */
  private addWatcher(root: Element, field: string, listener: WatchListener): () => void {
    let byField = this.watchers.get(root);
    if (byField == null) {
      byField = new Map();
      this.watchers.set(root, byField);
    }
    let set = byField.get(field);
    if (set == null) {
      set = new Set();
      byField.set(field, set);
    }
    set.add(listener);
    return () => {
      this.watchers.get(root)?.get(field)?.delete(listener);
    };
  }

  /** Fires the `$watch` listeners for a field's new value on a component root (fail-soft). */
  private fireWatchers(root: Element, field: string, value: unknown): void {
    for (const listener of this.watchers.get(root)?.get(field) ?? []) {
      try {
        listener(value, field);
      } catch (error) {
        this.reportError("$watch listener threw", error);
      }
    }
  }

  /**
   * Registers an interceptor. Two forms unify onto the single {@link InterceptorChain} (#93):
   *
   * - **Veto form** `intercept(fn)` (ADR-0019): a function run pre-flight that returns `false` (or a
   *   promise of `false`) to abort the call entirely (no network, no lifecycle phases). It reads the
   *   call's {@link CallContext} (incl. `meta.trigger`); `l:confirm` registers one so a cancel stops
   *   the action without touching the core loop. Implemented as an interceptor whose `onInit` runs
   *   the gate and `cancel()`s on a falsy result (async gates resolve before `onSend`).
   * - **Chain form** `intercept(obj, scope?)` (ADR-0024): a full {@link Interceptor} with phase
   *   callbacks that may `cancel()`, mutate headers/updates, and block a redirect; global by default,
   *   pass a {@link InterceptorScope} for per-action / per-component.
   *
   * @param interceptor the veto function OR the phase interceptor
   * @param scope which calls a chain interceptor applies to (ignored for the veto form)
   * @returns an unsubscribe function
   */
  intercept(
    interceptor: ActionInterceptor | Interceptor,
    scope?: InterceptorScope,
  ): () => void {
    if (typeof interceptor === "function") {
      return this.interceptors.register(this.vetoInterceptor(interceptor));
    }
    return this.interceptors.register(interceptor, scope);
  }

  /**
   * Adapts a veto {@link ActionInterceptor} (the `intercept(fn)` form) onto the unified chain: its
   * `onInit` builds the {@link CallContext} from the pre-flight request and runs the gate; a falsy
   * result (or an awaited falsy promise) `cancel()`s the request. A sync gate cancels synchronously
   * (observed right after `onInit`); an async gate records its promise in {@link vetoPending} so
   * `dispatch` awaits the decision before sending. A throwing gate is reported and fails soft (the
   * call proceeds), matching ADR-0019's "a buggy interceptor must not block interactivity".
   */
  private vetoInterceptor(gate: ActionInterceptor): Interceptor {
    return {
      onInit: (request) => {
        const ctx: CallContext = {
          root: request.root,
          componentId: request.componentId,
          calls: request.calls,
          updates: request.updates,
          meta: request.meta as CallMeta,
        };
        let result: boolean | Promise<boolean>;
        try {
          result = gate(ctx);
        } catch (error) {
          this.reportError("action interceptor threw", error);
          return; // fail-soft: proceed.
        }
        if (typeof result === "boolean") {
          if (!result) {
            request.cancel();
          }
          return;
        }
        // Async gate: record the decision so dispatch awaits it before `onSend`.
        const pending = result
          .then((proceed) => {
            if (!proceed) {
              request.cancel();
            }
          })
          .catch((error) => {
            this.reportError("action interceptor threw", error); // fail-soft: proceed.
          });
        const list = this.vetoPending.get(request) ?? [];
        list.push(pending);
        this.vetoPending.set(request, list);
      },
    };
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
   * form of the directive seam: poll / navigate / init / confirm features call this). Bundles into
   * the per-component commit queue (#95) and drains any pending deferred `l:model` updates.
   *
   * @param element any element inside the target component
   * @param action the `@LievitAction` name to invoke
   * @param meta coarse call metadata (e.g. `{ poll: true }`, the trigger element) for hooks/interceptors
   */
  async callAction(element: Element, action: string, meta: CallMeta = {}): Promise<void> {
    const state = this.stateOf(element);
    if (state == null) {
      return;
    }
    await this.enqueue(state, [action], meta);
  }

  /**
   * The async action path (`l:click.async`, #97): issue the call concurrently, NOT through the
   * per-component commit queue, so two `.async` actions run in parallel.
   *
   * @param element any element inside the component
   * @param action the action to invoke
   * @param meta coarse call metadata
   */
  async callActionAsync(element: Element, action: string, meta: CallMeta = {}): Promise<void> {
    const state = this.stateOf(element);
    if (state == null) {
      return;
    }
    await this.dispatch(state, [action], meta);
  }

  /**
   * Routes an action as island-targeted (`l:island`, #89): the server skips the parent render and
   * returns only the island fragment(s), morphed in place via the `islands` effect.
   *
   * @param element any element inside the component
   * @param action the action to invoke
   * @param island the island name to re-render
   * @param meta coarse call metadata
   */
  async callIsland(
    element: Element,
    action: string,
    island: string,
    meta: CallMeta = {},
  ): Promise<void> {
    const state = this.stateOf(element);
    if (state == null) {
      return;
    }
    await this.dispatch(state, [action], meta, island);
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
    await this.enqueue(state, [], meta);
  }

  /** Re-scans a subtree for `l:*` directives (a feature that injects DOM calls this to bind it). */
  scan(root: Element): void {
    this.directives.scan(root, this.directiveRuntime);
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
    // Register the root in the component registry so dispatched events can be routed to it (#43).
    this.components.register(rootEl);
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
    this.fireWatchers(state.root, field, value);
    if (sendNow) {
      await this.enqueue(state, []);
    }
  }

  /**
   * Bundles a commit into the component's serialized in-flight chain (#95 request bundling): the
   * call waits for the previous one, so a burst of clicks/model commits collapses to one round-trip
   * worth of ordering rather than racing. Returns the promise for this commit.
   */
  private enqueue(
    state: ComponentState,
    calls: readonly string[],
    meta: CallMeta = {},
    events: readonly import("./wire.js").InboundWireEvent[] = [],
  ): Promise<void> {
    const next = state.inFlight.then(() => this.dispatch(state, calls, meta, null, events));
    // Keep the chain alive even if a commit rejects (a failure must not freeze the queue).
    state.inFlight = next.catch(() => {});
    return next;
  }

  /**
   * Delivers one inbound event to a target component (#43, ADR-0030): enqueues a wire call on the
   * target's own commit chain carrying the event as `_events` and no actions, so the server re-runs
   * the matching `@LievitOn` listeners and re-renders. A target with no live state is skipped (it left
   * the DOM between the dispatch and the delivery).
   *
   * @param targetRoot the component root that must receive the event
   * @param event the dispatched event to deliver (name + detail)
   */
  private deliverInboundEvent(
    targetRoot: Element,
    event: import("./effects.js").DispatchedEvent,
  ): void {
    const target = this.states.get(targetRoot);
    if (target == null) {
      return;
    }
    void this.enqueue(target, [], {}, [{ name: event.name, detail: event.detail ?? null }]);
  }

  /**
   * The core call loop (ADR-0019 + ADR-0024, unified): thread the single interceptor chain around
   * the wire call. The veto form (`intercept(fn)`, e.g. `l:confirm`) rides the chain's `onInit` and
   * aborts via `cancel()` before any network or `beforeCall`; the chain form participates through
   * `onInit -> onSend -> onSuccess -> onSync -> onEffect -> onMorph -> onFinish -> onRender`
   * (cancel / mutate headers / block redirect, #93). On a 200 we surgically merge the wire state
   * (#87), morph the DOM (whole component, or only the named islands if the response carried an
   * `islands` effect, #89, through the composed morph hooks for `l:ignore` / `l:transition`), store
   * the rotated snapshot, and apply effects (`url` / `errors` / `dispatch` / `redirect` / the v4 `js`
   * / `release` keys); on a failure surface it fail-closed and re-mount for `409`/`410`.
   *
   * @param state the component's live state
   * @param calls the action names to invoke
   * @param meta coarse call metadata (trigger element, poll flag) for hooks + veto interceptors
   * @param island the island name this call targets (`l:island`), or `null` for a full call
   */
  private async dispatch(
    state: ComponentState,
    calls: readonly string[],
    meta: CallMeta = {},
    island: string | null = null,
    inboundEvents: readonly import("./wire.js").InboundWireEvent[] = [],
  ): Promise<void> {
    const baseWire: WireState = { ...state.ephemeral };
    const pendingPaths = Array.from(state.pendingPaths);
    const updates: Record<string, unknown> = { ...state.pendingUpdates };
    if (island != null) {
      updates._island = island;
    }
    const ctx = this.contextOf(state);

    // --- Interceptors: onInit -> onSend (the pre-flight, participating phases, #93). A veto
    // interceptor (the `intercept(fn)` form) runs in `onInit` and `cancel()`s on a falsy gate;
    // an async gate is awaited here before `onSend`, so a cancel stops the call with no network
    // and no `beforeCall` (ADR-0019). The request carries `meta` so the veto can read its trigger.
    const { request, cancelled } = this.interceptors.buildRequest(
      state.componentId,
      state.root,
      calls,
      updates,
      meta,
    );
    this.interceptors.init(request);
    // A veto interceptor with an async gate records its pending decision here; await them all so an
    // async cancel is observed before we send (a sync gate already flipped `cancelled()`).
    const pendingVetoes = this.vetoPending.get(request);
    if (pendingVetoes != null && pendingVetoes.length > 0) {
      await Promise.all(pendingVetoes);
      this.vetoPending.delete(request);
    }
    if (cancelled()) {
      this.interceptors.cancelled(request);
      return;
    }
    this.lifecycle.beforeCall({ ...ctx, calls, updates: request.updates, meta });
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
        { snapshot: state.snapshot, updates: request.updates, calls, events: inboundEvents },
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
      // Fire `$watch` listeners for any field the server changed (ADR-0030): a watch reacts to a
      // server-pushed value, not only a local `l:model` edit.
      for (const [field, value] of Object.entries(merged)) {
        if (!Object.is(baseWire[field], value)) {
          this.fireWatchers(state.root, field, value);
        }
      }
    } else {
      for (const key of Object.keys(state.pendingUpdates)) {
        delete state.pendingUpdates[key];
      }
      state.pendingPaths.clear();
    }
    this.interceptors.sync(okOutcome);

    // Capture validation errors for the error directives before they fire on `afterCall` (#101).
    this.lastErrors.set(state.root, response.effects?.errors ?? {});
    // Record the server transition control (#113, @LievitTransition) for THIS update so the
    // transition feature reads it across the morph; a no-transition call clears it (the static
    // `l:transition` markup then decides). A DOM stamp would be reconciled away by the morph.
    this.lastTransition.set(state.root, response.effects?.transition ?? null);

    // --- Apply non-DOM effects (dispatch / redirect blockable / url / js), then morph (#93 order)
    this.applyNonDomEffects(state, response.effects, okOutcome);
    this.interceptors.effect(okOutcome);

    // --- Morph: only the named islands if the call was island-targeted (#89), else the whole root.
    const islandNames = response.effects?.islands;
    if (islandNames != null && islandNames.length > 0) {
      const fragments = parseIslands(response.html).filter((f) => islandNames.includes(f.name));
      morphIslands(state.root, fragments);
    } else {
      // Whole-component morph through the composed morph hooks so `l:ignore` (skip subtrees) and
      // `l:transition` (defer removal) shape it without editing the morph algorithm (ADR-0019).
      morph(state.root, response.html, this.composedMorphHooks(state.root));
    }
    // Stash the rotated snapshot AFTER the morph: the server's re-rendered root carries no
    // data-lievit-snapshot attribute (the snapshot rides the header, not the body), so morphing
    // first then writing the attribute keeps the live snapshot from being reconciled away.
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
    // url + errors + redirect ride applyEffects (address-bar write + the `lievit:url` /
    // `lievit:validation-errors` DOM events, wire-protocol.md §5b / ADR-0012); redirect navigation
    // honors the interceptor decision. `dispatch` is routed separately (below) so the per-event
    // `self` / `to` targeting (#43) reaches other mounted components, not just `window`.
    applyEffects(
      {
        redirect: effects.redirect,
        returns: effects.returns,
        url: effects.url,
        errors: effects.errors,
      },
      window,
      navigate ?? ((url) => window.location.assign(url)),
    );
    // dispatch routing (#43, ADR-0030): re-emit on window + the JS bus AND deliver each event to the
    // component roots its target resolves to (their server `@LievitOn` listeners re-run via `_events`).
    const routes = routeDispatchedEvents(
      effects.dispatch,
      state.root,
      this.components,
      this.events,
    );
    for (const route of routes) {
      for (const target of route.targets) {
        this.deliverInboundEvent(target, route.event);
      }
    }
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
