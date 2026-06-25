/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The Stimulus layer's public surface. An app's `main.ts` calls {@link startStimulus} after
 * {@link startLievit}; converted components ship a `controllers/*-controller.ts` (auto-loaded) and
 * extend the shared {@link DismissableController} / compose {@link FocusTrap}. Tests import
 * {@link flushStimulus} + {@link setStimulusRuntime}.
 *
 * The morph-safety contract and the per-component conversion recipe are documented in
 * `planning/v-next/stimulus-convention.md`.
 */

export {
  startStimulus,
  stopStimulus,
  flushStimulus,
  currentApplication,
  registerControllers,
  identifierForPath,
  type StartStimulusOptions,
} from "./application.js";

export { setStimulusRuntime, getStimulusRuntime, callWire } from "./bridge.js";

export { DismissableController } from "./base/dismissable-controller.js";
export { FocusTrap, type FocusTrapOptions } from "./base/focus-trap.js";

export { default as LvPopoverController } from "./controllers/lv-popover-controller.js";
export { default as LvSidebarController } from "./controllers/lv-sidebar-controller.js";
