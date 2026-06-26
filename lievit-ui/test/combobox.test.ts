/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * combobox (v-next, ADR-0012 progressive-enhancement): a server-rendered WAI-ARIA Combobox
 * with listbox popup. JS-OFF the partial emits a real <input role="combobox">, a <ul role="listbox">
 * (always in the DOM), and a <input type="hidden"> for form POST. JS-ON the `lv-combobox` Stimulus
 * controller (the morph-safe successor to the colocated enhancer) activates filtering, open/close,
 * write-back, and blur commits; keyboard nav is delegated to collection-nav.enhancer.ts.
 *
 * Tests cover:
 *   (a) Partial SOURCE assertions: roles, data-slot names, ARIA, token usage, CSP-clean, and the
 *       Stimulus wiring (data-controller + data-action + data-lv-combobox-target).
 *   (b) Pure filter logic (filterOptions) — DOM-free (still exported by the legacy enhancer module).
 *   (c) Controller behaviour driven through the REAL Stimulus Application + the REAL lievit runtime
 *       (a fetch stub captures the actual `_calls` the runtime POSTs) + the REAL wire morph: open/close,
 *       filter, commit, clear, write-back, blur, keyboard; the controlled/uncontrolled doctrine (both
 *       branches); and morph-safety (one gesture = one effect; a removed node fires nothing).
 */
import { describe, test, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import { resolve } from "../cli/registry.js";
import type { Registry } from "../cli/registry.js";
import { filterOptions, type ComboboxOption } from "../registry/jte/combobox.enhancer.js";
import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";
import { ControlRegistry } from "../runtime/controls.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");
const jteSrc = read("jte/combobox.jte");
/** Strip JTE comments so we are asserting on actual markup patterns, not comment text. */
const jteMarkup = jteSrc.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// (a) Partial source assertions
// ---------------------------------------------------------------------------
describe("combobox partial source (v-next)", () => {
  test("the root carries data-slot=combobox, data-size, data-mode, and data-lievit-combobox", () => {
    expect(jteMarkup).toContain('data-slot="combobox"');
    expect(jteMarkup).toContain("data-size=");
    expect(jteMarkup).toContain("data-mode=");
    expect(jteMarkup).toContain("data-lievit-combobox");
  });

  test("the root mounts the lv-combobox Stimulus controller and wires the blur-commit via data-action", () => {
    expect(jteMarkup).toContain('data-controller="lv-combobox"');
    expect(jteMarkup).toContain("focusout->lv-combobox#onFocusout");
  });

  test("the input is a target and wires input/focus/keydown via data-action (CSP-clean, no inline handler)", () => {
    expect(jteMarkup).toContain('data-lv-combobox-target="input"');
    expect(jteMarkup).toContain("input->lv-combobox#onInput");
    expect(jteMarkup).toContain("focus->lv-combobox#onFocus");
    expect(jteMarkup).toContain("keydown->lv-combobox#onKeydown");
  });

  test("the listbox is a target and wires toggle/mousedown/click via data-action", () => {
    expect(jteMarkup).toContain('data-lv-combobox-target="listbox"');
    expect(jteMarkup).toContain("toggle->lv-combobox#onListboxToggle");
    expect(jteMarkup).toContain("mousedown->lv-combobox#onListboxMousedown");
    expect(jteMarkup).toContain("click->lv-combobox#onOptionClick");
  });

  test("the toggle button + hidden input + control row are targets", () => {
    expect(jteMarkup).toContain('data-lv-combobox-target="toggle"');
    expect(jteMarkup).toContain('data-lv-combobox-target="hidden"');
    expect(jteMarkup).toContain('data-lv-combobox-target="control"');
    expect(jteMarkup).toContain("click->lv-combobox#onToggleClick");
  });

  test("the combobox dropdown is UNCONTROLLED: the listbox carries NO data-lv-wire-close (wire-410 doctrine)", () => {
    // A hardcoded close on this uncontrolled overlay is exactly the page-expired regression.
    expect(jteMarkup).not.toContain("data-lv-wire-close");
  });

  test("the listbox carries NO data-lv-opener: the lv-combobox controller owns the popover, so the shared popover-anchor enhancer skips it (no double-handling)", () => {
    expect(jteMarkup).not.toContain("data-lv-opener");
  });

  test("the text input has role=combobox, aria-expanded, aria-haspopup=listbox, aria-controls, aria-autocomplete, autocomplete=off", () => {
    expect(jteMarkup).toContain('role="combobox"');
    expect(jteMarkup).toContain('aria-expanded="false"');
    expect(jteMarkup).toContain('aria-haspopup="listbox"');
    expect(jteMarkup).toContain("aria-controls=");
    expect(jteMarkup).toContain("aria-autocomplete=");
    expect(jteMarkup).toContain('autocomplete="off"');
  });

  test("the listbox ul has role=listbox, popover=auto (always in DOM), aria-busy, data-lievit-collection", () => {
    expect(jteMarkup).toContain('role="listbox"');
    expect(jteMarkup).toContain('popover="auto"');
    expect(jteMarkup).toContain("aria-busy=");
    expect(jteMarkup).toContain("data-lievit-collection");
  });

  test("the listbox wires collection-nav for aria-activedescendant-target pointing at the input", () => {
    expect(jteMarkup).toContain("data-lievit-collection-activedescendant-target=");
    expect(jteMarkup).toContain("#");
  });

  test("each rendered option has role=option, data-lievit-item, aria-selected, data-combobox-option", () => {
    expect(jteMarkup).toContain('role="option"');
    expect(jteMarkup).toContain("data-lievit-item");
    expect(jteMarkup).toContain("aria-selected=");
    expect(jteMarkup).toContain("data-combobox-option=");
  });

  test("the toggle button has tabindex=-1 and aria-hidden=true (not a tab stop per APG)", () => {
    expect(jteMarkup).toContain('tabindex="-1"');
    expect(jteMarkup).toContain('aria-hidden="true"');
    expect(jteMarkup).toContain('data-slot="combobox-toggle"');
  });

  test("a hidden form input carries the committed value (the POST field)", () => {
    expect(jteMarkup).toContain('data-slot="combobox-hidden"');
    expect(jteMarkup).toContain('type="hidden"');
    expect(jteMarkup).toContain('name="${name}"');
  });

  test("token-driven: colours / spacing / radius come from --lv-* tokens, no raw hex", () => {
    expect(jteMarkup).toContain("var(--lv-color-");
    expect(jteMarkup).toContain("var(--lv-space-");
    expect(jteMarkup).toContain("var(--lv-radius-");
    expect(jteMarkup).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  test("CSP-clean: no inline <script> and no inline on* event handlers (data-action is not an on* handler)", () => {
    expect(jteMarkup).not.toMatch(/<script/i);
    expect(jteMarkup).not.toMatch(/\son[a-z]+\s*=/i);
  });

  test("loading state: aria-busy=true on the listbox + role=status spinner emitted when loading=true", () => {
    expect(jteMarkup).toContain('role="status"');
    expect(jteMarkup).toContain('aria-label="Loading suggestions"');
    expect(jteMarkup).toContain("aria-busy=");
  });

  test("no-results option: role=option aria-disabled=true for the empty state", () => {
    expect(jteMarkup).toContain('aria-disabled="true"');
    expect(jteMarkup).toContain('data-slot="combobox-empty"');
  });

  test("the clear button (clearable path): aria-label=Clear, data-slot=combobox-clear, data-action click->clear", () => {
    expect(jteMarkup).toContain('aria-label="Clear"');
    expect(jteMarkup).toContain('data-slot="combobox-clear"');
    expect(jteMarkup).toContain("click->lv-combobox#clear");
  });

  test("groups path: renders role=group with aria-labelledby referencing the group label div", () => {
    expect(jteMarkup).toContain('role="group"');
    expect(jteMarkup).toContain("aria-labelledby=");
  });

  test("the controller is CSP-clean: no eval / new Function, no Lit import, no inline handler", () => {
    const ts = read("../runtime/stimulus/controllers/lv-combobox-controller.ts");
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bnew Function\b|\beval\(/);
    expect(code).not.toMatch(/^import .*from "lit"/m);
    // The controller reaches the wire only through the shared base (DismissableController), never
    // window.$lievit and never runtime.callAction directly.
    expect(code).not.toMatch(/window\.\$lievit|runtime\.callAction/);
    expect(code).toContain("extends DismissableController");
  });
});

// ---------------------------------------------------------------------------
// (a') Registry item shape
// ---------------------------------------------------------------------------
describe("combobox registry item (v-next)", () => {
  test("combobox is a single registry:jte item", () => {
    const matches = registry.items.filter((i) => i.name === "combobox");
    expect(matches, "exactly one combobox item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:jte");
  });

  test("it ships the .jte (jte root) + the enhancer .ts, no Lit dependency", () => {
    const item = registry.items.find((i) => i.name === "combobox")!;
    const jte = item.files.find((f) => f.target.endsWith(".jte"))!;
    const ts = item.files.find((f) => f.target.endsWith(".ts"))!;
    expect(jte.root).toBe("jte");
    expect(jte.target).toBe("lievit/combobox.jte");
    expect(ts.target).toBe("lievit/combobox.enhancer.ts");
    expect(item.dependencies ?? []).not.toContain("lit");
  });

  test("resolving it pulls the tokens item", () => {
    const closure = resolve(registry, ["combobox"]).map((i) => i.name);
    expect(closure).toContain("combobox");
    expect(closure).toContain("tokens");
  });
});

// ---------------------------------------------------------------------------
// (b) Pure filter logic (DOM-free)
// ---------------------------------------------------------------------------
const opts = (...labels: string[]): ComboboxOption[] =>
  labels.map((label) => ({ value: label.toLowerCase(), label, disabled: false }));

describe("filterOptions (pure)", () => {
  test("an empty query returns every option unchanged, in order", () => {
    const all = opts("Parma", "Reggio", "Milano");
    expect(filterOptions(all, "")).toEqual(all);
    expect(filterOptions(all, "   ")).toEqual(all);
  });

  test("matches a substring anywhere in the label, case-insensitively", () => {
    const all = opts("Parma", "Reggio Emilia", "Milano");
    expect(filterOptions(all, "emil").map((o) => o.label)).toEqual(["Reggio Emilia"]);
    expect(filterOptions(all, "MA").map((o) => o.label)).toEqual(["Parma"]);
  });

  test("accent-insensitive (Citta matches città)", () => {
    const all = opts("Città di Castello", "Parma");
    expect(filterOptions(all, "citta").map((o) => o.label)).toEqual(["Città di Castello"]);
  });

  test("a no-match query yields an empty list", () => {
    expect(filterOptions(opts("Parma", "Milano"), "zzz")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (c) Controller behaviour (real Stimulus + real runtime + real morph)
// ---------------------------------------------------------------------------

/** A fetch-stub-backed runtime that records the `_calls` the wire POSTs (the controlled-overlay seam). */
function makeRuntime(): { runtime: LievitRuntime; calledActions: string[] } {
  const calledActions: string[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls) {
      calledActions.push(...calls);
    }
    return new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } });
  });
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calledActions };
}

interface RenderOpts {
  value?: string;
  mode?: string;
  clearable?: boolean;
  loading?: boolean;
  /** Stamp data-lv-wire-close on the listbox to model a hypothetical server-CONTROLLED combobox. */
  wireClose?: string;
  /** Wrap the combobox in a data-lievit-component root so a wire call can resolve a target. */
  inComponent?: boolean;
}

interface Mounted {
  root: HTMLElement;
  componentRoot: HTMLElement;
  input: HTMLInputElement;
  listbox: HTMLElement;
  hiddenInput: HTMLInputElement;
}

/** Markup for one combobox root exactly as the converted combobox.jte emits it (data-controller +
 *  data-action + data-lv-combobox-target). Returned as an HTML string so a morph can re-render it. */
function comboboxHtml(optionValues: string[], o: RenderOpts = {}): string {
  const { value = "", mode = "select-only", clearable = false, loading = false, wireClose } = o;
  const id = "cb";
  const listboxId = `${id}-listbox`;
  const inputId = `${id}-input`;
  const inputText = value ? value : "";
  const clearBtn =
    clearable && inputText.trim().length > 0
      ? `<button type="button" data-slot="combobox-clear" data-action="click->lv-combobox#clear" aria-label="Clear"></button>`
      : "";
  const spinner = loading
    ? `<li role="status" aria-live="polite" aria-label="Loading suggestions" data-slot="combobox-loading"></li>`
    : "";
  const options = loading
    ? ""
    : optionValues
        .map((v) => {
          const optId = `${id}-opt-${v.replace(/[^A-Za-z0-9]/g, "-")}`;
          const selected = v === value ? "true" : "false";
          return `<li role="option" id="${optId}" data-lievit-item data-slot="combobox-option" aria-selected="${selected}" data-combobox-option="${v}">${v}</li>`;
        })
        .join("");
  const wireCloseAttr = wireClose != null ? ` data-lv-wire-close="${wireClose}"` : "";
  return `
<div data-slot="combobox" data-controller="lv-combobox" data-action="focusout->lv-combobox#onFocusout"
     data-lievit-combobox data-combobox-mode="${mode}" data-combobox-clearable="${clearable}"
     data-combobox-empty-text="No results">
  <div data-slot="combobox-control" data-lv-combobox-target="control">
    ${clearBtn}
    <input type="text" id="${inputId}" data-slot="combobox-input" data-lv-combobox-target="input"
           data-action="input->lv-combobox#onInput focus->lv-combobox#onFocus keydown->lv-combobox#onKeydown"
           role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-controls="${listboxId}"
           aria-autocomplete="list" aria-activedescendant="" autocomplete="off" value="${inputText}">
    <button type="button" data-slot="combobox-toggle" data-lv-combobox-target="toggle"
            data-action="click->lv-combobox#onToggleClick" tabindex="-1" aria-hidden="true"></button>
  </div>
  <ul id="${listboxId}" role="listbox" data-slot="combobox-listbox" data-lv-combobox-target="listbox"
      data-action="toggle->lv-combobox#onListboxToggle mousedown->lv-combobox#onListboxMousedown click->lv-combobox#onOptionClick"
      popover="auto"${wireCloseAttr} data-lievit-collection data-lievit-collection-orientation="vertical"
      data-lievit-collection-wrap="true" data-lievit-collection-activedescendant-target="#${inputId}"
      aria-busy="${loading ? "true" : "false"}">${spinner}${options}</ul>
  <input type="hidden" name="city" value="${value}" data-slot="combobox-hidden" data-lv-combobox-target="hidden">
</div>`;
}

/** Build + attach a combobox, shim the jsdom popover API, and return the live nodes. */
function mount(optionValues: string[], o: RenderOpts = {}): Mounted {
  const componentRoot = document.createElement("div");
  if (o.inComponent ?? false) {
    componentRoot.setAttribute("data-lievit-component", "com.example.C");
    componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
    componentRoot.setAttribute("data-lievit-snapshot", "s1");
  }
  componentRoot.innerHTML = comboboxHtml(optionValues, o);
  document.body.appendChild(componentRoot);

  const root = componentRoot.querySelector<HTMLElement>('[data-slot="combobox"]')!;
  const input = root.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')!;
  const listbox = root.querySelector<HTMLElement>('[data-slot="combobox-listbox"]')!;
  const hiddenInput = root.querySelector<HTMLInputElement>('[data-slot="combobox-hidden"]')!;
  shimPopover(listbox);
  return { root, componentRoot, input, listbox, hiddenInput };
}

/** jsdom/happy-dom lacks the native popover API; the controller relies on data-popover-open which
 *  the shim keeps in sync, and (re)fires the `toggle` event so the controller's listener runs. */
function shimPopover(listbox: HTMLElement): void {
  const anyEl = listbox as unknown as Record<string, unknown>;
  anyEl["showPopover"] = () => listbox.setAttribute("data-popover-open", "");
  anyEl["hidePopover"] = () => listbox.removeAttribute("data-popover-open");
}

/** Dispatch a native-popover ToggleEvent (light-dismiss / click-outside) on the listbox. */
function fireToggle(listbox: Element, newState: "open" | "closed"): void {
  let ev: Event;
  try {
    ev = new ToggleEvent("toggle", { newState, oldState: newState === "open" ? "closed" : "open" });
  } catch {
    ev = new Event("toggle");
    Object.defineProperty(ev, "newState", { value: newState, writable: false });
  }
  listbox.dispatchEvent(ev);
}

function pressKey(el: HTMLElement, key: string, opts: { altKey?: boolean } = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    altKey: opts.altKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(event);
  return event;
}

const getOptions = (listbox: HTMLElement) =>
  Array.from(listbox.querySelectorAll<HTMLElement>(`li[role="option"]:not([hidden])`)).filter(
    (li) => li.getAttribute("data-slot") !== "combobox-empty",
  );

const settle = () => new Promise((r) => setTimeout(r, 10));

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-combobox controller — render contract (real Stimulus)", () => {
  it("input is a combobox with aria-haspopup=listbox + aria-controls -> the listbox, closed", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox } = mount(["Parma", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();

    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-haspopup")).toBe("listbox");
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("the listbox <ul> is in the DOM even when closed (aria-controls must resolve per APG)", async () => {
    const { runtime } = makeRuntime();
    const { listbox } = mount(["Parma"]);
    startStimulus({ runtime });
    await flushStimulus();
    expect(listbox.isConnected).toBe(true);
  });

  it("the committed option has aria-selected=true, the others false", async () => {
    const { runtime } = makeRuntime();
    const { listbox } = mount(["Parma", "Milano", "Roma"], { value: "Milano" });
    startStimulus({ runtime });
    await flushStimulus();
    const options = Array.from(listbox.querySelectorAll<HTMLElement>(`li[role="option"]`));
    const selected = options.find((li) => li.getAttribute("aria-selected") === "true")!;
    expect(selected.getAttribute("data-combobox-option")).toBe("Milano");
    options
      .filter((li) => li !== selected)
      .forEach((li) => expect(li.getAttribute("aria-selected")).toBe("false"));
  });

  it("the hidden form input carries the committed value", async () => {
    const { runtime } = makeRuntime();
    const { hiddenInput } = mount(["Parma", "Milano"], { value: "Parma" });
    startStimulus({ runtime });
    await flushStimulus();
    expect(hiddenInput.type).toBe("hidden");
    expect(hiddenInput.value).toBe("Parma");
  });

  it("no clear button when inputText is empty; present when clearable + value set", async () => {
    const { runtime } = makeRuntime();
    const a = mount(["Parma"]);
    const b = mount(["Parma", "Milano"], { value: "Parma", clearable: true });
    startStimulus({ runtime });
    await flushStimulus();
    expect(a.root.querySelector(`[data-slot="combobox-clear"]`)).toBeNull();
    const clear = b.root.querySelector<HTMLButtonElement>(`[data-slot="combobox-clear"]`);
    expect(clear).not.toBeNull();
    expect(clear!.getAttribute("aria-label")).toBe("Clear");
  });

  it("loading state: listbox aria-busy=true and a role=status spinner", async () => {
    const { runtime } = makeRuntime();
    const { listbox } = mount(["Parma"], { loading: true });
    startStimulus({ runtime });
    await flushStimulus();
    expect(listbox.getAttribute("aria-busy")).toBe("true");
    const spinner = listbox.querySelector(`[role="status"]`)!;
    expect(spinner.getAttribute("aria-label")).toBe("Loading suggestions");
  });
});

describe("lv-combobox controller — interaction (real Stimulus)", () => {
  it("typing filters the options (debounced): non-matching items get [hidden]", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox } = mount(["Parma", "Reggio", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();

    input.value = "ar";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200)); // past the 150ms debounce

    const visible = getOptions(listbox).map((li) => li.getAttribute("data-combobox-option"));
    expect(visible).toEqual(["Parma"]); // only "Parma" contains "ar"
  });

  it("focusing the input opens the listbox", async () => {
    const { runtime } = makeRuntime();
    const { input } = mount(["Parma", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();
    input.dispatchEvent(new FocusEvent("focus"));
    expect(input.getAttribute("aria-expanded")).toBe("true");
  });

  it("option click commits the value, writes back the hidden input, and sets aria-selected", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox, hiddenInput } = mount(["Parma", "Milano", "Roma"]);
    startStimulus({ runtime });
    await flushStimulus();

    input.dispatchEvent(new FocusEvent("focus"));
    const opt = Array.from(listbox.querySelectorAll<HTMLElement>(`li[role="option"]`)).find(
      (li) => li.getAttribute("data-combobox-option") === "Milano",
    )!;
    opt.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(input.value).toBe("Milano");
    expect(hiddenInput.value).toBe("Milano");
    expect(opt.getAttribute("aria-selected")).toBe("true");
    Array.from(listbox.querySelectorAll<HTMLElement>(`li[role="option"]`))
      .filter((li) => li !== opt)
      .forEach((li) => expect(li.getAttribute("aria-selected")).toBe("false"));
  });

  it("select-only: blur with no matching text reverts inputText to the last committed label", async () => {
    const { runtime } = makeRuntime();
    const { input } = mount(["Parma", "Milano"], { value: "Parma", mode: "select-only" });
    startStimulus({ runtime });
    await flushStimulus();

    input.value = "XYZ";
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }));
    expect(input.value).toBe("Parma");
  });

  it("free-type: blur commits the typed text as the value", async () => {
    const { runtime } = makeRuntime();
    const { input, hiddenInput } = mount(["Parma", "Milano"], { mode: "free-type" });
    startStimulus({ runtime });
    await flushStimulus();

    input.value = "CustomCity";
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }));
    expect(hiddenInput.value).toBe("CustomCity");
  });

  it("ArrowDown opens the listbox when closed", async () => {
    const { runtime } = makeRuntime();
    const { input } = mount(["Parma", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();
    pressKey(input, "ArrowDown");
    expect(input.getAttribute("aria-expanded")).toBe("true");
  });

  it("Escape when open closes only, without clearing inputText (APG)", async () => {
    const { runtime } = makeRuntime();
    const { input } = mount(["Parma", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();
    input.value = "Par";
    pressKey(input, "ArrowDown"); // open
    expect(input.getAttribute("aria-expanded")).toBe("true");
    const esc = pressKey(input, "Escape");
    expect(esc.defaultPrevented).toBe(true);
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.value).toBe("Par");
  });

  it("Escape when closed clears (inputText + value emptied)", async () => {
    const { runtime } = makeRuntime();
    const { input, hiddenInput } = mount(["Parma", "Milano"], { value: "Parma" });
    startStimulus({ runtime });
    await flushStimulus();
    expect(input.getAttribute("aria-expanded")).toBe("false");
    const esc = pressKey(input, "Escape");
    expect(esc.defaultPrevented).toBe(true);
    expect(input.value).toBe("");
    expect(hiddenInput.value).toBe("");
  });

  it("Alt+ArrowDown opens without moving the active option", async () => {
    const { runtime } = makeRuntime();
    const { input } = mount(["Parma", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();
    pressKey(input, "ArrowDown", { altKey: true });
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-activedescendant") ?? "").toBe("");
  });

  it("Alt+ArrowUp closes the listbox", async () => {
    const { runtime } = makeRuntime();
    const { input } = mount(["Parma", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();
    pressKey(input, "ArrowDown");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    pressKey(input, "ArrowUp", { altKey: true });
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("Enter in free-type with no active option commits inputText", async () => {
    const { runtime } = makeRuntime();
    const { input, hiddenInput } = mount(["Parma", "Milano"], { mode: "free-type" });
    startStimulus({ runtime });
    await flushStimulus();
    input.value = "CustomCity";
    pressKey(input, "ArrowDown"); // open
    input.setAttribute("aria-activedescendant", "");
    const enter = pressKey(input, "Enter");
    expect(enter.defaultPrevented).toBe(true);
    expect(hiddenInput.value).toBe("CustomCity");
  });

  it("Enter in select-only with no active option is a no-op (Enter not prevented)", async () => {
    const { runtime } = makeRuntime();
    const { input, hiddenInput } = mount(["Parma", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();
    const orig = hiddenInput.value;
    pressKey(input, "ArrowDown");
    input.setAttribute("aria-activedescendant", "");
    const enter = pressKey(input, "Enter");
    expect(enter.defaultPrevented).toBe(false);
    expect(hiddenInput.value).toBe(orig);
  });

  it("Home clears aria-activedescendant but does not prevent the event (platform cursor)", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox } = mount(["Parma", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();
    pressKey(input, "ArrowDown");
    const first = listbox.querySelector<HTMLElement>(`li[role="option"]`)!;
    first.setAttribute("data-active", "");
    input.setAttribute("aria-activedescendant", first.id);
    const homeEv = pressKey(input, "Home");
    expect(input.getAttribute("aria-activedescendant") ?? "").toBe("");
    expect(homeEv.defaultPrevented).toBe(false);
  });

  it("ArrowRight when active clears aria-activedescendant, not prevented (platform cursor)", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox } = mount(["Parma", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();
    pressKey(input, "ArrowDown");
    const first = listbox.querySelector<HTMLElement>(`li[role="option"]`)!;
    first.setAttribute("data-active", "");
    input.setAttribute("aria-activedescendant", first.id);
    const rightEv = pressKey(input, "ArrowRight");
    expect(input.getAttribute("aria-activedescendant") ?? "").toBe("");
    expect(rightEv.defaultPrevented).toBe(false);
  });

  it("the toggle button opens when closed and closes when open; focus never enters the listbox", async () => {
    const { runtime } = makeRuntime();
    const { root, input, listbox } = mount(["Parma", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();
    const toggle = root.querySelector<HTMLButtonElement>(`[data-slot="combobox-toggle"]`)!;
    toggle.click();
    expect(input.getAttribute("aria-expanded")).toBe("true");
    for (const li of Array.from(listbox.querySelectorAll<HTMLElement>(`li[role="option"]`))) {
      expect(document.activeElement).not.toBe(li);
    }
    toggle.click();
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("the clear button empties the value and the hidden input", async () => {
    const { runtime } = makeRuntime();
    const { root, input, hiddenInput } = mount(["Parma", "Milano"], {
      value: "Parma",
      clearable: true,
    });
    startStimulus({ runtime });
    await flushStimulus();
    const clearBtn = root.querySelector<HTMLButtonElement>(`[data-slot="combobox-clear"]`)!;
    clearBtn.click();
    expect(input.value).toBe("");
    expect(hiddenInput.value).toBe("");
  });

  it("a clear button created on the fly (clearable + typed text) is Stimulus-bound and clears", async () => {
    const { runtime } = makeRuntime();
    const { root, input, hiddenInput } = mount(["Parma", "Milano"], { clearable: true });
    startStimulus({ runtime });
    await flushStimulus();
    // No clear button yet (no text). Type, let the debounce + updateClearButton create it.
    input.value = "Par";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    await flushStimulus(); // let Stimulus bind the data-action on the freshly-created button
    const clearBtn = root.querySelector<HTMLButtonElement>(`[data-slot="combobox-clear"]`)!;
    expect(clearBtn).not.toBeNull();
    clearBtn.click();
    expect(input.value).toBe("");
    expect(hiddenInput.value).toBe("");
  });
});

/**
 * Grouped markup exactly as combobox.jte emits it for the `optionGroups` param: a
 * `<li role="presentation" data-slot="combobox-group-wrapper">` carrying a label div + an inner
 * `<ul role="group">` of options. Used to prove the client-side filter hides a whole group whose
 * options all fall out (Filament-style searchable grouped select: "tipologia -> sottotipologia").
 */
function comboboxGroupedHtml(groups: Record<string, string[]>): string {
  const id = "cb";
  const listboxId = `${id}-listbox`;
  const inputId = `${id}-input`;
  let gi = 0;
  const groupsHtml = Object.entries(groups)
    .map(([label, opts]) => {
      const grpId = `${id}-grp-${gi++}`;
      const optsHtml = opts
        .map((v) => {
          const optId = `${id}-opt-${v.replace(/[^A-Za-z0-9]/g, "-")}`;
          return `<li role="option" id="${optId}" data-lievit-item data-slot="combobox-option" aria-selected="false" data-combobox-option="${v}">${v}</li>`;
        })
        .join("");
      return `<li role="presentation" data-slot="combobox-group-wrapper"><div id="${grpId}" role="none" aria-hidden="true" data-slot="combobox-group-label">${label}</div><ul role="group" aria-labelledby="${grpId}">${optsHtml}</ul></li>`;
    })
    .join("");
  return `
<div data-slot="combobox" data-controller="lv-combobox" data-action="focusout->lv-combobox#onFocusout"
     data-lievit-combobox data-combobox-mode="select-only" data-combobox-clearable="false"
     data-combobox-empty-text="No results">
  <div data-slot="combobox-control" data-lv-combobox-target="control">
    <input type="text" id="${inputId}" data-slot="combobox-input" data-lv-combobox-target="input"
           data-action="input->lv-combobox#onInput focus->lv-combobox#onFocus keydown->lv-combobox#onKeydown"
           role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-controls="${listboxId}"
           aria-autocomplete="list" aria-activedescendant="" autocomplete="off" value="">
    <button type="button" data-slot="combobox-toggle" data-lv-combobox-target="toggle"
            data-action="click->lv-combobox#onToggleClick" tabindex="-1" aria-hidden="true"></button>
  </div>
  <ul id="${listboxId}" role="listbox" data-slot="combobox-listbox" data-lv-combobox-target="listbox"
      data-action="toggle->lv-combobox#onListboxToggle mousedown->lv-combobox#onListboxMousedown click->lv-combobox#onOptionClick"
      popover="auto" data-lievit-collection data-lievit-collection-orientation="vertical"
      data-lievit-collection-wrap="true" data-lievit-collection-activedescendant-target="#${inputId}"
      aria-busy="false">${groupsHtml}</ul>
  <input type="hidden" name="city" value="" data-slot="combobox-hidden" data-lv-combobox-target="hidden">
</div>`;
}

function mountGrouped(groups: Record<string, string[]>): {
  root: HTMLElement;
  input: HTMLInputElement;
  listbox: HTMLElement;
} {
  const host = document.createElement("div");
  host.innerHTML = comboboxGroupedHtml(groups);
  document.body.appendChild(host);
  const root = host.querySelector<HTMLElement>('[data-slot="combobox"]')!;
  const input = root.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')!;
  const listbox = root.querySelector<HTMLElement>('[data-slot="combobox-listbox"]')!;
  shimPopover(listbox);
  return { root, input, listbox };
}

const visibleGroups = (listbox: HTMLElement) =>
  Array.from(
    listbox.querySelectorAll<HTMLElement>('[data-slot="combobox-group-wrapper"]:not([hidden])'),
  );

describe("lv-combobox controller — grouped options + client-side filter (Filament searchable grouped select)", () => {
  it("renders grouped options under their group labels (role=group + group-label)", async () => {
    const { runtime } = makeRuntime();
    const { listbox } = mountGrouped({ Emilia: ["Parma", "Reggio"], Lombardia: ["Milano"] });
    startStimulus({ runtime });
    await flushStimulus();
    const groups = visibleGroups(listbox);
    expect(groups).toHaveLength(2);
    expect(groups[0].querySelector('[data-slot="combobox-group-label"]')?.textContent).toBe("Emilia");
    expect(groups[0].querySelectorAll('li[role="option"]')).toHaveLength(2);
  });

  it("typing filters options ACROSS groups (only matching options stay visible)", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox } = mountGrouped({ Emilia: ["Parma", "Reggio"], Lombardia: ["Milano"] });
    startStimulus({ runtime });
    await flushStimulus();

    input.value = "mil";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));

    const visible = getOptions(listbox).map((li) => li.getAttribute("data-combobox-option"));
    expect(visible).toEqual(["Milano"]);
  });

  it("a group whose options ALL fall out of the filter is HIDDEN (no dangling group label)", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox } = mountGrouped({ Emilia: ["Parma", "Reggio"], Lombardia: ["Milano"] });
    startStimulus({ runtime });
    await flushStimulus();

    input.value = "mil"; // matches only Lombardia/Milano
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));

    const groups = visibleGroups(listbox);
    expect(groups).toHaveLength(1);
    expect(groups[0].querySelector('[data-slot="combobox-group-label"]')?.textContent).toBe("Lombardia");
  });

  it("clearing the filter re-shows every group (empty-group hide is reversible)", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox } = mountGrouped({ Emilia: ["Parma", "Reggio"], Lombardia: ["Milano"] });
    startStimulus({ runtime });
    await flushStimulus();

    input.value = "mil";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    expect(visibleGroups(listbox)).toHaveLength(1);

    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    expect(visibleGroups(listbox)).toHaveLength(2);
  });

  it("a query matching nothing hides all groups and shows the empty state", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox } = mountGrouped({ Emilia: ["Parma", "Reggio"], Lombardia: ["Milano"] });
    startStimulus({ runtime });
    await flushStimulus();

    input.value = "zzz";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));

    expect(visibleGroups(listbox)).toHaveLength(0);
    const empty = listbox.querySelector<HTMLElement>('[data-slot="combobox-empty"]:not([hidden])');
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toBe("No results");
  });
});

describe("lv-combobox controller — controlled/uncontrolled doctrine (the wire-410 fix)", () => {
  it("UNCONTROLLED (the production combobox): an open/close cycle makes ZERO wire calls", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { input, listbox } = mount(["Parma", "Milano"], { inComponent: true });
    startStimulus({ runtime });
    await flushStimulus();

    input.dispatchEvent(new FocusEvent("focus")); // open
    fireToggle(listbox, "closed"); // light-dismiss
    input.dispatchEvent(new FocusEvent("focus")); // open
    fireToggle(listbox, "closed");

    await settle();
    expect(calledActions).toHaveLength(0);
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("CONTROLLED (hypothetical server-owned variant): light-dismiss fires the close action exactly once", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { input, listbox } = mount(["Parma", "Milano"], {
      inComponent: true,
      wireClose: "close",
    });
    startStimulus({ runtime });
    await flushStimulus();

    input.dispatchEvent(new FocusEvent("focus")); // open
    fireToggle(listbox, "closed"); // light-dismiss

    await settle();
    expect(calledActions.filter((a) => a === "close")).toHaveLength(1);
  });
});

describe("lv-combobox controller — morph-safety (real lievit morph)", () => {
  it("after a real morph, one option click commits EXACTLY once (no stacked listeners)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot } = mount(["Parma", "Milano", "Roma"], {
      inComponent: true,
      wireClose: "close",
    });
    startStimulus({ runtime });
    await flushStimulus();

    // A real wire morph re-renders the component subtree (idiomorph); identical markup must not
    // double-connect the controller nor stack the toggle/click listeners. The morph target is the
    // component root's full outerHTML (the combobox nested inside the data-lievit-component wrapper).
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2">${comboboxHtml(
        ["Parma", "Milano", "Roma"],
        { wireClose: "close" },
      )}</div>`,
    );
    await flushStimulus();

    const root = componentRoot.querySelector<HTMLElement>('[data-slot="combobox"]')!;
    const input = root.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')!;
    const listbox = root.querySelector<HTMLElement>('[data-slot="combobox-listbox"]')!;
    const hidden = root.querySelector<HTMLInputElement>('[data-slot="combobox-hidden"]')!;
    shimPopover(listbox);

    // The click listener survived the morph: one option click commits + writes back once.
    input.dispatchEvent(new FocusEvent("focus"));
    const opt = Array.from(listbox.querySelectorAll<HTMLElement>(`li[role="option"]`)).find(
      (li) => li.getAttribute("data-combobox-option") === "Milano",
    )!;
    opt.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(hidden.value).toBe("Milano");

    // The toggle listener is single (not stacked): one light-dismiss => the controlled close fires
    // its wire action EXACTLY once. A double-connected controller would fire it twice.
    input.dispatchEvent(new FocusEvent("focus")); // reopen
    fireToggle(listbox, "closed");
    await settle();
    expect(calledActions.filter((a) => a === "close")).toHaveLength(1);
  });

  it("a combobox removed by a morph fires nothing (disconnect tore the listeners down)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot, listbox } = mount(["Parma", "Milano"], {
      inComponent: true,
      wireClose: "close",
    });
    startStimulus({ runtime });
    await flushStimulus();

    morph(
      componentRoot,
      `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The detached listbox's toggle must no longer reach a live controller -> no wire call.
    fireToggle(listbox, "closed");
    await settle();
    expect(calledActions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (d) ENHANCEMENT 1 — a commit fires a native change + input on the hidden input
//     (the wire fix: l:model.live reacts to native change/input, which a programmatic
//      value-set never dispatches; without this a pick never reaches a wire-bound field).
// ---------------------------------------------------------------------------
describe("lv-combobox controller — native change/input on commit (l:model.live wire fix)", () => {
  it("single-select option click fires a bubbling change + input ON the hidden input", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox, hiddenInput, root } = mount(["Parma", "Milano", "Roma"]);
    startStimulus({ runtime });
    await flushStimulus();

    const onHidden: string[] = [];
    hiddenInput.addEventListener("change", () => onHidden.push("change"));
    hiddenInput.addEventListener("input", () => onHidden.push("input"));
    // l:model.live binds on an ancestor: the events must BUBBLE up to it.
    const onRoot: string[] = [];
    root.addEventListener("change", () => onRoot.push("change"));

    input.dispatchEvent(new FocusEvent("focus"));
    const opt = Array.from(listbox.querySelectorAll<HTMLElement>(`li[role="option"]`)).find(
      (li) => li.getAttribute("data-combobox-option") === "Milano",
    )!;
    opt.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(hiddenInput.value).toBe("Milano");
    expect(onHidden).toContain("change");
    expect(onHidden).toContain("input");
    expect(onRoot).toContain("change"); // bubbled to the wire-binding ancestor
  });

  it("the clear button fires a change + input on the hidden input (so the wire sees the emptying)", async () => {
    const { runtime } = makeRuntime();
    const { root, hiddenInput } = mount(["Parma", "Milano"], { value: "Parma", clearable: true });
    startStimulus({ runtime });
    await flushStimulus();

    const events: string[] = [];
    hiddenInput.addEventListener("change", () => events.push("change"));
    hiddenInput.addEventListener("input", () => events.push("input"));

    const clearBtn = root.querySelector<HTMLButtonElement>(`[data-slot="combobox-clear"]`)!;
    clearBtn.click();

    expect(hiddenInput.value).toBe("");
    expect(events).toContain("change");
    expect(events).toContain("input");
  });

  it("free-type blur commit fires a change + input on the hidden input", async () => {
    const { runtime } = makeRuntime();
    const { input, hiddenInput } = mount(["Parma", "Milano"], { mode: "free-type" });
    startStimulus({ runtime });
    await flushStimulus();

    const events: string[] = [];
    hiddenInput.addEventListener("change", () => events.push("change"));
    hiddenInput.addEventListener("input", () => events.push("input"));

    input.value = "CustomCity";
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }));

    expect(hiddenInput.value).toBe("CustomCity");
    expect(events).toContain("change");
    expect(events).toContain("input");
  });
});

// ---------------------------------------------------------------------------
// (e) ENHANCEMENT 2 — multiple-select mode (chips + repeated hidden inputs)
// ---------------------------------------------------------------------------

/** Markup for one MULTIPLE combobox root exactly as combobox.jte emits it for `multiple=true`:
 *  a chips container in the control row, aria-multiselectable on the listbox, and a hidden-list
 *  wrapper holding one `name`-repeated hidden input per committed value. */
function comboboxMultipleHtml(optionValues: string[], selected: string[] = []): string {
  const id = "cb";
  const listboxId = `${id}-listbox`;
  const inputId = `${id}-input`;
  const chips = selected
    .map(
      (v) =>
        `<span data-slot="combobox-chip" data-combobox-chip-value="${v}"><span data-slot="combobox-chip-label">${v}</span><button type="button" data-slot="combobox-chip-remove" data-action="click->lv-combobox#onChipRemove" data-combobox-chip-value="${v}" aria-label="Remove ${v}"></button></span>`,
    )
    .join("");
  const hidden = selected
    .map(
      (v) =>
        `<input type="hidden" name="city" value="${v}" data-slot="combobox-hidden" data-combobox-hidden-value="${v}">`,
    )
    .join("");
  const options = optionValues
    .map((v) => {
      const optId = `${id}-opt-${v.replace(/[^A-Za-z0-9]/g, "-")}`;
      const sel = selected.includes(v) ? "true" : "false";
      return `<li role="option" id="${optId}" data-lievit-item data-slot="combobox-option" aria-selected="${sel}" data-combobox-option="${v}">${v}</li>`;
    })
    .join("");
  return `
<div data-slot="combobox" data-controller="lv-combobox" data-action="focusout->lv-combobox#onFocusout"
     data-lievit-combobox data-combobox-mode="select-only" data-combobox-multiple="true"
     data-combobox-clearable="false" data-combobox-empty-text="No results">
  <div data-slot="combobox-control" data-lv-combobox-target="control">
    <div data-slot="combobox-chips">${chips}</div>
    <input type="text" id="${inputId}" data-slot="combobox-input" data-lv-combobox-target="input"
           data-action="input->lv-combobox#onInput focus->lv-combobox#onFocus keydown->lv-combobox#onKeydown"
           role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-controls="${listboxId}"
           aria-autocomplete="list" aria-activedescendant="" autocomplete="off" value="">
    <button type="button" data-slot="combobox-toggle" data-lv-combobox-target="toggle"
            data-action="click->lv-combobox#onToggleClick" tabindex="-1" aria-hidden="true"></button>
  </div>
  <ul id="${listboxId}" role="listbox" data-slot="combobox-listbox" data-lv-combobox-target="listbox"
      data-action="toggle->lv-combobox#onListboxToggle mousedown->lv-combobox#onListboxMousedown click->lv-combobox#onOptionClick"
      popover="auto" aria-multiselectable="true" data-lievit-collection data-lievit-collection-orientation="vertical"
      data-lievit-collection-wrap="true" data-lievit-collection-activedescendant-target="#${inputId}"
      aria-busy="false">${options}</ul>
  <div data-slot="combobox-hidden-list" data-combobox-name="city" hidden>${hidden}</div>
</div>`;
}

interface MountedMultiple {
  root: HTMLElement;
  input: HTMLInputElement;
  listbox: HTMLElement;
  chips: HTMLElement;
  hiddenList: HTMLElement;
}

function mountMultiple(optionValues: string[], selected: string[] = []): MountedMultiple {
  const host = document.createElement("div");
  host.innerHTML = comboboxMultipleHtml(optionValues, selected);
  document.body.appendChild(host);
  const root = host.querySelector<HTMLElement>('[data-slot="combobox"]')!;
  const input = root.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')!;
  const listbox = root.querySelector<HTMLElement>('[data-slot="combobox-listbox"]')!;
  const chips = root.querySelector<HTMLElement>('[data-slot="combobox-chips"]')!;
  const hiddenList = root.querySelector<HTMLElement>('[data-slot="combobox-hidden-list"]')!;
  shimPopover(listbox);
  return { root, input, listbox, chips, hiddenList };
}

const clickOption = (listbox: HTMLElement, value: string): void => {
  const opt = Array.from(listbox.querySelectorAll<HTMLElement>(`li[role="option"]`)).find(
    (li) => li.getAttribute("data-combobox-option") === value,
  )!;
  opt.dispatchEvent(new MouseEvent("click", { bubbles: true }));
};

const hiddenValues = (hiddenList: HTMLElement): string[] =>
  Array.from(
    hiddenList.querySelectorAll<HTMLInputElement>(`input[data-slot="combobox-hidden"]`),
  ).map((i) => i.value);

const chipValues = (chips: HTMLElement): string[] =>
  Array.from(chips.querySelectorAll<HTMLElement>(`[data-slot="combobox-chip"]`)).map(
    (c) => c.getAttribute("data-combobox-chip-value") ?? "",
  );

describe("lv-combobox controller — multiple-select mode (chips + repeated hidden inputs)", () => {
  it("the listbox advertises aria-multiselectable=true", async () => {
    const { runtime } = makeRuntime();
    const { listbox } = mountMultiple(["Parma", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();
    expect(listbox.getAttribute("aria-multiselectable")).toBe("true");
  });

  it("seeds chips + repeated hidden inputs from the server-rendered selected values", async () => {
    const { runtime } = makeRuntime();
    const { chips, hiddenList } = mountMultiple(["Parma", "Milano", "Roma"], ["Parma", "Roma"]);
    startStimulus({ runtime });
    await flushStimulus();
    expect(chipValues(chips)).toEqual(["Parma", "Roma"]);
    expect(hiddenValues(hiddenList)).toEqual(["Parma", "Roma"]);
  });

  it("clicking options ADDS them: listbox stays OPEN, N hidden inputs + chips, aria-selected set, change fires each add", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox, chips, hiddenList } = mountMultiple(["Parma", "Milano", "Roma"]);
    startStimulus({ runtime });
    await flushStimulus();

    const changes: number[] = [];
    hiddenList.addEventListener("change", () => changes.push(1));

    input.dispatchEvent(new FocusEvent("focus"));
    clickOption(listbox, "Parma");
    expect(input.getAttribute("aria-expanded")).toBe("true"); // ADD does not close
    clickOption(listbox, "Milano");

    expect(hiddenValues(hiddenList)).toEqual(["Parma", "Milano"]); // carries N values under `name`
    expect(chipValues(chips)).toEqual(["Parma", "Milano"]);
    expect(
      listbox
        .querySelector(`li[data-combobox-option="Parma"]`)!
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(changes.length).toBe(2); // one change per add
  });

  it("the search box resets after each add so the next query starts fresh (tag-input UX)", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox } = mountMultiple(["Parma", "Reggio", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();

    input.value = "mil";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    expect(getOptions(listbox).map((li) => li.getAttribute("data-combobox-option"))).toEqual([
      "Milano",
    ]);

    clickOption(listbox, "Milano");
    expect(input.value).toBe(""); // search reset
    expect(getOptions(listbox).map((li) => li.getAttribute("data-combobox-option"))).toEqual([
      "Parma",
      "Reggio",
      "Milano",
    ]); // filter cleared -> every option visible again
  });

  it("clicking a SELECTED option again REMOVES it (toggle off): chip + hidden drop, aria-selected=false, change fires", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox, chips, hiddenList } = mountMultiple(["Parma", "Milano"], ["Parma"]);
    startStimulus({ runtime });
    await flushStimulus();

    const changes: number[] = [];
    hiddenList.addEventListener("change", () => changes.push(1));

    input.dispatchEvent(new FocusEvent("focus"));
    clickOption(listbox, "Parma");

    expect(hiddenValues(hiddenList)).toEqual([]);
    expect(chipValues(chips)).toEqual([]);
    expect(
      listbox.querySelector(`li[data-combobox-option="Parma"]`)!.getAttribute("aria-selected"),
    ).toBe("false");
    expect(changes.length).toBe(1);
  });

  it("a chip's remove button deselects its value (chip + hidden input + aria-selected) and fires change", async () => {
    const { runtime } = makeRuntime();
    const { listbox, chips, hiddenList } = mountMultiple(["Parma", "Milano"], ["Parma", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();

    const changes: number[] = [];
    hiddenList.addEventListener("change", () => changes.push(1));

    const removeBtn = Array.from(
      chips.querySelectorAll<HTMLButtonElement>(`[data-slot="combobox-chip-remove"]`),
    ).find((b) => b.getAttribute("data-combobox-chip-value") === "Parma")!;
    removeBtn.click(); // Stimulus-bound data-action

    expect(hiddenValues(hiddenList)).toEqual(["Milano"]);
    expect(chipValues(chips)).toEqual(["Milano"]);
    expect(
      listbox.querySelector(`li[data-combobox-option="Parma"]`)!.getAttribute("aria-selected"),
    ).toBe("false");
    expect(changes.length).toBe(1);
  });

  it("Escape when closed clears ALL selected values (chips + hidden) and fires change", async () => {
    const { runtime } = makeRuntime();
    const { input, chips, hiddenList } = mountMultiple(["Parma", "Milano"], ["Parma", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();

    const changes: number[] = [];
    hiddenList.addEventListener("change", () => changes.push(1));

    expect(input.getAttribute("aria-expanded")).toBe("false");
    pressKey(input, "Escape");

    expect(hiddenValues(hiddenList)).toEqual([]);
    expect(chipValues(chips)).toEqual([]);
    expect(changes.length).toBe(1);
  });

  it("blur in multiple mode resets the search box but never touches the committed selection", async () => {
    const { runtime } = makeRuntime();
    const { input, chips, hiddenList } = mountMultiple(["Parma", "Milano"], ["Parma"]);
    startStimulus({ runtime });
    await flushStimulus();

    input.value = "mil";
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }));

    expect(input.value).toBe(""); // search reset
    expect(hiddenValues(hiddenList)).toEqual(["Parma"]); // selection intact
    expect(chipValues(chips)).toEqual(["Parma"]);
  });
});

/** Grouped MULTIPLE markup: optgroups + multiple, to prove searchable + optgroups still work in
 *  multi-select mode (the Filament "searchable grouped multi-select" shape). */
function comboboxGroupedMultipleHtml(groups: Record<string, string[]>): string {
  const id = "cb";
  const listboxId = `${id}-listbox`;
  const inputId = `${id}-input`;
  let gi = 0;
  const groupsHtml = Object.entries(groups)
    .map(([label, opts]) => {
      const grpId = `${id}-grp-${gi++}`;
      const optsHtml = opts
        .map((v) => {
          const optId = `${id}-opt-${v.replace(/[^A-Za-z0-9]/g, "-")}`;
          return `<li role="option" id="${optId}" data-lievit-item data-slot="combobox-option" aria-selected="false" data-combobox-option="${v}">${v}</li>`;
        })
        .join("");
      return `<li role="presentation" data-slot="combobox-group-wrapper"><div id="${grpId}" role="none" aria-hidden="true" data-slot="combobox-group-label">${label}</div><ul role="group" aria-labelledby="${grpId}">${optsHtml}</ul></li>`;
    })
    .join("");
  return `
<div data-slot="combobox" data-controller="lv-combobox" data-action="focusout->lv-combobox#onFocusout"
     data-lievit-combobox data-combobox-mode="select-only" data-combobox-multiple="true"
     data-combobox-clearable="false" data-combobox-empty-text="No results">
  <div data-slot="combobox-control" data-lv-combobox-target="control">
    <div data-slot="combobox-chips"></div>
    <input type="text" id="${inputId}" data-slot="combobox-input" data-lv-combobox-target="input"
           data-action="input->lv-combobox#onInput focus->lv-combobox#onFocus keydown->lv-combobox#onKeydown"
           role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-controls="${listboxId}"
           aria-autocomplete="list" aria-activedescendant="" autocomplete="off" value="">
    <button type="button" data-slot="combobox-toggle" data-lv-combobox-target="toggle"
            data-action="click->lv-combobox#onToggleClick" tabindex="-1" aria-hidden="true"></button>
  </div>
  <ul id="${listboxId}" role="listbox" data-slot="combobox-listbox" data-lv-combobox-target="listbox"
      data-action="toggle->lv-combobox#onListboxToggle mousedown->lv-combobox#onListboxMousedown click->lv-combobox#onOptionClick"
      popover="auto" aria-multiselectable="true" data-lievit-collection data-lievit-collection-orientation="vertical"
      data-lievit-collection-wrap="true" data-lievit-collection-activedescendant-target="#${inputId}"
      aria-busy="false">${groupsHtml}</ul>
  <div data-slot="combobox-hidden-list" data-combobox-name="city" hidden></div>
</div>`;
}

describe("lv-combobox controller — multiple + groups (searchable grouped multi-select)", () => {
  it("filtering across groups still works in multiple mode, and adding from a group carries the value", async () => {
    const { runtime } = makeRuntime();
    const host = document.createElement("div");
    host.innerHTML = comboboxGroupedMultipleHtml({
      Emilia: ["Parma", "Reggio"],
      Lombardia: ["Milano"],
    });
    document.body.appendChild(host);
    const root = host.querySelector<HTMLElement>('[data-slot="combobox"]')!;
    const input = root.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')!;
    const listbox = root.querySelector<HTMLElement>('[data-slot="combobox-listbox"]')!;
    const hiddenList = root.querySelector<HTMLElement>('[data-slot="combobox-hidden-list"]')!;
    shimPopover(listbox);
    startStimulus({ runtime });
    await flushStimulus();

    input.value = "mil";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));

    const visible = getOptions(listbox).map((li) => li.getAttribute("data-combobox-option"));
    expect(visible).toEqual(["Milano"]); // filtered across groups

    // a group whose options all fall out is hidden (no dangling header) — same as single mode
    expect(
      Array.from(
        listbox.querySelectorAll<HTMLElement>(
          '[data-slot="combobox-group-wrapper"]:not([hidden])',
        ),
      ),
    ).toHaveLength(1);

    clickOption(listbox, "Milano");
    expect(hiddenValues(hiddenList)).toEqual(["Milano"]); // added from within a group
    expect(input.getAttribute("aria-expanded")).toBe("true"); // stays open
  });
});

// ---------------------------------------------------------------------------
// (f) Multiple-mode partial SOURCE assertions (the JTE markup the controller relies on)
// ---------------------------------------------------------------------------
describe("combobox partial source — multiple mode (v-next)", () => {
  test("the root exposes data-combobox-multiple so the controller can branch", () => {
    expect(jteMarkup).toContain("data-combobox-multiple=");
  });

  test("multiple mode renders a chips container + removable chip with a CSP-clean remove action", () => {
    expect(jteMarkup).toContain('data-slot="combobox-chips"');
    expect(jteMarkup).toContain('data-slot="combobox-chip"');
    expect(jteMarkup).toContain('data-slot="combobox-chip-remove"');
    expect(jteMarkup).toContain("click->lv-combobox#onChipRemove");
  });

  test("multiple mode carries the committed values as repeated hidden inputs under the same name", () => {
    expect(jteMarkup).toContain('data-slot="combobox-hidden-list"');
    expect(jteMarkup).toContain("data-combobox-name=");
    // the repeated hidden input still POSTs under name (single + multiple both contain name="${name}")
    expect(jteMarkup).toContain('name="${name}"');
  });

  test("the listbox advertises aria-multiselectable in multiple mode", () => {
    expect(jteMarkup).toContain("aria-multiselectable=");
  });

  test("multiple-mode markup stays CSP-clean: no inline <script>, no on* handlers", () => {
    // (covered globally too, but assert against the chips/remove additions explicitly)
    expect(jteMarkup).not.toMatch(/<script/i);
    expect(jteMarkup).not.toMatch(/\son[a-z]+\s*=/i);
  });
});

// ---------------------------------------------------------------------------
// (g) value != label SOURCE assertions (the JTE contract the controller relies on)
// ---------------------------------------------------------------------------
describe("combobox partial source — value != label (optionPairs) + JS-off submit name", () => {
  test("declares the optionPairs param (value -> label option source)", () => {
    expect(jteSrc).toContain("@param java.util.Map<String, String> optionPairs");
  });

  test("the value != label option still carries data-combobox-option (the posted VALUE), text = LABEL", () => {
    // the optionPairs branch renders the value in data-combobox-option and the label as the text node
    expect(jteMarkup).toContain("data-combobox-option=");
    expect(jteMarkup).toContain("${_plbl}"); // the LABEL is the option's visible text
    expect(jteMarkup).toContain("optionPairs.entrySet()");
  });

  test("FIX B2: the JS-off native <select> carries the REAL name, not name-native", () => {
    expect(jteMarkup).toContain("data-combobox-native");
    expect(jteMarkup).not.toContain("${name}-native"); // the wrong/ignored field name is gone
  });

  test("FIX B2: the hidden carrier(s) are rendered disabled (JS-off the native submits; the controller flips ownership on connect)", () => {
    // both the single hidden input and the repeated multiple ones carry `disabled`
    expect(jteMarkup).toMatch(/data-slot="combobox-hidden"[\s\S]*?disabled/);
  });
});

// ---------------------------------------------------------------------------
// (h) value != label CONTROLLER behaviour (real Stimulus) + JS-off ownership handoff + wire READ
// ---------------------------------------------------------------------------

interface VLPair {
  value: string;
  label: string;
}

/** Markup for a SINGLE value!=label combobox exactly as combobox.jte emits it: each option's
 *  data-combobox-option is the VALUE (posted id), its text is the LABEL; the trigger shows the
 *  committed value's LABEL; the hidden carrier is `disabled` and the native <select> carries the
 *  real `name` (JS-off submit), the pair the controller's connect() flips ownership between. */
function comboboxVLHtml(pairs: VLPair[], o: { value?: string; mode?: string } = {}): string {
  const { value = "", mode = "select-only" } = o;
  const id = "cb";
  const listboxId = `${id}-listbox`;
  const inputId = `${id}-input`;
  const committed = pairs.find((p) => p.value === value);
  const inputText = committed ? committed.label : "";
  const options = pairs
    .map((p) => {
      const optId = `${id}-opt-${p.value.replace(/[^A-Za-z0-9]/g, "-")}`;
      const selected = p.value === value ? "true" : "false";
      return `<li role="option" id="${optId}" data-lievit-item data-slot="combobox-option" aria-selected="${selected}" data-combobox-option="${p.value}">${p.label}</li>`;
    })
    .join("");
  const nativeOpts = pairs
    .map((p) => `<option value="${p.value}"${p.value === value ? " selected" : ""}>${p.label}</option>`)
    .join("");
  return `
<div data-slot="combobox" data-controller="lv-combobox" data-action="focusout->lv-combobox#onFocusout"
     data-lievit-combobox data-combobox-mode="${mode}" data-combobox-clearable="false"
     data-combobox-empty-text="No results">
  <div data-slot="combobox-control" data-lv-combobox-target="control">
    <input type="text" id="${inputId}" data-slot="combobox-input" data-lv-combobox-target="input"
           data-action="input->lv-combobox#onInput focus->lv-combobox#onFocus keydown->lv-combobox#onKeydown"
           role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-controls="${listboxId}"
           aria-autocomplete="list" aria-activedescendant="" autocomplete="off" value="${inputText}">
    <button type="button" data-slot="combobox-toggle" data-lv-combobox-target="toggle"
            data-action="click->lv-combobox#onToggleClick" tabindex="-1" aria-hidden="true"></button>
  </div>
  <ul id="${listboxId}" role="listbox" data-slot="combobox-listbox" data-lv-combobox-target="listbox"
      data-action="toggle->lv-combobox#onListboxToggle mousedown->lv-combobox#onListboxMousedown click->lv-combobox#onOptionClick"
      popover="auto" data-lievit-collection data-lievit-collection-orientation="vertical"
      data-lievit-collection-wrap="true" data-lievit-collection-activedescendant-target="#${inputId}"
      aria-busy="false">${options}</ul>
  <input type="hidden" name="assignee" value="${value}" data-slot="combobox-hidden" data-lv-combobox-target="hidden" disabled>
  <div data-slot="combobox-native-wrapper" class="sr-only" aria-hidden="true">
    <select data-combobox-native id="${id}-native" name="assignee" tabindex="-1" aria-hidden="true">${nativeOpts}</select>
  </div>
</div>`;
}

interface MountedVL {
  root: HTMLElement;
  input: HTMLInputElement;
  listbox: HTMLElement;
  hiddenInput: HTMLInputElement;
  native: HTMLSelectElement;
}

function mountVL(pairs: VLPair[], o: { value?: string; mode?: string } = {}): MountedVL {
  const host = document.createElement("div");
  host.innerHTML = comboboxVLHtml(pairs, o);
  document.body.appendChild(host);
  const root = host.querySelector<HTMLElement>('[data-slot="combobox"]')!;
  const input = root.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')!;
  const listbox = root.querySelector<HTMLElement>('[data-slot="combobox-listbox"]')!;
  const hiddenInput = root.querySelector<HTMLInputElement>('[data-slot="combobox-hidden"]')!;
  const native = root.querySelector<HTMLSelectElement>("[data-combobox-native]")!;
  shimPopover(listbox);
  return { root, input, listbox, hiddenInput, native };
}

/** Markup for a MULTIPLE value!=label combobox: chips show LABELs, the repeated (disabled) hidden
 *  inputs carry VALUEs, the native multi-select carries the real `name`. */
function comboboxMultipleVLHtml(pairs: VLPair[], selected: string[] = []): string {
  const id = "cb";
  const listboxId = `${id}-listbox`;
  const inputId = `${id}-input`;
  const labelOf = (v: string) => pairs.find((p) => p.value === v)?.label ?? v;
  const chips = selected
    .map(
      (v) =>
        `<span data-slot="combobox-chip" data-combobox-chip-value="${v}"><span data-slot="combobox-chip-label">${labelOf(
          v,
        )}</span><button type="button" data-slot="combobox-chip-remove" data-action="click->lv-combobox#onChipRemove" data-combobox-chip-value="${v}" aria-label="Remove ${labelOf(
          v,
        )}"></button></span>`,
    )
    .join("");
  const hidden = selected
    .map(
      (v) =>
        `<input type="hidden" name="relations" value="${v}" data-slot="combobox-hidden" data-combobox-hidden-value="${v}" disabled>`,
    )
    .join("");
  const options = pairs
    .map((p) => {
      const optId = `${id}-opt-${p.value.replace(/[^A-Za-z0-9]/g, "-")}`;
      const sel = selected.includes(p.value) ? "true" : "false";
      return `<li role="option" id="${optId}" data-lievit-item data-slot="combobox-option" aria-selected="${sel}" data-combobox-option="${p.value}">${p.label}</li>`;
    })
    .join("");
  const nativeOpts = pairs
    .map(
      (p) => `<option value="${p.value}"${selected.includes(p.value) ? " selected" : ""}>${p.label}</option>`,
    )
    .join("");
  return `
<div data-slot="combobox" data-controller="lv-combobox" data-action="focusout->lv-combobox#onFocusout"
     data-lievit-combobox data-combobox-mode="select-only" data-combobox-multiple="true"
     data-combobox-clearable="false" data-combobox-empty-text="No results">
  <div data-slot="combobox-control" data-lv-combobox-target="control">
    <div data-slot="combobox-chips">${chips}</div>
    <input type="text" id="${inputId}" data-slot="combobox-input" data-lv-combobox-target="input"
           data-action="input->lv-combobox#onInput focus->lv-combobox#onFocus keydown->lv-combobox#onKeydown"
           role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-controls="${listboxId}"
           aria-autocomplete="list" aria-activedescendant="" autocomplete="off" value="">
    <button type="button" data-slot="combobox-toggle" data-lv-combobox-target="toggle"
            data-action="click->lv-combobox#onToggleClick" tabindex="-1" aria-hidden="true"></button>
  </div>
  <ul id="${listboxId}" role="listbox" data-slot="combobox-listbox" data-lv-combobox-target="listbox"
      data-action="toggle->lv-combobox#onListboxToggle mousedown->lv-combobox#onListboxMousedown click->lv-combobox#onOptionClick"
      popover="auto" aria-multiselectable="true" data-lievit-collection data-lievit-collection-orientation="vertical"
      data-lievit-collection-wrap="true" data-lievit-collection-activedescendant-target="#${inputId}"
      aria-busy="false">${options}</ul>
  <div data-slot="combobox-hidden-list" data-combobox-name="relations" hidden>${hidden}</div>
  <div data-slot="combobox-native-wrapper" class="sr-only" aria-hidden="true">
    <select data-combobox-native id="${id}-native" name="relations" multiple tabindex="-1" aria-hidden="true">${nativeOpts}</select>
  </div>
</div>`;
}

function mountMultipleVL(
  pairs: VLPair[],
  selected: string[] = [],
): { root: HTMLElement; input: HTMLInputElement; listbox: HTMLElement; chips: HTMLElement; hiddenList: HTMLElement; native: HTMLSelectElement } {
  const host = document.createElement("div");
  host.innerHTML = comboboxMultipleVLHtml(pairs, selected);
  document.body.appendChild(host);
  const root = host.querySelector<HTMLElement>('[data-slot="combobox"]')!;
  const input = root.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')!;
  const listbox = root.querySelector<HTMLElement>('[data-slot="combobox-listbox"]')!;
  const chips = root.querySelector<HTMLElement>('[data-slot="combobox-chips"]')!;
  const hiddenList = root.querySelector<HTMLElement>('[data-slot="combobox-hidden-list"]')!;
  const native = root.querySelector<HTMLSelectElement>("[data-combobox-native]")!;
  shimPopover(listbox);
  return { root, input, listbox, chips, hiddenList, native };
}

const chipLabels = (chips: HTMLElement): string[] =>
  Array.from(chips.querySelectorAll<HTMLElement>('[data-slot="combobox-chip-label"]')).map(
    (c) => c.textContent ?? "",
  );

const PEOPLE: VLPair[] = [
  { value: "jdoe", label: "John Doe" },
  { value: "asmith", label: "Anna Smith" },
  { value: "mrossi", label: "Mario Rossi" },
];

describe("lv-combobox controller — value != label (single)", () => {
  it("seed: the trigger shows the committed value's LABEL, the hidden carries the VALUE", async () => {
    const { runtime } = makeRuntime();
    const { input, hiddenInput } = mountVL(PEOPLE, { value: "jdoe" });
    startStimulus({ runtime });
    await flushStimulus();
    expect(input.value).toBe("John Doe"); // LABEL, not the posted id
    expect(hiddenInput.value).toBe("jdoe"); // VALUE (the posted id)
  });

  it("option click commits: hidden gets the VALUE, the trigger shows the LABEL, a native change fires", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox, hiddenInput } = mountVL(PEOPLE);
    startStimulus({ runtime });
    await flushStimulus();

    const events: string[] = [];
    hiddenInput.addEventListener("change", () => events.push("change"));

    input.dispatchEvent(new FocusEvent("focus"));
    clickOption(listbox, "asmith"); // pick Anna Smith (value=asmith)

    expect(hiddenInput.value).toBe("asmith"); // VALUE committed
    expect(input.value).toBe("Anna Smith"); // LABEL displayed
    expect(events).toContain("change");
  });

  it("filter matches the LABEL the user sees (not the posted value)", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox } = mountVL(PEOPLE);
    startStimulus({ runtime });
    await flushStimulus();

    input.value = "anna"; // a label substring; the value "asmith" does NOT contain it
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));

    const visible = getOptions(listbox).map((li) => li.getAttribute("data-combobox-option"));
    expect(visible).toEqual(["asmith"]); // matched by LABEL "Anna Smith", carries VALUE asmith
  });

  it("select-only blur reverts the trigger to the committed value's LABEL", async () => {
    const { runtime } = makeRuntime();
    const { input } = mountVL(PEOPLE, { value: "mrossi", mode: "select-only" });
    startStimulus({ runtime });
    await flushStimulus();

    input.value = "zzz";
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }));
    expect(input.value).toBe("Mario Rossi"); // reverts to the LABEL, not "mrossi"
  });

  it("back-compat: a value == label combobox still commits the value unchanged", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox, hiddenInput } = mount(["Parma", "Milano"]);
    startStimulus({ runtime });
    await flushStimulus();
    input.dispatchEvent(new FocusEvent("focus"));
    clickOption(listbox, "Milano");
    expect(input.value).toBe("Milano");
    expect(hiddenInput.value).toBe("Milano"); // value == label, unchanged
  });
});

describe("lv-combobox controller — value != label (multiple)", () => {
  it("seed: chips show LABELs, the repeated hidden inputs carry VALUEs", async () => {
    const { runtime } = makeRuntime();
    const { chips, hiddenList } = mountMultipleVL(PEOPLE, ["jdoe", "mrossi"]);
    startStimulus({ runtime });
    await flushStimulus();
    expect(chipLabels(chips)).toEqual(["John Doe", "Mario Rossi"]); // LABELs
    expect(hiddenValues(hiddenList)).toEqual(["jdoe", "mrossi"]); // VALUEs
  });

  it("adding an option appends a LABEL chip + a VALUE hidden input", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox, chips, hiddenList } = mountMultipleVL(PEOPLE, ["jdoe"]);
    startStimulus({ runtime });
    await flushStimulus();

    input.dispatchEvent(new FocusEvent("focus"));
    clickOption(listbox, "asmith"); // add Anna Smith

    expect(chipLabels(chips)).toEqual(["John Doe", "Anna Smith"]); // LABELs shown
    expect(hiddenValues(hiddenList)).toEqual(["jdoe", "asmith"]); // VALUEs posted
    expect(input.getAttribute("aria-expanded")).toBe("true"); // stays open (multi-pick)
  });
});

describe("lv-combobox controller — JS-off/JS-on submit ownership handoff (FIX B2)", () => {
  it("single: on connect the controller disables the native <select> and enables the hidden carrier", async () => {
    const { runtime } = makeRuntime();
    const { hiddenInput, native } = mountVL(PEOPLE, { value: "jdoe" });
    // Pre-connect (JS-off shape): hidden disabled, native enabled + carries the real name.
    expect(hiddenInput.disabled).toBe(true);
    expect(native.disabled).toBe(false);
    expect(native.getAttribute("name")).toBe("assignee");

    startStimulus({ runtime });
    await flushStimulus();

    // Post-connect (JS-on): exactly the hidden input submits under `name`; the native one does not.
    expect(native.disabled).toBe(true);
    expect(hiddenInput.disabled).toBe(false);
    expect(hiddenInput.getAttribute("name")).toBe("assignee");
  });

  it("multiple: on connect the native <select> is disabled and every repeated hidden input is enabled", async () => {
    const { runtime } = makeRuntime();
    const { hiddenList, native } = mountMultipleVL(PEOPLE, ["jdoe", "asmith"]);
    expect(native.disabled).toBe(false);
    startStimulus({ runtime });
    await flushStimulus();
    expect(native.disabled).toBe(true);
    const inputs = Array.from(
      hiddenList.querySelectorAll<HTMLInputElement>('input[data-slot="combobox-hidden"]'),
    );
    expect(inputs.every((i) => !i.disabled)).toBe(true);
    expect(inputs.map((i) => i.getAttribute("name"))).toEqual(["relations", "relations"]);
  });
});

describe("ControlRegistry — combobox wire READ adapter (FIX B4)", () => {
  it("single: read() returns the committed VALUE from the hidden input, not the div textContent", async () => {
    const { runtime } = makeRuntime();
    const { root, input, listbox, hiddenInput } = mountVL(PEOPLE, { value: "jdoe" });
    startStimulus({ runtime });
    await flushStimulus();

    expect(runtime.controls.read(root)).toBe("jdoe"); // initial committed VALUE
    input.dispatchEvent(new FocusEvent("focus"));
    clickOption(listbox, "asmith");
    expect(hiddenInput.value).toBe("asmith");
    expect(runtime.controls.read(root)).toBe("asmith"); // re-read after commit: the new VALUE
  });

  it("multiple: read() returns the LIST of committed VALUEs from the repeated hidden inputs", async () => {
    const { runtime } = makeRuntime();
    const { root, input, listbox } = mountMultipleVL(PEOPLE, ["jdoe"]);
    startStimulus({ runtime });
    await flushStimulus();

    expect(runtime.controls.read(root)).toEqual(["jdoe"]);
    input.dispatchEvent(new FocusEvent("focus"));
    clickOption(listbox, "mrossi");
    expect(runtime.controls.read(root)).toEqual(["jdoe", "mrossi"]);
  });

  it("a fresh ControlRegistry resolves the combobox adapter by selector (zero adopter config)", () => {
    const { root } = mountVL(PEOPLE, { value: "asmith" });
    const registry = new ControlRegistry();
    expect(registry.read(root)).toBe("asmith");
  });

  it("the default read is unchanged for a non-combobox element (a plain div reads textContent)", () => {
    const div = document.createElement("div");
    div.textContent = "plain";
    document.body.appendChild(div);
    const registry = new ControlRegistry();
    expect(registry.read(div)).toBe("plain");
  });
});

// ---------------------------------------------------------------------------
// (j) GROUPED value != label (optionGroupPairs): optgroups whose options post a VALUE, show a LABEL
// ---------------------------------------------------------------------------

/** Markup for a grouped value!=label combobox exactly as combobox.jte emits it for `optionGroupPairs`:
 *  a group wrapper (label div + inner role="group" <ul>) whose options carry the VALUE in
 *  data-combobox-option and show the LABEL as their text. Single or multiple. */
function comboboxGroupedVLHtml(
  groups: Record<string, VLPair[]>,
  o: { value?: string; multiple?: boolean; selected?: string[] } = {},
): string {
  const { value = "", multiple = false, selected = [] } = o;
  const id = "cb";
  const listboxId = `${id}-listbox`;
  const inputId = `${id}-input`;
  const isSel = (v: string) => (multiple ? selected.includes(v) : v === value);
  let gi = 0;
  const groupsHtml = Object.entries(groups)
    .map(([label, pairs]) => {
      const grpId = `${id}-grp-${gi++}`;
      const optsHtml = pairs
        .map((p) => {
          const optId = `${id}-opt-${p.value.replace(/[^A-Za-z0-9]/g, "-")}`;
          return `<li role="option" id="${optId}" data-lievit-item data-slot="combobox-option" aria-selected="${
            isSel(p.value) ? "true" : "false"
          }" data-combobox-option="${p.value}">${p.label}</li>`;
        })
        .join("");
      return `<li role="presentation" data-slot="combobox-group-wrapper"><div id="${grpId}" role="none" aria-hidden="true" data-slot="combobox-group-label">${label}</div><ul role="group" aria-labelledby="${grpId}">${optsHtml}</ul></li>`;
    })
    .join("");
  const allPairs = Object.values(groups).flat();
  const inputText = !multiple && value ? allPairs.find((p) => p.value === value)?.label ?? "" : "";
  const chips = multiple
    ? `<div data-slot="combobox-chips">${selected
        .map((v) => {
          const lbl = allPairs.find((p) => p.value === v)?.label ?? v;
          return `<span data-slot="combobox-chip" data-combobox-chip-value="${v}"><span data-slot="combobox-chip-label">${lbl}</span><button type="button" data-slot="combobox-chip-remove" data-action="click->lv-combobox#onChipRemove" data-combobox-chip-value="${v}" aria-label="Remove ${lbl}"></button></span>`;
        })
        .join("")}</div>`
    : "";
  const hidden = multiple
    ? `<div data-slot="combobox-hidden-list" data-combobox-name="sotto" hidden>${selected
        .map(
          (v) =>
            `<input type="hidden" name="sotto" value="${v}" data-slot="combobox-hidden" data-combobox-hidden-value="${v}" disabled>`,
        )
        .join("")}</div>`
    : `<input type="hidden" name="sotto" value="${value}" data-slot="combobox-hidden" data-lv-combobox-target="hidden" disabled>`;
  return `
<div data-slot="combobox" data-controller="lv-combobox" data-action="focusout->lv-combobox#onFocusout"
     data-lievit-combobox data-combobox-mode="select-only"${
       multiple ? ' data-combobox-multiple="true"' : ""
     } data-combobox-clearable="false" data-combobox-empty-text="No results">
  <div data-slot="combobox-control" data-lv-combobox-target="control">
    ${chips}
    <input type="text" id="${inputId}" data-slot="combobox-input" data-lv-combobox-target="input"
           data-action="input->lv-combobox#onInput focus->lv-combobox#onFocus keydown->lv-combobox#onKeydown"
           role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-controls="${listboxId}"
           aria-autocomplete="list" aria-activedescendant="" autocomplete="off" value="${inputText}">
    <button type="button" data-slot="combobox-toggle" data-lv-combobox-target="toggle"
            data-action="click->lv-combobox#onToggleClick" tabindex="-1" aria-hidden="true"></button>
  </div>
  <ul id="${listboxId}" role="listbox" data-slot="combobox-listbox" data-lv-combobox-target="listbox"
      data-action="toggle->lv-combobox#onListboxToggle mousedown->lv-combobox#onListboxMousedown click->lv-combobox#onOptionClick"
      popover="auto"${
        multiple ? ' aria-multiselectable="true"' : ""
      } data-lievit-collection data-lievit-collection-orientation="vertical"
      data-lievit-collection-wrap="true" data-lievit-collection-activedescendant-target="#${inputId}"
      aria-busy="false">${groupsHtml}</ul>
  ${hidden}
</div>`;
}

function mountGroupedVL(
  groups: Record<string, VLPair[]>,
  o: { value?: string; multiple?: boolean; selected?: string[] } = {},
): {
  root: HTMLElement;
  input: HTMLInputElement;
  listbox: HTMLElement;
  hiddenInput: HTMLInputElement | null;
  chips: HTMLElement | null;
  hiddenList: HTMLElement | null;
} {
  const host = document.createElement("div");
  host.innerHTML = comboboxGroupedVLHtml(groups, o);
  document.body.appendChild(host);
  const root = host.querySelector<HTMLElement>('[data-slot="combobox"]')!;
  const input = root.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')!;
  const listbox = root.querySelector<HTMLElement>('[data-slot="combobox-listbox"]')!;
  const hiddenInput = root.querySelector<HTMLInputElement>('[data-lv-combobox-target="hidden"]');
  const chips = root.querySelector<HTMLElement>('[data-slot="combobox-chips"]');
  const hiddenList = root.querySelector<HTMLElement>('[data-slot="combobox-hidden-list"]');
  shimPopover(listbox);
  return { root, input, listbox, hiddenInput, chips, hiddenList };
}

const TIPI: Record<string, VLPair[]> = {
  Vendita: [
    { value: "11", label: "Appartamento" },
    { value: "12", label: "Villa" },
  ],
  Affitto: [{ value: "21", label: "Box" }],
};

describe("combobox partial source — grouped value != label (optionGroupPairs)", () => {
  test("declares the optionGroupPairs param (group -> {value -> label})", () => {
    expect(jteSrc).toContain(
      "@param java.util.Map<String, java.util.Map<String, String>> optionGroupPairs",
    );
  });

  test("the grouped value != label branch renders role=group optgroups over optionGroupPairs", () => {
    expect(jteMarkup).toContain("optionGroupPairs.entrySet()");
    expect(jteMarkup).toContain('role="group"');
  });
});

describe("lv-combobox controller — grouped value != label (single)", () => {
  it("renders optgroups whose options carry the VALUE and show the LABEL", async () => {
    const { runtime } = makeRuntime();
    const { listbox } = mountGroupedVL(TIPI);
    startStimulus({ runtime });
    await flushStimulus();
    const groups = visibleGroups(listbox);
    expect(groups).toHaveLength(2);
    expect(groups[0].querySelector('[data-slot="combobox-group-label"]')?.textContent).toBe(
      "Vendita",
    );
    const villa = listbox.querySelector('li[data-combobox-option="12"]')!;
    expect(villa.textContent?.trim()).toBe("Villa"); // shows the LABEL
    expect(villa.getAttribute("data-combobox-option")).toBe("12"); // carries the VALUE
  });

  it("the filter matches the LABEL across groups and hides a group whose options all fall out", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox } = mountGroupedVL(TIPI);
    startStimulus({ runtime });
    await flushStimulus();

    input.value = "vil"; // matches "Villa" (value 12) only, in group Vendita
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));

    expect(getOptions(listbox).map((li) => li.getAttribute("data-combobox-option"))).toEqual(["12"]);
    const groups = visibleGroups(listbox);
    expect(groups).toHaveLength(1); // Affitto hidden (no dangling header)
    expect(groups[0].querySelector('[data-slot="combobox-group-label"]')?.textContent).toBe(
      "Vendita",
    );
  });

  it("option click commits the VALUE and shows the LABEL", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox, hiddenInput } = mountGroupedVL(TIPI);
    startStimulus({ runtime });
    await flushStimulus();
    input.dispatchEvent(new FocusEvent("focus"));
    clickOption(listbox, "12"); // pick Villa (value 12)
    expect(hiddenInput!.value).toBe("12"); // VALUE posted
    expect(input.value).toBe("Villa"); // LABEL shown
  });

  it("seed: the trigger shows the committed value's LABEL, the hidden carries the VALUE", async () => {
    const { runtime } = makeRuntime();
    const { input, hiddenInput } = mountGroupedVL(TIPI, { value: "21" });
    startStimulus({ runtime });
    await flushStimulus();
    expect(input.value).toBe("Box"); // LABEL of value 21
    expect(hiddenInput!.value).toBe("21"); // VALUE
  });
});

describe("lv-combobox controller — grouped value != label (multiple)", () => {
  it("adding an option from a group appends a LABEL chip + a VALUE hidden input", async () => {
    const { runtime } = makeRuntime();
    const { input, listbox, chips, hiddenList } = mountGroupedVL(TIPI, {
      multiple: true,
      selected: ["11"],
    });
    startStimulus({ runtime });
    await flushStimulus();

    expect(chipLabels(chips!)).toEqual(["Appartamento"]);
    input.dispatchEvent(new FocusEvent("focus"));
    clickOption(listbox, "21"); // add Box (value 21) from the Affitto group
    expect(chipLabels(chips!)).toEqual(["Appartamento", "Box"]); // LABELs
    expect(hiddenValues(hiddenList!)).toEqual(["11", "21"]); // VALUEs
    expect(input.getAttribute("aria-expanded")).toBe("true"); // stays open
  });
});
