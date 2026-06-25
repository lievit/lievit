/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The Stimulus bootstrap for lievit (the morph-safe replacement for the hand-rolled
 * `data-*-enhanced` / `wireOnce` idempotency). One {@link Application} is started per page; it
 * **auto-loads every controller BY FILENAME** from `./controllers/*-controller.ts`, so a converted
 * component adds ONE self-contained controller file and NOTHING here changes -- the parallel
 * conversion fan-out never edits a central registry (no merge collisions).
 *
 * Why Stimulus is the morph-safe layer (the whole point of the migration):
 * - Stimulus's own `MutationObserver` connects a controller when its `data-controller` element
 *   enters the DOM and disconnects it when the element leaves -- so it survives the lievit wire
 *   morph + idiomorph + Turbo Drive visits with no double-init and no leaked listeners, for free.
 *   A controller that binds listeners in `connect()` gets them torn down in `disconnect()`; a
 *   preserved element keeps its single live controller across a morph (Stimulus dedupes by
 *   element+identifier). That replaces every `WeakSet`-of-wired-nodes and `afterCall` sweep.
 *
 * Autoload mechanism: Vite's `import.meta.glob` (eager). Vite is the supported adopter build
 * (gest = Vite 8) and vitest transforms it in tests, so the glob is the canonical zero-registry
 * autoloader. On a non-Vite bundler the glob is absent and autoload no-ops; such an adopter
 * registers controllers manually via the returned {@link Application}.
 *
 * docs-first: verified against @hotwired/stimulus 3.2.x -- `new Application(el)` +
 * `register(id, ctor)` + `start()` (the instance `start()` returns a Promise; the initial scan of
 * already-present `data-controller` elements completes after a microtask, so tests await it).
 */

import { Application } from "@hotwired/stimulus";
import type { ControllerConstructor } from "@hotwired/stimulus";
import type { LievitRuntime } from "../runtime.js";
import { setStimulusRuntime } from "./bridge.js";

/** A controller module as emitted by the glob (default export = the controller class). */
type ControllerModule = { readonly default: ControllerConstructor };

/**
 * Derives the Stimulus identifier from a controller file path, per the Stimulus filename
 * convention: strip the directory + the `-controller`/`_controller` suffix + extension; nested
 * folders join with `--`; underscores in a segment become dashes.
 *
 * `./controllers/lv-popover-controller.ts` -> `lv-popover`
 * `./controllers/overlay/menu-controller.ts` -> `overlay--menu`
 *
 * @param path the glob key (a path relative to this module)
 * @returns the data-controller identifier
 */
export function identifierForPath(path: string): string {
  const afterControllers = path.split("/controllers/").pop() ?? path;
  return afterControllers
    .replace(/\.[tj]s$/, "")
    .replace(/[-_]controller$/, "")
    .replace(/\//g, "--")
    .replace(/_/g, "-");
}

/**
 * Registers every controller the glob found on `app`. Exported so a test (or a non-Vite adopter)
 * can register an explicit module map without the glob.
 *
 * @param app     the Stimulus application
 * @param modules a map of glob-key -> controller module (default export = class)
 */
export function registerControllers(
  app: Application,
  modules: Record<string, ControllerModule>,
): void {
  for (const [path, mod] of Object.entries(modules)) {
    const ctor = mod.default;
    if (typeof ctor === "function") {
      app.register(identifierForPath(path), ctor);
    }
  }
}

/**
 * Loads the controller modules via Vite's `import.meta.glob`. It MUST be written as the literal
 * call form so Vite statically replaces it at transform time (an alias/cast defeats the transform);
 * `import-meta-glob.d.ts` types it for tsc. On a non-Vite bundler the property is undefined and the
 * call throws -> the try/catch yields an empty map and the adopter registers controllers manually.
 */
function autoloadedModules(): Record<string, ControllerModule> {
  try {
    return import.meta.glob("./controllers/*-controller.{ts,js}", {
      eager: true,
    }) as Record<string, ControllerModule>;
  } catch {
    return {};
  }
}

let started: Application | null = null;

/** Options for {@link startStimulus}. */
export interface StartStimulusOptions {
  /** The started lievit runtime, published to controllers via the wire bridge. */
  readonly runtime?: LievitRuntime;
  /** The root element to observe. Default `document.documentElement`. */
  readonly element?: Element;
  /** Turn on Stimulus debug logging. */
  readonly debug?: boolean;
}

/**
 * Boots (idempotently) the single Stimulus application for the page: publishes the runtime to the
 * wire bridge, auto-registers every `controllers/*-controller.ts`, and starts observing. Returns
 * the {@link Application} so an adopter can register extra controllers. Call once from `main.ts`,
 * AFTER {@link startLievit}; a second call returns the same application (and re-publishes the
 * runtime if given).
 *
 * @param options runtime + root element + debug
 * @returns the started (or already-started) Stimulus application
 */
export function startStimulus(options: StartStimulusOptions = {}): Application {
  if (options.runtime != null) {
    setStimulusRuntime(options.runtime);
  }
  if (started != null) {
    return started;
  }
  const app = new Application(options.element ?? document.documentElement);
  if (options.debug === true) {
    app.debug = true;
  }
  registerControllers(app, autoloadedModules());
  void app.start();
  started = app;
  return app;
}

/**
 * Stops + forgets the page application and clears the runtime bridge. For tests (reset between
 * cases) and hot-reload teardown; not needed in production.
 */
export function stopStimulus(): void {
  started?.stop();
  started = null;
  setStimulusRuntime(null);
}

/** The started application, or `null` before {@link startStimulus}. */
export function currentApplication(): Application | null {
  return started;
}

/**
 * Awaits one macrotask so Stimulus's MutationObserver has processed pending DOM mutations (a
 * controller connecting on `start()` or after a morph). The canonical "wait for Stimulus" used by
 * tests after `startStimulus()` / a morph; documented in the conversion convention.
 */
export function flushStimulus(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
