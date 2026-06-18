/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The batch-2 client features (Epic #34): each is a self-contained module that plugs into a started
 * {@link LievitRuntime} through the public extension API (directive registry, lifecycle bus, action
 * interceptors, morph-hook providers) — none forks the bundle core (ADR-0019). Install only the ones
 * an app needs, or {@link installAllFeatures} for the full set.
 */

import type { LievitRuntime } from "../runtime.js";
import { installConfirm } from "./confirm.js";
import { installDirty } from "./dirty.js";
import { installIgnore } from "./ignore.js";
import { installInit } from "./init.js";
import { installLazy } from "./lazy.js";
import { installLoading } from "./loading.js";
import { installNavigate } from "./navigate.js";
import { installPagination } from "./pagination.js";
import { installPoll } from "./poll.js";
import { installPreserveScroll } from "./preserve-scroll.js";
import { installShow } from "./show.js";
import { installTransition } from "./transition.js";
import { installUploads } from "./uploads.js";

export { installConfirm, type ConfirmDialogs } from "./confirm.js";
export { installShow } from "./show.js";
export {
  parseShowExpression,
  evaluateShowExpression,
  ShowExpressionError,
  type ShowScope,
} from "./show-expression.js";
export { installIgnore } from "./ignore.js";
export { installInit } from "./init.js";
export { installLoading } from "./loading.js";
export { installDirty } from "./dirty.js";
export { installPoll, pollIntervalMs, type PollScheduler } from "./poll.js";
export { installTransition } from "./transition.js";
export { installLazy, type IntersectionObserverFactory } from "./lazy.js";
export {
  parseStreamEnvelope,
  applyStreamEnvelope,
  consumeStream,
  openStream,
  type StreamEnvelope,
  type StreamSource,
} from "./stream.js";
export { installNavigate, type NavigateOptions } from "./navigate.js";
export { installPagination, type ScrollToTop } from "./pagination.js";
export { installPreserveScroll } from "./preserve-scroll.js";
export {
  installUploads,
  type TempFileRef,
  type UploadTransport,
  type UploadOptions,
} from "./uploads.js";

/**
 * Installs every batch-2 client feature on a runtime (the convenience an app's `main.ts` calls after
 * {@link startLievit}). The streaming consumer is not installed here (it is opened on demand per
 * stream, not globally).
 *
 * @param runtime the started runtime to extend
 * @param options per-feature options (currently only uploads)
 */
export function installAllFeatures(
  runtime: LievitRuntime,
  options: { readonly uploads?: Parameters<typeof installUploads>[1] } = {},
): void {
  installConfirm(runtime);
  installShow(runtime);
  installIgnore(runtime);
  installInit(runtime);
  installLoading(runtime);
  installDirty(runtime);
  installPoll(runtime);
  installTransition(runtime);
  installLazy(runtime);
  installNavigate(runtime);
  installPagination(runtime);
  installPreserveScroll(runtime);
  installUploads(runtime, options.uploads);
}
