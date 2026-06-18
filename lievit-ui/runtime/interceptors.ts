/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Client interceptors (ADR-0024, #93): the *participating* request-lifecycle seam, the companion to
 * the *observing* {@link import("./lifecycle.js").LifecycleBus}. Where a lifecycle hook can only
 * watch a call's phases (and a throwing hook must never abort interactivity, ADR-0019), an
 * interceptor may **steer** the call: mutate the outgoing payload and headers, `cancel()` it,
 * and block a server-requested redirect. Livewire's loading UX, custom headers, redirect control,
 * and request concurrency all build on this chain.
 *
 * The phases fire in the pinned Livewire order around one wire call:
 *
 * ```
 *   onInit -> onSend -> onSuccess -> onSync -> onEffect -> onMorph -> onFinish -> onRender
 * ```
 *
 * with `onCancel` (when an interceptor calls `cancel()`), `onError` (a non-200 or transport
 * failure), and `onRedirect` (a server `redirect` effect, preventable) as the branch phases. The
 * runtime threads the chain through its `dispatch` loop and resolves an action's promise only AFTER
 * `onMorph`, so `$lievit.method().then()` reads the post-morph DOM (#93 acceptance).
 *
 * Strict-CSP-safe: pure data + callbacks, no `eval`, no inline script.
 */

/** The mutable request an interceptor can steer before the call leaves the browser. */
export interface InterceptorRequest {
  /** The component instance id (`cid`) this call targets. */
  readonly componentId: string;
  /** The component root in the live DOM. */
  readonly root: Element;
  /** The action names this call will invoke (empty for a pure model commit). */
  readonly calls: readonly string[];
  /** The `@Wire` field updates this call will send; an interceptor may add/replace entries. */
  readonly updates: Record<string, unknown>;
  /** Extra request headers an interceptor may set (merged onto the wire call's headers). */
  readonly headers: Record<string, string>;
  /**
   * Coarse call metadata (trigger element, poll flag), the same bag the lifecycle hooks see. It lets
   * a veto interceptor (the `intercept(fn)` form, e.g. `l:confirm`) read the trigger element to find
   * its directive. Empty for a hand-built request.
   */
  readonly meta: Readonly<Record<string, unknown>>;
  /** Aborts the call: no request is sent (or the in-flight one is dropped), `onCancel` fires. */
  readonly cancel: () => void;
}

/** The redirect-control seam: a server `redirect` effect an interceptor can block. */
export interface RedirectControl {
  /** The URL the server asked the client to navigate to. */
  readonly url: string;
  /** Call to suppress the navigation (the morph + other effects still apply). */
  readonly preventDefault: () => void;
}

/**
 * The expired-recovery seam (#103, ADR-0051): a `409`/`410` failure whose default recovery is a hard
 * re-mount (full page reload). An interceptor's `onExpired` may `preventDefault()` to suppress that
 * default and take over the recovery itself (the page-expired feature shows a confirm dialog; an app
 * may show its own UX). The `status` + `reason` let a handler tell snapshot-expired from class-gone.
 */
export interface ExpiredControl {
  /** The HTTP status of the failure (`409` snapshot-expired, `410` class gone). */
  readonly status: number;
  /** The `Lievit-Reason` header value, or `null`. */
  readonly reason: string | null;
  /** Call to suppress the default hard re-mount; the handler owns the recovery. */
  readonly preventDefault: () => void;
  /**
   * True once any (earlier-registered) handler already called `preventDefault()`. The built-in
   * page-expired feature reads this to stay silent when an app's fail hook took over the recovery.
   */
  readonly defaultPrevented: () => boolean;
}

/** The outcome an interceptor reads in the success/error/finish phases. */
export interface InterceptorOutcome {
  readonly componentId: string;
  readonly root: Element;
  /** HTTP status (200 on success, 0 on a transport error). */
  readonly status: number;
  /** True on a 200 that morphed. */
  readonly ok: boolean;
  /** The `Lievit-Reason` on a failure, else `null`. */
  readonly reason: string | null;
  /**
   * The page-level assets this update carried (the parsed `assets` key of the effects bag), or `null`
   * when the call brought none / failed (#423, ADR-0081). The asset-injection interceptor
   * (`installAssets`) reads this on the post-morph phase to apply the block once. Optional so existing
   * hand-built outcomes (tests, the synthetic redirect/expired outcome) stay terse.
   */
  readonly assets?: import("./features/assets.js").AssetsBlock | null;
  /**
   * The page CSP nonce (`RuntimeOptions.nonce`, sourced from the page bootstrap, ADR-0039/0081) to
   * stamp on assets injected by `installAssets`, or `undefined` when the page runs no nonce policy.
   */
  readonly nonce?: string;
}

/**
 * One interceptor. Every method is optional; implement only the phases a feature needs. A loading
 * indicator implements `onSend`/`onFinish`; a custom-header feature implements `onSend`; a
 * redirect-guard implements `onRedirect`; a cancel-on-supersede feature implements `onInit` +
 * `cancel`.
 */
export interface Interceptor {
  /** Fired first, synchronously, before anything else. May `cancel()` to abort early. */
  readonly onInit?: (request: InterceptorRequest) => void;
  /** Fired right before the request leaves the browser (after `onInit`). May still mutate headers. */
  readonly onSend?: (request: InterceptorRequest) => void;
  /** Fired on a 200, before sync/effect/morph. */
  readonly onSuccess?: (outcome: InterceptorOutcome) => void;
  /** Fired after the client state is synced (surgical merge applied), before effects. */
  readonly onSync?: (outcome: InterceptorOutcome) => void;
  /** Fired after non-DOM effects are applied (dispatch/url/etc.), before the morph. */
  readonly onEffect?: (outcome: InterceptorOutcome) => void;
  /** Fired after the DOM morph completes. The action promise resolves right after this phase. */
  readonly onMorph?: (outcome: InterceptorOutcome) => void;
  /** Fired last on every terminal path (success, error, or cancel): the cleanup phase. */
  readonly onFinish?: (outcome: InterceptorOutcome) => void;
  /** Fired after `onFinish` on success: the post-everything render-settled phase. */
  readonly onRender?: (outcome: InterceptorOutcome) => void;
  /** Fired when an interceptor called `cancel()`: the request was aborted. */
  readonly onCancel?: (request: InterceptorRequest) => void;
  /** Fired on a non-200 or a transport error. */
  readonly onError?: (outcome: InterceptorOutcome) => void;
  /**
   * Fired when the server returned a `redirect` effect, before the client navigates. Call
   * `control.preventDefault()` to block the navigation (the morph and other effects still apply).
   */
  readonly onRedirect?: (control: RedirectControl, outcome: InterceptorOutcome) => void;
  /**
   * Fired on a `409`/`410` failure before the default hard re-mount (#103). Call
   * `control.preventDefault()` to suppress the reload and own the recovery (the page-expired
   * feature's confirm dialog, or an app's custom UX).
   */
  readonly onExpired?: (control: ExpiredControl, outcome: InterceptorOutcome) => void;
}

/** A predicate selecting which calls an interceptor applies to (global / per-action / per-root). */
export type InterceptorScope = (request: InterceptorRequest) => boolean;

/** The global scope: every call. */
export const GLOBAL_SCOPE: InterceptorScope = () => true;

/** A per-action scope: only calls invoking the named action. */
export function actionScope(action: string): InterceptorScope {
  return (request) => request.calls.includes(action);
}

/** A per-component scope: only calls for the given component root. */
export function rootScope(root: Element): InterceptorScope {
  return (request) => request.root === root;
}

interface ScopedInterceptor {
  readonly interceptor: Interceptor;
  readonly scope: InterceptorScope;
}

/**
 * The interceptor chain the runtime owns. Features register scoped interceptors; the runtime drives
 * the phases. A {@link CancelledError} is thrown out of `init`/`send` when an interceptor cancels,
 * which the runtime catches to abort the call cleanly.
 */
export class InterceptorChain {
  private readonly entries: ScopedInterceptor[] = [];
  private readonly onChainError: (phase: string, error: unknown) => void;

  /**
   * @param onChainError reporter for an interceptor that throws in a non-control phase (defaults to
   *   `console.error`); a thrown interceptor is isolated, the call proceeds.
   */
  constructor(onChainError?: (phase: string, error: unknown) => void) {
    this.onChainError =
      onChainError ??
      ((phase, error) => console.error(`[lievit] interceptor threw in ${phase}`, error));
  }

  /**
   * Registers a scoped interceptor.
   *
   * @param interceptor the interceptor
   * @param scope which calls it applies to (defaults to {@link GLOBAL_SCOPE})
   * @returns an unsubscribe function
   */
  register(interceptor: Interceptor, scope: InterceptorScope = GLOBAL_SCOPE): () => void {
    const entry: ScopedInterceptor = { interceptor, scope };
    this.entries.push(entry);
    return () => {
      const i = this.entries.indexOf(entry);
      if (i >= 0) {
        this.entries.splice(i, 1);
      }
    };
  }

  /** The interceptors whose scope matches `request`, in registration order. */
  private matching(request: InterceptorRequest): Interceptor[] {
    return this.entries.filter((e) => e.scope(request)).map((e) => e.interceptor);
  }

  /**
   * Builds a mutable {@link InterceptorRequest} bound to a `cancel()` that flips the given flag and
   * remembers it, so the runtime can detect a cancellation after running a phase.
   */
  buildRequest(
    componentId: string,
    root: Element,
    calls: readonly string[],
    updates: Record<string, unknown>,
    meta: Readonly<Record<string, unknown>> = {},
  ): { request: InterceptorRequest; cancelled: () => boolean } {
    let cancelledFlag = false;
    const request: InterceptorRequest = {
      componentId,
      root,
      calls,
      updates,
      headers: {},
      meta,
      cancel: () => {
        cancelledFlag = true;
      },
    };
    return { request, cancelled: () => cancelledFlag };
  }

  /** Fires `onInit` then `onSend` on every matching interceptor (the pre-flight phases). */
  init(request: InterceptorRequest): void {
    this.fire("onInit", request, (i) => i.onInit?.(request));
  }

  send(request: InterceptorRequest): void {
    this.fire("onSend", request, (i) => i.onSend?.(request));
  }

  cancelled(request: InterceptorRequest): void {
    this.fire("onCancel", request, (i) => i.onCancel?.(request));
  }

  success(outcome: InterceptorOutcome): void {
    this.fire("onSuccess", outcome, (i) => i.onSuccess?.(outcome));
  }

  sync(outcome: InterceptorOutcome): void {
    this.fire("onSync", outcome, (i) => i.onSync?.(outcome));
  }

  effect(outcome: InterceptorOutcome): void {
    this.fire("onEffect", outcome, (i) => i.onEffect?.(outcome));
  }

  morphed(outcome: InterceptorOutcome): void {
    this.fire("onMorph", outcome, (i) => i.onMorph?.(outcome));
  }

  finish(outcome: InterceptorOutcome): void {
    this.fire("onFinish", outcome, (i) => i.onFinish?.(outcome));
  }

  render(outcome: InterceptorOutcome): void {
    this.fire("onRender", outcome, (i) => i.onRender?.(outcome));
  }

  errored(outcome: InterceptorOutcome): void {
    this.fire("onError", outcome, (i) => i.onError?.(outcome));
  }

  /**
   * Offers a server redirect to every matching interceptor; returns true if any interceptor blocked
   * it (called `preventDefault`), so the runtime should NOT navigate.
   *
   * @param url the redirect URL
   * @param outcome the call outcome
   * @returns true when the navigation was prevented
   */
  redirect(url: string, outcome: InterceptorOutcome): boolean {
    let prevented = false;
    const control: RedirectControl = {
      url,
      preventDefault: () => {
        prevented = true;
      },
    };
    const request = this.requestFromOutcome(outcome);
    for (const interceptor of this.matching(request)) {
      try {
        interceptor.onRedirect?.(control, outcome);
      } catch (error) {
        this.onChainError("onRedirect", error);
      }
    }
    return prevented;
  }

  /**
   * Offers a `409`/`410` expired failure to every matching interceptor; returns true if any called
   * `preventDefault()`, so the runtime should NOT hard re-mount (the handler owns the recovery, #103).
   *
   * @param outcome the failure outcome (`status` 409/410, `reason`)
   * @returns true when the default re-mount was prevented
   */
  expired(outcome: InterceptorOutcome): boolean {
    let prevented = false;
    const control: ExpiredControl = {
      status: outcome.status,
      reason: outcome.reason,
      preventDefault: () => {
        prevented = true;
      },
      defaultPrevented: () => prevented,
    };
    const request = this.requestFromOutcome(outcome);
    for (const interceptor of this.matching(request)) {
      try {
        interceptor.onExpired?.(control, outcome);
      } catch (error) {
        this.onChainError("onExpired", error);
      }
    }
    return prevented;
  }

  private requestFromOutcome(outcome: InterceptorOutcome): InterceptorRequest {
    return {
      componentId: outcome.componentId,
      root: outcome.root,
      calls: [],
      updates: {},
      headers: {},
      meta: {},
      cancel: () => {},
    };
  }

  private fire(
    phase: string,
    ctx: InterceptorRequest | InterceptorOutcome,
    invoke: (interceptor: Interceptor) => void,
  ): void {
    const request =
      "calls" in ctx ? (ctx as InterceptorRequest) : this.requestFromOutcome(ctx as InterceptorOutcome);
    for (const interceptor of this.matching(request)) {
      try {
        invoke(interceptor);
      } catch (error) {
        this.onChainError(phase, error);
      }
    }
  }
}
