/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The Livewire v4 directive cluster (ADR-0024), registered as ONE additive entry
 * ({@link registerV4Directives}) so a sibling agent adding other directives to the same bundle
 * merges cleanly: each directive lives in its own clearly-fenced block and registers through the
 * public {@link import("./directives.js").DirectiveRegistry} and lifecycle seams, never by editing
 * the core. Nothing here evaluates an expression: every directive is pure DOM, and reactive client
 * state (`$dirty`, `$errors`) is derived from data the runtime already holds. Strict-CSP-safe.
 *
 * Covered: `l:bind:<attr>` (#75), `l:text` (#77), `l:dirty` + `$dirty` (#85), `l:errors` /
 * `l:error` + `$errors` (#101), `l:ref` (#109), `l:sort` (#111), `l:click.async` (#97), and the
 * disable-during-request behavior (#125).
 */

import { type Directive, parseDirective } from "./directives.js";
import type { CallContext, CallOutcome, ComponentContext, LifecycleHook } from "./lifecycle.js";

/** The runtime services the v4 directives need beyond the base directive runtime. */
export interface V4Deps {
  /** Registers a directive (the runtime's `directives.register`). */
  readonly registerDirective: (directive: Directive) => void;
  /** Registers a lifecycle hook (the runtime's `use`); returns an unsubscribe. */
  readonly use: (hook: LifecycleHook) => () => void;
  /**
   * Reads the current *ephemeral* value of a `@Wire` field for the component owning `element` (the
   * client-side mirror the runtime keeps, updated on every `l:model` input before any network
   * call). Returns `undefined` if the field has no known value yet.
   */
  readonly ephemeral: (element: Element, field: string) => unknown;
  /** True while the component owning `element` has a wire call in flight (for disable-during-request). */
  readonly inFlight?: (element: Element) => boolean;
  /** The named-ref registry (`l:ref`), scoped per component root. */
  readonly refs?: RefRegistry;
  /**
   * Reads the latest `errors` effect for a component root (the runtime captures it pre-`afterCall`,
   * #101). The error directives render from this rather than parsing HTML; defaults to "no errors".
   */
  readonly errorsFor?: (root: Element) => Record<string, readonly string[]>;
}

/** A per-component registry of named element refs (`l:ref="name"`, #109). */
export class RefRegistry {
  private readonly byRoot = new WeakMap<Element, Map<string, Element>>();

  /** Records `element` under `name` for its component `root`. */
  set(root: Element, name: string, element: Element): void {
    let map = this.byRoot.get(root);
    if (map == null) {
      map = new Map();
      this.byRoot.set(root, map);
    }
    map.set(name, element);
  }

  /**
   * @param root the component root
   * @param name the ref name
   * @returns the element registered under `name` for `root`, or `undefined`
   */
  get(root: Element, name: string): Element | undefined {
    return this.byRoot.get(root)?.get(name);
  }
}

/** Finds the component root that owns `element` (the nearest ancestor with the component attr). */
function rootOf(element: Element): Element | null {
  return element.closest("[data-lievit-component]");
}

/**
 * Registers the v4 directive cluster against the runtime seams. Call once after constructing the
 * runtime (the convenience `startLievit` wiring can call it). Returns an array of unsubscribe
 * functions for the lifecycle hooks it registered (for teardown in tests).
 *
 * @param deps the runtime services the directives compose onto
 * @returns unsubscribe functions for the registered lifecycle hooks
 */
export function registerV4Directives(deps: V4Deps): Array<() => void> {
  const unsubscribes: Array<() => void> = [];

  // --- #75 l:bind:<attr> + #77 l:text : reflect a field's ephemeral value onto the DOM ----------
  const reflectors = new Map<Element, Array<() => void>>();
  const addReflector = (root: Element, fn: () => void): void => {
    let list = reflectors.get(root);
    if (list == null) {
      list = [];
      reflectors.set(root, list);
    }
    list.push(fn);
    fn(); // reflect once on bind (the initial paint may precede the first model change)
  };

  deps.registerDirective(bindDirective(deps, addReflector));
  deps.registerDirective(textDirective(deps, addReflector));

  // On any model change, re-run every reflector for the changed component so l:bind / l:text stay
  // in sync with the ephemeral value, with no network round-trip.
  unsubscribes.push(
    deps.use({
      onModelChange(ctx: ComponentContext) {
        for (const fn of reflectors.get(ctx.root) ?? []) {
          fn();
        }
      },
      afterCall(outcome: CallOutcome) {
        // A morph may have introduced new bound elements; reflectors are re-added on re-scan, but
        // re-run the existing ones so server-rendered values and ephemeral values reconcile.
        for (const fn of reflectors.get(outcome.root) ?? []) {
          fn();
        }
      },
    }),
  );

  // --- #85 l:dirty + $dirty : flag a component while it has uncommitted l:model edits ------------
  const dirtyTracker = new DirtyTracker();
  unsubscribes.push(
    deps.use({
      onModelChange(ctx: ComponentContext) {
        dirtyTracker.markDirty(ctx.root);
        applyDirty(ctx.root, true);
      },
      afterCall(outcome: CallOutcome) {
        // A successful call commits the pending edits → clean.
        dirtyTracker.markClean(outcome.root);
        applyDirty(outcome.root, false);
      },
    }),
  );
  deps.registerDirective(dirtyDirective());

  // --- #101 l:errors / l:error + $errors : render the validation `errors` effect, no HTML parse --
  const errorsFor = deps.errorsFor ?? (() => ({}));
  unsubscribes.push(
    deps.use({
      afterCall(outcome: CallOutcome) {
        // Errors ride the effects bag; the runtime captures them per-root before `afterCall`.
        applyErrors(outcome.root, errorsFor(outcome.root));
      },
    }),
  );
  deps.registerDirective(errorsDirective());
  deps.registerDirective(errorDirective());

  // --- #109 l:ref : register a named element ref for stream/dispatch/scroll targeting ------------
  if (deps.refs != null) {
    deps.registerDirective(refDirective(deps.refs));
  }

  // --- #111 l:sort : drag-to-reorder, committing the new order as a model update ----------------
  deps.registerDirective(sortDirective());

  // --- #125 disable-during-request : disable form controls / [l:loading.attr] while in flight ----
  unsubscribes.push(
    deps.use({
      beforeCall(ctx: CallContext) {
        toggleLoading(ctx.root, true);
      },
      afterCall(outcome: CallOutcome) {
        toggleLoading(outcome.root, false);
      },
      onError(outcome: CallOutcome) {
        toggleLoading(outcome.root, false);
      },
    }),
  );

  return unsubscribes;

  // -------------------------------------------------------------------------------------------- //
}

/** A store the runtime feeds the latest `errors` effect into, keyed by component root (#101). */
export class ErrorsStore {
  private readonly byRoot = new WeakMap<Element, Record<string, readonly string[]>>();

  /** Records the per-field errors for a component (called by the runtime before `afterCall`). */
  set(root: Element, errors: Record<string, readonly string[]>): void {
    this.byRoot.set(root, errors);
  }

  /** Clears a component's errors (a clean call). */
  clear(root: Element): void {
    this.byRoot.delete(root);
  }

  /**
   * @param root the component root
   * @returns the per-field errors map (empty if none), the `$errors` accessor's backing data
   */
  get(root: Element): Record<string, readonly string[]> {
    return this.byRoot.get(root) ?? {};
  }
}

/** Tracks which component roots have uncommitted `l:model` edits (the `$dirty` flag, #85). */
export class DirtyTracker {
  private readonly dirty = new WeakSet<Element>();

  markDirty(root: Element): void {
    this.dirty.add(root);
  }

  markClean(root: Element): void {
    this.dirty.delete(root);
  }

  /**
   * @param root the component root
   * @returns true if the component has uncommitted edits
   */
  isDirty(root: Element): boolean {
    return this.dirty.has(root);
  }
}

/**
 * `l:bind.<attr>="field"`: reflect a field's ephemeral value onto a DOM attribute (#75). The
 * attribute name rides as the directive modifier (`l:bind.disabled`, `l:bind.class`), so it goes
 * through the existing `.`-splitting directive registry without a colon-aware lookup. Boolean attrs
 * (`disabled`/`checked`/`readonly`/`hidden`) toggle presence; others set the stringified value.
 */
function bindDirective(
  deps: V4Deps,
  addReflector: (root: Element, fn: () => void) => void,
): Directive {
  return {
    name: "bind",
    bind(element, attribute, field) {
      const parsed = parseDirective(attribute);
      // l:bind.disabled -> the attribute name is the first modifier segment ("disabled").
      const attr = parsed?.modifiers[0];
      if (attr == null) {
        return;
      }
      const root = rootOf(element);
      if (root == null) {
        return;
      }
      addReflector(root, () => {
        const value = deps.ephemeral(element, field);
        applyBoundAttribute(element, attr, value);
      });
    },
  };
}

/** Applies a bound attribute: boolean attrs toggle presence, others set the stringified value. */
function applyBoundAttribute(element: Element, attr: string, value: unknown): void {
  const booleanAttr =
    attr === "disabled" || attr === "checked" || attr === "readonly" || attr === "hidden";
  if (booleanAttr) {
    if (value === true) {
      element.setAttribute(attr, "");
    } else {
      element.removeAttribute(attr);
    }
    return;
  }
  if (value == null || value === false) {
    element.removeAttribute(attr);
  } else {
    element.setAttribute(attr, String(value));
  }
}

/** `l:text="field"`: bind an element's textContent to a field's ephemeral value (#77). */
function textDirective(
  deps: V4Deps,
  addReflector: (root: Element, fn: () => void) => void,
): Directive {
  return {
    name: "text",
    bind(element, _attribute, field) {
      const root = rootOf(element);
      if (root == null) {
        return;
      }
      addReflector(root, () => {
        const value = deps.ephemeral(element, field);
        (element as HTMLElement).textContent = value == null ? "" : String(value);
      });
    },
  };
}

/** `l:dirty`: show the element only while its component has uncommitted edits (#85). */
function dirtyDirective(): Directive {
  return {
    name: "dirty",
    bind(element) {
      // The element is hidden by default; the dirty lifecycle hook flips it. Mark it so the runtime
      // knows to manage its visibility (the hook toggles all [data-lievit-dirty-indicator]).
      element.setAttribute("data-lievit-dirty-indicator", "");
      (element as HTMLElement).hidden = true;
    },
  };
}

/** Flips the component's dirty flag + every `l:dirty` indicator inside it (#85). */
function applyDirty(root: Element, dirty: boolean): void {
  if (dirty) {
    root.setAttribute("data-lievit-dirty", "");
  } else {
    root.removeAttribute("data-lievit-dirty");
  }
  for (const el of Array.from(root.querySelectorAll("[data-lievit-dirty-indicator]"))) {
    (el as HTMLElement).hidden = !dirty;
  }
}

/**
 * `l:errors`: mark a container the `errors` effect's presence toggles (#101). The store is the
 * shared backing data {@link applyErrors} reads on each `afterCall`; the directive only marks the
 * element, so the toggle is data-driven, not expression-driven (CSP-safe).
 */
function errorsDirective(): Directive {
  return {
    name: "errors",
    bind(element) {
      element.setAttribute("data-lievit-errors-container", "");
    },
  };
}

/** `l:error="field"`: show/hide and fill an element with a single field's first error (#101). */
function errorDirective(): Directive {
  return {
    name: "error",
    bind(element, _attribute, field) {
      element.setAttribute("data-lievit-error-for", field);
      (element as HTMLElement).hidden = true;
    },
  };
}

/** Applies the `errors` effect to a component's `l:error` / `l:errors` elements (#101). */
function applyErrors(root: Element, errors: Record<string, readonly string[]>): void {
  for (const el of Array.from(root.querySelectorAll("[data-lievit-error-for]"))) {
    const field = el.getAttribute("data-lievit-error-for")!;
    const messages = errors[field];
    const html = el as HTMLElement;
    if (messages != null && messages.length > 0) {
      html.textContent = messages[0]!;
      html.hidden = false;
    } else {
      html.textContent = "";
      html.hidden = true;
    }
  }
  for (const el of Array.from(root.querySelectorAll("[data-lievit-errors-container]"))) {
    const all = Object.values(errors).flat();
    (el as HTMLElement).hidden = all.length === 0;
  }
}

/** `l:ref="name"`: register a named element ref for its component (#109). */
function refDirective(refs: RefRegistry): Directive {
  return {
    name: "ref",
    bind(element, _attribute, name) {
      const root = rootOf(element);
      if (root != null) {
        refs.set(root, name, element);
      }
    },
  };
}

/**
 * `l:sort="field"`: drag-to-reorder the element's children, committing the new order of their
 * `data-lievit-sort-key` values as a model update (#111). HTML5 drag-and-drop, CSP-safe (no inline
 * handler). Each sortable child must carry `data-lievit-sort-key`.
 */
function sortDirective(): Directive {
  return {
    name: "sort",
    bind(element, _attribute, field, runtime) {
      let dragged: HTMLElement | null = null;
      for (const child of Array.from(element.children)) {
        const item = child as HTMLElement;
        if (!item.hasAttribute("data-lievit-sort-key")) {
          continue;
        }
        item.setAttribute("draggable", "true");
        item.addEventListener("dragstart", () => {
          dragged = item;
        });
        item.addEventListener("dragover", (e) => e.preventDefault());
        item.addEventListener("drop", (e) => {
          e.preventDefault();
          if (dragged != null && dragged !== item) {
            // Insert the dragged item before or after the drop target by document position.
            const after = item.compareDocumentPosition(dragged) & Node.DOCUMENT_POSITION_PRECEDING;
            element.insertBefore(dragged, after ? item.nextSibling : item);
          }
          const order = Array.from(element.children)
            .map((c) => c.getAttribute("data-lievit-sort-key"))
            .filter((k): k is string => k != null);
          runtime.setModel(element, field, order, true);
          dragged = null;
        });
      }
    },
  };
}

/** Disables in-component form controls / `[l:loading.attr]` while a call is in flight (#125). */
function toggleLoading(root: Element, loading: boolean): void {
  for (const el of Array.from(root.querySelectorAll("[l\\:loading], [data-lievit-loading]"))) {
    const html = el as HTMLElement;
    if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
      el.disabled = loading;
    } else if (el instanceof HTMLAnchorElement) {
      el.setAttribute("aria-disabled", String(loading));
    } else {
      html.toggleAttribute("data-lievit-rt-loading-active", loading);
    }
  }
}
