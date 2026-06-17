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
      callAction: (element, action) => void this.callAction(element, action),
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

  /** Queues an action and issues the wire call, draining any pending deferred model updates. */
  private async callAction(element: Element, action: string): Promise<void> {
    const state = this.stateOf(element);
    if (state == null) {
      return;
    }
    await this.dispatch(state, [action]);
  }

  /**
   * The core call loop: send the snapshot + drained pending updates + calls, then on a 200 morph
   * the DOM, store the rotated snapshot, and apply effects; on a failure surface it fail-closed and
   * re-mount (reload) for `409`/`410`.
   */
  private async dispatch(state: ComponentState, calls: readonly string[]): Promise<void> {
    const updates = { ...state.pendingUpdates };
    const ctx = this.contextOf(state);
    this.lifecycle.beforeCall({ ...ctx, calls, updates });

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

    morph(state.root, response.html);
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
