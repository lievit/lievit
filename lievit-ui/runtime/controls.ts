/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The control-value registry: the seam that lets `l:model` two-way-bind ANY control, not just the
 * native `<input>` / `<select>` / `<textarea>`. A custom element (a Web Awesome `<wa-input>`,
 * `<wa-select>`, `<wa-checkbox>`; a Shoelace or Lit form control) exposes its value as a DOM
 * *property* (`.value`, `.checked`), not as a readable native control interface, so reading
 * `textContent` (the old fallback) silently broke binding. This module reads and WRITES that
 * property convention, with a per-tag override seam for exotic controls.
 *
 * Default-first, register-only-for-exotic:
 * - native form controls keep their exact previous behavior (a checkbox/radio reads `.checked`,
 *   everything else reads `.value`);
 * - any other element that exposes a `value` (or a boolean `checked`) property is bound through
 *   that property, so a form-associated custom element works with zero config;
 * - an exotic control that does not follow the convention registers a {@link ControlAdapter} for
 *   its tag, overriding the default read/write and optionally declaring the event that signals a
 *   change.
 *
 * Strict-CSP-safe (no `eval`), zero framework deps. The read side feeds the `l:model` directive;
 * the write side feeds the morph value-restore so the two stay symmetric.
 */

/** A per-tag override for reading/writing a control's value (registered for exotic controls). */
export interface ControlAdapter {
  /**
   * Reads the wire-relevant value of `element` (the value `l:model` sends to the `@Wire` field).
   *
   * @param element the bound control
   * @returns the value to bind (a string, a boolean for a checkbox-like control, etc.)
   */
  read(element: Element): unknown;
  /**
   * Writes `value` onto `element` (the value-restore the morph performs from server `@Wire` state).
   *
   * @param element the bound control
   * @param value the value to set
   */
  write(element: Element, value: unknown): void;
  /**
   * The DOM event that signals a user change for the `.live` / `.lazy` / `.blur` modifiers. Web
   * Awesome (and most libs) emit the native `input` / `change` / `blur`, so this is rarely needed;
   * declare it only when a control fires a non-standard event (e.g. `"wa-select"`). When absent,
   * `l:model` uses the standard event for the modifier (`input` for live/deferred, `change` for
   * lazy, `blur` for blur).
   */
  readonly liveEvent?: string;
  readonly lazyEvent?: string;
  readonly blurEvent?: string;
}

/** Whether `element` is a native control whose value-reading must keep its exact legacy behavior. */
function isNativeControl(element: Element): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}

/**
 * Whether `element` is checkbox-like: a control whose state is a boolean carried on `.checked`.
 * Detected by a checkbox/radio/switch signal (native `type`, the WAI-ARIA `role`, or a custom-element
 * `type`), OR simply by exposing a boolean `.checked` property. A boolean `.checked` is authoritative
 * even when the element ALSO exposes a `.value`: a Web Awesome `<wa-checkbox>` / `<wa-switch>` carries
 * both `.checked` and a default `.value` of `"on"`, and its meaningful state is the boolean, so it
 * binds a boolean exactly like a native checkbox (zero-config, no per-tag adapter needed).
 */
function isCheckboxLike(element: Element): boolean {
  if (element instanceof HTMLInputElement) {
    return element.type === "checkbox" || element.type === "radio";
  }
  if (!("checked" in element)) {
    return false;
  }
  const role = element.getAttribute("role");
  if (role === "checkbox" || role === "radio" || role === "switch") {
    return true;
  }
  // A custom element may mirror the native `type` (e.g. a generic toggle); treat it the same.
  const type = (element as { type?: unknown }).type;
  if (type === "checkbox" || type === "radio" || type === "switch") {
    return true;
  }
  // The element exposes a boolean `checked`: a toggle whose state is that boolean, even if it also
  // carries a `value` (a Web Awesome <wa-checkbox>/<wa-switch> exposes both .checked and .value="on";
  // the checked state is authoritative, so bind the boolean, not the "on" string).
  return typeof (element as { checked?: unknown }).checked === "boolean";
}

/**
 * The zero-config reader. Native controls behave exactly as before. A custom element that exposes
 * `.checked` (checkbox-like) reads the boolean; one that exposes `.value` reads the value; anything
 * else falls back to `textContent` (the historical default for non-controls).
 *
 * @param element the bound control
 * @returns the wire-relevant value
 */
export function defaultReadControlValue(element: Element): unknown {
  if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
    return element.checked;
  }
  if (isNativeControl(element)) {
    return (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }
  if (isCheckboxLike(element)) {
    return (element as unknown as { checked: boolean }).checked;
  }
  if ("value" in element) {
    return (element as unknown as { value: unknown }).value;
  }
  return (element as HTMLElement).textContent;
}

/**
 * The zero-config writer, symmetric with {@link defaultReadControlValue}: sets `.checked` on a
 * checkbox-like control and `.value` on everything that exposes a `value`. Used by the morph
 * value-restore so server `@Wire` state lands on custom elements too. A no-op for an element that
 * exposes neither (there is nothing to restore).
 *
 * @param element the bound control
 * @param value the value to set
 */
export function defaultWriteControlValue(element: Element, value: unknown): void {
  if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
    element.checked = Boolean(value);
    return;
  }
  if (isNativeControl(element)) {
    (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value = String(value ?? "");
    return;
  }
  if (isCheckboxLike(element)) {
    (element as unknown as { checked: boolean }).checked = Boolean(value);
    return;
  }
  if ("value" in element) {
    (element as unknown as { value: unknown }).value = value;
  }
}

/**
 * The CSS selector that identifies a lievit combobox root. The combobox is a server-rendered
 * `<div data-slot="combobox">` (also `data-controller~="lv-combobox"` once Stimulus mounts); its
 * committed value lives in a hidden `<input>` (single) or a list of repeated hidden `<input>`s
 * (multiple), NEVER on the div itself. A plain read of the div would return `textContent`, so a
 * combobox root needs the adapter below for `l:model` to read the committed value(s).
 */
export const COMBOBOX_ROOT_SELECTOR = '[data-slot="combobox"],[data-controller~="lv-combobox"]';

/**
 * The built-in {@link ControlAdapter} for the lievit combobox root (matched by selector, not by tag,
 * since the tag is a generic `<div>`). READ returns the committed value(s) from the hidden input(s):
 * a single string for a single-select combobox, an array of strings for a multiple-select combobox
 * (one per repeated `name`-bound hidden input). This is what makes `l:model` / `l:model.live` stamped
 * on the combobox root read the committed VALUE (the option id), not the div's text. WRITE restores
 * the single hidden input's value; the multiple committed set is server-rendered and seeded by the
 * controller, so the array restore is a no-op here.
 */
export const comboboxControlAdapter: ControlAdapter = {
  read(element: Element): unknown {
    const list = element.querySelector('[data-slot="combobox-hidden-list"]');
    if (list != null) {
      return Array.from(
        list.querySelectorAll<HTMLInputElement>('input[data-slot="combobox-hidden"]'),
      ).map((input) => input.value);
    }
    const hidden = element.querySelector<HTMLInputElement>('[data-slot="combobox-hidden"]');
    return hidden != null ? hidden.value : "";
  },
  write(element: Element, value: unknown): void {
    if (element.querySelector('[data-slot="combobox-hidden-list"]') != null) {
      return; // multiple: the committed set is owned by the server render + the controller's seed
    }
    const hidden = element.querySelector<HTMLInputElement>('[data-slot="combobox-hidden"]');
    if (hidden != null) {
      hidden.value = String(value ?? "");
    }
  },
};

/**
 * A registry of {@link ControlAdapter}s. The runtime owns one instance and exposes it as
 * `runtime.controls`; an app registers an exotic control's adapter (`controls.register('wa-foo',
 * {...})`) without editing the core. Tag names are matched case-insensitively (custom-element tags
 * are lowercased by the platform). A SELECTOR-matched seam ({@link registerMatcher}) handles controls
 * whose value is not on the bound element's own `.value` and that are not identified by tag (e.g. the
 * combobox root `<div>`, registered as a built-in below). Unmatched elements use the zero-config
 * default.
 */
export class ControlRegistry {
  private readonly adapters = new Map<string, ControlAdapter>();
  private readonly matchers: Array<{ selector: string; adapter: ControlAdapter }> = [];

  constructor() {
    // Built-in: the lievit combobox root is a generic <div>, so it cannot be matched by tag; its
    // committed value lives in its hidden input(s). Registered by default so `l:model` on a combobox
    // root works with zero adopter config. A tag adapter still wins (apps can override).
    this.registerMatcher(COMBOBOX_ROOT_SELECTOR, comboboxControlAdapter);
  }

  /**
   * Registers (or replaces) the adapter for a tag. Default-first: only register for a control that
   * does not follow the `.value` / `.checked` convention the default already handles.
   *
   * @param tag the element tag name, e.g. `"wa-rating"` (case-insensitive)
   * @param adapter the read/write/event override
   */
  register(tag: string, adapter: ControlAdapter): void {
    this.adapters.set(tag.toLowerCase(), adapter);
  }

  /**
   * Registers a SELECTOR-matched adapter, for a control whose value is not on its own element and
   * which is not identified by tag (the combobox root `<div>` is the built-in case). Tag adapters
   * take precedence; matchers are consulted in registration order for an element with no tag adapter.
   *
   * @param selector a CSS selector the bound element must match
   * @param adapter the read/write/event override
   */
  registerMatcher(selector: string, adapter: ControlAdapter): void {
    this.matchers.push({ selector, adapter });
  }

  /**
   * @param element a bound control
   * @returns the adapter for the element's tag, else the first matching selector adapter, else
   *   `undefined` (use the default)
   */
  adapterFor(element: Element): ControlAdapter | undefined {
    const byTag = this.adapters.get(element.tagName.toLowerCase());
    if (byTag != null) {
      return byTag;
    }
    for (const { selector, adapter } of this.matchers) {
      if (element.matches(selector)) {
        return adapter;
      }
    }
    return undefined;
  }

  /**
   * Reads `element`'s value through its adapter if one is registered, else the zero-config default.
   *
   * @param element the bound control
   * @returns the wire-relevant value
   */
  read(element: Element): unknown {
    const adapter = this.adapterFor(element);
    return adapter != null ? adapter.read(element) : defaultReadControlValue(element);
  }

  /**
   * Writes `value` onto `element` through its adapter if registered, else the zero-config default.
   *
   * @param element the bound control
   * @param value the value to set
   */
  write(element: Element, value: unknown): void {
    const adapter = this.adapterFor(element);
    if (adapter != null) {
      adapter.write(element, value);
      return;
    }
    defaultWriteControlValue(element, value);
  }

  /**
   * The DOM event name `l:model` listens to for a given modifier on `element`. Returns the adapter's
   * declared event when present, else the standard event for the modifier.
   *
   * @param element the bound control
   * @param kind which modifier is in effect
   * @returns the event name to listen on
   */
  eventFor(element: Element, kind: "live" | "lazy" | "blur"): string {
    const adapter = this.adapterFor(element);
    if (adapter != null) {
      const declared = kind === "live" ? adapter.liveEvent : kind === "lazy" ? adapter.lazyEvent : adapter.blurEvent;
      if (declared != null) {
        return declared;
      }
    }
    return kind === "live" ? "input" : kind === "lazy" ? "change" : "blur";
  }
}
