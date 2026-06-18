/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The lifecycle hook bus: the public extension point that lets later client features (loading /
 * dirty indicators, `wire:navigate`, polling, `wire:ignore`) observe a wire call's phases WITHOUT
 * editing the core bundle. A feature registers a {@link LifecycleHook}; the runtime fires each
 * phase around every call. Hooks are additive and isolated: a throwing hook is caught and logged,
 * never aborting the call (a buggy indicator must not break interactivity).
 *
 * This is the receiving half that ADR-0012's "listener registration is a separate decision" left
 * open on the client side: features subscribe here rather than monkey-patching the runtime.
 */

/** The component context passed to every lifecycle hook. */
export interface ComponentContext {
  /** The component root element in the live DOM. */
  readonly root: Element;
  /** The component instance id (the `cid`, the endpoint path segment). */
  readonly componentId: string;
}

/**
 * Coarse, feature-set metadata about a wire call, so hooks can scope their behavior (e.g. a loading
 * indicator must NOT stamp `data-loading` for a poll; a navigate call should not show loading). Keys
 * are open: a feature reads the ones it cares about and ignores the rest.
 */
export interface CallMeta {
  /** True when the call originates from a poll tick (loading features skip it). */
  readonly poll?: boolean;
  /** The DOM element that triggered the call (the clicked button, the submitted form), if any. */
  readonly trigger?: Element;
  /** Open for features to stamp their own keys without a core edit. */
  readonly [key: string]: unknown;
}

/** A wire call about to be sent (the request side of the lifecycle). */
export interface CallContext extends ComponentContext {
  /** The action names this call will invoke. */
  readonly calls: readonly string[];
  /** The field updates this call will send. */
  readonly updates: Readonly<Record<string, unknown>>;
  /**
   * Coarse metadata about the call (poll flag, trigger element). The runtime always supplies it
   * (empty for a plain call); optional in the type so hand-built contexts in tests stay terse.
   */
  readonly meta?: CallMeta;
}

/** The outcome handed to {@link LifecycleHook.afterCall} / {@link LifecycleHook.onError}. */
export interface CallOutcome extends ComponentContext {
  /** HTTP status of the response (200 on success). */
  readonly status: number;
  /** True when the call succeeded (a 200 that morphed). */
  readonly ok: boolean;
  /** The `Lievit-Reason` on a failure, else `null`. */
  readonly reason: string | null;
}

/**
 * A lifecycle hook. Every method is optional: implement only the phases a feature cares about. The
 * runtime fires them in registration order. A loading indicator implements `beforeCall`/`afterCall`;
 * a dirty tracker implements `onModelChange`; a navigate feature implements `afterCall`.
 */
export interface LifecycleHook {
  /** Fired once when the runtime binds a component root (initial scan or after a morph adds one). */
  readonly onComponentInit?: (ctx: ComponentContext) => void;
  /** Fired when an `l:model` field's value changes client-side (before any network call). */
  readonly onModelChange?: (
    ctx: ComponentContext,
    field: string,
    value: unknown,
  ) => void;
  /** Fired immediately before a wire call leaves the browser. */
  readonly beforeCall?: (ctx: CallContext) => void;
  /** Fired after a successful (200) call, before the effects are applied. */
  readonly afterCall?: (outcome: CallOutcome) => void;
  /** Fired after a failed call (any non-200, or a transport error with status 0). */
  readonly onError?: (outcome: CallOutcome) => void;
}

/**
 * A registry of lifecycle hooks. The runtime owns one instance; features register against it. Fan-out
 * is fail-soft: a hook that throws is reported via `onHookError` (default: `console.error`) and the
 * remaining hooks still run.
 */
export class LifecycleBus {
  private readonly hooks: LifecycleHook[] = [];
  private readonly onHookError: (phase: string, error: unknown) => void;

  /**
   * @param onHookError reporter for a hook that throws (defaults to `console.error`); injectable for
   *   tests so a thrown hook can be asserted without a real console.
   */
  constructor(onHookError?: (phase: string, error: unknown) => void) {
    this.onHookError =
      onHookError ??
      ((phase, error) => console.error(`[lievit] lifecycle hook threw in ${phase}`, error));
  }

  /**
   * Registers a hook. Returns an unsubscribe function so a feature can detach (e.g. on teardown).
   *
   * @param hook the hook to add
   * @returns a function that removes the hook when called
   */
  register(hook: LifecycleHook): () => void {
    this.hooks.push(hook);
    return () => {
      const i = this.hooks.indexOf(hook);
      if (i >= 0) {
        this.hooks.splice(i, 1);
      }
    };
  }

  /** Fires `onComponentInit` on every hook (fail-soft). */
  componentInit(ctx: ComponentContext): void {
    this.each("onComponentInit", (h) => h.onComponentInit?.(ctx));
  }

  /** Fires `onModelChange` on every hook (fail-soft). */
  modelChange(ctx: ComponentContext, field: string, value: unknown): void {
    this.each("onModelChange", (h) => h.onModelChange?.(ctx, field, value));
  }

  /** Fires `beforeCall` on every hook (fail-soft). */
  beforeCall(ctx: CallContext): void {
    this.each("beforeCall", (h) => h.beforeCall?.(ctx));
  }

  /** Fires `afterCall` on every hook (fail-soft). */
  afterCall(outcome: CallOutcome): void {
    this.each("afterCall", (h) => h.afterCall?.(outcome));
  }

  /** Fires `onError` on every hook (fail-soft). */
  error(outcome: CallOutcome): void {
    this.each("onError", (h) => h.onError?.(outcome));
  }

  private each(phase: string, fire: (hook: LifecycleHook) => void): void {
    for (const hook of this.hooks) {
      try {
        fire(hook);
      } catch (error) {
        this.onHookError(phase, error);
      }
    }
  }
}
