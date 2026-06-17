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

export { startLievit, LievitRuntime, type RuntimeOptions } from "./runtime.js";
export { SNAPSHOT_ATTR, COMPONENT_ID_ATTR, COMPONENT_ATTR } from "./runtime.js";

export {
  DirectiveRegistry,
  type Directive,
  type DirectiveRuntime,
  builtinDirectives,
  parseDirective,
  DIRECTIVE_PREFIX,
} from "./directives.js";

export {
  LifecycleBus,
  type LifecycleHook,
  type ComponentContext,
  type CallContext,
  type CallOutcome,
} from "./lifecycle.js";

export {
  send,
  wireEndpoint,
  type WireCall,
  type WireResponse,
  type WireFailure,
  type SendOptions,
  HEADER_SNAPSHOT,
  HEADER_EFFECTS,
  HEADER_REASON,
} from "./wire.js";

export { morph } from "./morph.js";

export {
  applyEffects,
  parseEffects,
  consumeEffectsHeader,
  type Effects,
  type DispatchedEvent,
} from "./effects.js";
