/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

import { ControlRegistry } from "./controls.js";

/**
 * The directive registry: the public extension point that lets later client features add new
 * `l:*` behaviors (e.g. `l:navigate`, `l:poll`, `l:ignore`) WITHOUT editing the core bundle. A
 * directive declares the `l:` name it binds and how it wires a DOM element to the runtime; the
 * runtime scans a component's subtree and asks each registered directive to bind the elements that
 * carry its attribute.
 *
 * The core registers the v0.1 directives (`l:click`, `l:submit`, `l:keydown`, `l:model`) through
 * this same registry, so a built-in directive has no privilege a third-party one lacks — the
 * registry IS the API (wire-protocol.md §5).
 */

/** Coarse, per-call metadata a directive can attach (the trigger element, a poll flag, etc.). */
export interface CallMetaInit {
  /** The element that triggered the call (the clicked button, the submitted form). */
  readonly trigger?: Element;
  /** Open for features (e.g. poll) to stamp their own keys. */
  readonly [key: string]: unknown;
}

/** The element-level API a directive uses to drive the runtime when its event fires. */
export interface DirectiveRuntime {
  /**
   * Queue an action call for the component owning `element`, then issue the wire call.
   *
   * @param element any element inside the component (used to find the component root)
   * @param action the `@LievitAction` name to invoke
   * @param meta optional call metadata (e.g. the trigger element) surfaced to interceptors/hooks
   */
  readonly callAction: (element: Element, action: string, meta?: CallMetaInit) => void;
  /**
   * Record a client-side `@Wire` field change for the component owning `element`. Whether it is
   * sent immediately or deferred to the next action is the directive's policy (the `l:model`
   * modifiers); the runtime just stores it.
   *
   * @param element the bound input element
   * @param field the `@Wire` field name
   * @param value the new value
   * @param send true to issue a wire call now, false to defer to the next action
   */
  readonly setModel: (element: Element, field: string, value: unknown, send: boolean) => void;
}

/**
 * A directive binds the elements carrying its `l:` attribute to the runtime. `bind` is called once
 * per matching element each time the runtime scans (initial load + after a morph introduces new
 * nodes); it must be idempotent — guard with a marker so re-binding the same element is a no-op.
 */
export interface Directive {
  /** The bare attribute name without the `l:` prefix, e.g. `"click"`, `"model"`, `"keydown"`. */
  readonly name: string;
  /**
   * Wire one element that carries `l:<name>` (possibly with modifiers like `l:model.live`).
   *
   * @param element the element carrying the directive attribute
   * @param attribute the full attribute name as written (e.g. `l:keydown.enter`)
   * @param value the attribute value (the action or field name)
   * @param runtime the runtime hooks the directive calls when its event fires
   */
  readonly bind: (
    element: Element,
    attribute: string,
    value: string,
    runtime: DirectiveRuntime,
  ) => void;
}

/** The `l:` prefix every directive attribute carries. */
export const DIRECTIVE_PREFIX = "l:";

/** Splits `l:keydown.enter` into `{ name: "keydown", modifiers: ["enter"] }`. */
export function parseDirective(attribute: string): { name: string; modifiers: string[] } | null {
  if (!attribute.startsWith(DIRECTIVE_PREFIX)) {
    return null;
  }
  const [name, ...modifiers] = attribute.slice(DIRECTIVE_PREFIX.length).split(".");
  return { name, modifiers };
}

/**
 * A registry of directives keyed by their bare name. The runtime owns one instance and seeds it
 * with the built-ins; features add their own via {@link register}.
 */
export class DirectiveRegistry {
  private readonly directives = new Map<string, Directive>();

  /**
   * Registers (or replaces) a directive. A feature calling this with `name: "navigate"` makes
   * `l:navigate="..."` live across the whole app.
   *
   * @param directive the directive to add
   */
  register(directive: Directive): void {
    this.directives.set(directive.name, directive);
  }

  /**
   * @param name the bare directive name
   * @returns the registered directive, or `undefined` if none binds that name
   */
  get(name: string): Directive | undefined {
    return this.directives.get(name);
  }

  /**
   * Binds every `l:*` attribute on `element` whose directive is registered. Unknown `l:` attributes
   * are ignored (a forward-compatible no-op, so a template using a not-yet-loaded directive does not
   * error).
   *
   * @param element the element to scan for `l:*` attributes
   * @param runtime the runtime hooks passed to each directive's `bind`
   */
  bindElement(element: Element, runtime: DirectiveRuntime): void {
    for (const attr of Array.from(element.attributes)) {
      const parsed = parseDirective(attr.name);
      if (parsed == null) {
        continue;
      }
      const directive = this.directives.get(parsed.name);
      directive?.bind(element, attr.name, attr.value, runtime);
    }
  }

  /**
   * Scans `root` and all its descendants, binding every registered `l:*` directive found.
   *
   * @param root the subtree to scan (a component root, or a freshly morphed-in node)
   * @param runtime the runtime hooks passed to each directive's `bind`
   */
  scan(root: Element, runtime: DirectiveRuntime): void {
    this.bindElement(root, runtime);
    for (const el of Array.from(root.querySelectorAll("*"))) {
      this.bindElement(el, runtime);
    }
  }
}

/** A per-element marker attribute so a directive binds an element at most once (idempotent scan). */
function boundMarker(attribute: string): string {
  return `data-lievit-bound-${attribute.replace(/[^a-z]/gi, "-")}`;
}

/** Guards a bind so it runs at most once per element+attribute; returns false if already bound. */
function once(element: Element, attribute: string): boolean {
  const marker = boundMarker(attribute);
  if (element.hasAttribute(marker)) {
    return false;
  }
  element.setAttribute(marker, "");
  return true;
}

/** The debounce default for `l:model.live` (wire-protocol.md §5: ~150 ms). */
const LIVE_DEBOUNCE_MS = 150;

/** Parses an explicit `debounce.<N>ms` modifier into milliseconds, or null if absent/invalid. */
function debounceMs(modifiers: string[]): number | null {
  const i = modifiers.indexOf("debounce");
  const spec = i >= 0 ? modifiers[i + 1] : undefined;
  if (spec == null) {
    return null;
  }
  const ms = Number.parseInt(spec.replace(/ms$/, ""), 10);
  return Number.isFinite(ms) ? ms : null;
}

/** A tiny debounce helper (no framework dep). */
function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return ((...args: never[]) => {
    if (timer != null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

/**
 * A process-wide default {@link ControlRegistry} the built-in `l:model` uses when no registry is
 * passed (keeps `builtinDirectives()` zero-arg for existing callers and tests). The runtime exposes
 * its OWN registry instance as `runtime.controls` and passes it here, so an app registers exotic
 * control adapters on `runtime.controls` and they take effect for `l:model`.
 */
const defaultControls = new ControlRegistry();

/**
 * Builds the directive set lievit ships in v0.1 (wire-protocol.md §5): `l:click`, `l:submit`,
 * `l:keydown[.key]`, and `l:model[.live|.lazy|.blur|.debounce.Nms]`. Returned as a fresh array so a
 * caller can register them into a {@link DirectiveRegistry} (the runtime does this on start), and so
 * tests can register a subset.
 *
 * @param controls the control-value registry `l:model` reads through (custom-element support +
 *   per-tag adapter seam); defaults to a shared process-wide registry.
 */
export function builtinDirectives(controls: ControlRegistry = defaultControls): Directive[] {
  return [actionDirective("click", "click"), submitDirective(), keydownDirective(), modelDirective(controls)];
}

/** A directive that invokes an action on a DOM event of the given type (`l:click`). */
function actionDirective(name: string, eventType: string): Directive {
  return {
    name,
    bind(element, attribute, value, runtime) {
      if (!once(element, attribute)) {
        return;
      }
      element.addEventListener(eventType, () => runtime.callAction(element, value, { trigger: element }));
    },
  };
}

/** `l:submit="action"`: prevents the native submit, then invokes the action. */
function submitDirective(): Directive {
  return {
    name: "submit",
    bind(element, attribute, value, runtime) {
      if (!once(element, attribute)) {
        return;
      }
      element.addEventListener("submit", (event) => {
        event.preventDefault();
        runtime.callAction(element, value, { trigger: element });
      });
    },
  };
}

/** `l:keydown.enter="action"` (and other keys): invokes the action when the named key is pressed. */
function keydownDirective(): Directive {
  return {
    name: "keydown",
    bind(element, attribute, value, runtime) {
      if (!once(element, attribute)) {
        return;
      }
      const parsed = parseDirective(attribute);
      const wantedKey = parsed?.modifiers[0]; // e.g. "enter"
      element.addEventListener("keydown", (event) => {
        const ke = event as KeyboardEvent;
        if (wantedKey == null || ke.key.toLowerCase() === wantedKey.toLowerCase()) {
          runtime.callAction(element, value, { trigger: element });
        }
      });
    },
  };
}

/**
 * `l:model[.modifier]="field"`: binds an input's value to a `@Wire` field. The modifier decides
 * *when* the change is sent (wire-protocol.md §5):
 * - none → deferred (held client-side, rides the next action),
 * - `.live` → on input, debounced ~150 ms,
 * - `.debounce.Nms` → on input, debounced N ms,
 * - `.lazy` → on `change`,
 * - `.blur` → on `blur`.
 *
 * The value is read through the {@link ControlRegistry} so the same modifiers work on a custom
 * element (a Web Awesome `<wa-input>` / `<wa-select>` / `<wa-checkbox>`) that exposes `.value` /
 * `.checked`, not only on the native controls. Web Awesome emits the native `input` / `change` /
 * `blur`, so the listener wiring is unchanged; an exotic control that fires a different event
 * declares it on its adapter and the registry resolves the right event name per modifier.
 *
 * @param controls the control-value registry to read through and resolve change events from
 */
function modelDirective(controls: ControlRegistry): Directive {
  return {
    name: "model",
    bind(element, attribute, field, runtime) {
      if (!once(element, attribute)) {
        return;
      }
      const parsed = parseDirective(attribute);
      const modifiers = parsed?.modifiers ?? [];
      const read = () => controls.read(element);

      const explicitDebounce = debounceMs(modifiers);
      const live = modifiers.includes("live") || explicitDebounce != null;
      const lazy = modifiers.includes("lazy");
      const blur = modifiers.includes("blur");

      if (live) {
        const ms = explicitDebounce ?? LIVE_DEBOUNCE_MS;
        const onInput = debounce(() => runtime.setModel(element, field, read(), true), ms);
        element.addEventListener(controls.eventFor(element, "live"), () => onInput());
        return;
      }
      if (lazy) {
        element.addEventListener(controls.eventFor(element, "lazy"), () =>
          runtime.setModel(element, field, read(), true),
        );
        return;
      }
      if (blur) {
        element.addEventListener(controls.eventFor(element, "blur"), () =>
          runtime.setModel(element, field, read(), true),
        );
        return;
      }
      // Deferred (default): store on input, never send on its own — rides the next action.
      element.addEventListener(controls.eventFor(element, "live"), () =>
        runtime.setModel(element, field, read(), false),
      );
    },
  };
}
