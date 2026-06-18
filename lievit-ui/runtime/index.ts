/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The public surface of the lievit client runtime. An app's `main.ts` imports {@link startLievit}
 * (or constructs {@link LievitRuntime} directly) and registers features against the two extension
 * points it exposes:
 *
 * - **`runtime.directives.register({ name, bind })`** — add an `l:*` directive (e.g. `l:navigate`,
 *   `l:poll`, `l:ignore`) without editing the core bundle (see {@link Directive}).
 * - **`runtime.use(hook)` / `runtime.lifecycle.register(hook)`** — observe a call's phases
 *   (`beforeCall` / `afterCall` / `onError` / `onModelChange` / `onComponentInit`) to drive loading
 *   indicators, dirty tracking, navigation, etc. (see {@link LifecycleHook}).
 *
 * Strict-CSP-safe (no `eval`, no inline handlers, an external module file), zero framework deps.
 */

export {
  startLievit,
  LievitRuntime,
  type RuntimeOptions,
  type ActionInterceptor,
  type MorphHookProvider,
} from "./runtime.js";
export { SNAPSHOT_ATTR, COMPONENT_ID_ATTR, COMPONENT_ATTR } from "./runtime.js";

export {
  DirectiveRegistry,
  type Directive,
  type DirectiveRuntime,
  type CallMetaInit,
  builtinDirectives,
  parseDirective,
  DIRECTIVE_PREFIX,
} from "./directives.js";

export {
  ControlRegistry,
  defaultReadControlValue,
  defaultWriteControlValue,
  type ControlAdapter,
} from "./controls.js";

export {
  LifecycleBus,
  type LifecycleHook,
  type ComponentContext,
  type CallContext,
  type CallMeta,
  type CallOutcome,
} from "./lifecycle.js";

export {
  send,
  wireEndpoint,
  type WireCall,
  type InboundWireEvent,
  type WireResponse,
  type WireFailure,
  type SendOptions,
  HEADER_SNAPSHOT,
  HEADER_EFFECTS,
  HEADER_REASON,
} from "./wire.js";

export {
  ComponentRegistry,
  ClientEventBus,
  routeDispatchedEvents,
  COMPONENT_NAME_ATTR,
  type ClientEventListener,
  type EventRoute,
} from "./events.js";

export {
  lievitObject,
  type LievitObject,
  type LievitObjectDeps,
  type WatchListener,
} from "./lievit-object.js";

export {
  parseExpression,
  evaluateExpression,
  evaluate,
  truthy,
  ExpressionError,
  type ParsedExpression,
  type ExprScope,
} from "./expression.js";

export { morph, type MorphHooks, type MorphMode } from "./morph.js";

export {
  applyEffects,
  applyUrlEffect,
  parseEffects,
  consumeEffectsHeader,
  URL_EFFECT_EVENT,
  VALIDATION_EFFECT_EVENT,
  type Effects,
  type DispatchedEvent,
  type UrlEffect,
  type JsEffectCall,
  type TransitionEffect,
} from "./effects.js";

export {
  installAllFeatures,
  installConfirm,
  installShow,
  installIgnore,
  installInit,
  installLoading,
  installDirty,
  installPoll,
  installTransition,
  installLazy,
  installNavigate,
  installPreserveScroll,
  installCurrent,
  isCurrentPath,
  installScopedCss,
  scopeCss,
  scopeId,
  installPagination,
  installUploads,
  parseShowExpression,
  evaluateShowExpression,
  parseStreamEnvelope,
  applyStreamEnvelope,
  consumeStream,
  openStream,
  openStreamCall,
  parseSseFrames,
  pollIntervalMs,
  installBroadcast,
  openBroadcastSource,
  parseBroadcastEvent,
  DEFAULT_BROADCAST_URL,
} from "./features/index.js";

export type { BroadcastSource, BroadcastOptions } from "./features/broadcast.js";

// --- Livewire v4 convergence surface (ADR-0024) ---------------------------------------------- //

export {
  InterceptorChain,
  type Interceptor,
  type InterceptorRequest,
  type InterceptorOutcome,
  type InterceptorScope,
  type RedirectControl,
  GLOBAL_SCOPE,
  actionScope,
  rootScope,
} from "./interceptors.js";

export {
  mergeNewSnapshot,
  readPath,
  writePath,
  removeIndices,
  deepEqual,
  type WireState,
  type WireValue,
  type MergeIntent,
} from "./merge.js";

export {
  parseIslands,
  morphIslands,
  islandOpenMarker,
  islandCloseMarker,
  type IslandFragment,
  type IslandMode,
} from "./islands.js";

export { JsRegistry, type JsHandler, type JsContext } from "./js-registry.js";

export {
  registerV4Directives,
  RefRegistry,
  DirtyTracker,
  ErrorsStore,
  type V4Deps,
} from "./v4-directives.js";

export {
  clientRelease,
  releaseMismatch,
  disableBfcache,
  RELEASE_ATTR,
} from "./release-token.js";
