/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * rich-select (roadmap L1) is a server-first WIRE Combobox (ADR-0012): the <lv-rich-select> Lit
 * island is gone. The catalog, the filter, the single/multiple selection, the chips, the create
 * affordance and the rich labels all live in typed Java
 * (registry/wire/rich-select/RichSelectComponent.java) rendered by JTE (rich-select.jte), with a tiny
 * CSP-clean typed-TS enhancer (rich-select.ts) for the one irreducible client bit: APG keyboard
 * navigation. This file pins (a) the registry:wire item shape + the server-purity of the source, and
 * (b) the keyboard enhancer's DOM behaviour against a DOM shaped like the partial output. The render
 * + state transitions (multiple chips + toggle, preload, create, rich labels) are render-asserted on
 * the JVM in lievit-kit (dev.lievit.kit.wire.RichSelectComponentIT).
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import { resolve } from "../cli/registry.js";
import type { Registry } from "../cli/registry.js";
import { enhanceRichSelects } from "../registry/wire/rich-select/rich-select.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");

describe("rich-select registry:wire item shape", () => {
  test("rich-select is a single registry:wire item (the Lit island is gone)", () => {
    const matches = registry.items.filter((i) => i.name === "rich-select");
    expect(matches, "exactly one rich-select item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:wire");
  });

  test("it carries three files: a .java (java root), a .jte (jte root), a .ts (alias root)", () => {
    const item = registry.items.find((i) => i.name === "rich-select")!;
    const java = item.files.find((f) => f.target.endsWith(".java"))!;
    const jte = item.files.find((f) => f.target.endsWith(".jte"))!;
    const ts = item.files.find((f) => f.target.endsWith(".ts"))!;
    expect(java.root).toBe("java");
    expect(jte.root).toBe("jte");
    // the keyboard enhancer is an alias-root file (no java/jte root): it lands like the old island.
    expect(ts.root).toBeUndefined();
    expect(ts.target).toBe("components/ui/rich-select.ts");
  });

  test("it ships no Lit dependency (server-first)", () => {
    const item = registry.items.find((i) => i.name === "rich-select")!;
    expect(item.dependencies ?? []).not.toContain("lit");
    expect(JSON.stringify(item.dependencies ?? [])).not.toMatch(/\blit\b/);
  });

  test("the wire Java holds the Combobox state in @Wire fields + the armed-toggle/create idiom", () => {
    const java = read("wire/rich-select/RichSelectComponent.java");
    expect(java).toContain("@Wire");
    // back-compat single + the new multiple selection state.
    expect(java).toContain("public String selected");
    expect(java).toContain("public List<String> selectedValues");
    // the four L1 mode flags.
    expect(java).toContain("public boolean multiple");
    expect(java).toContain("public boolean preload");
    expect(java).toContain("public boolean allowCreate");
    // the armed-$set commands consumed on render (toggle membership + create), toggle-group idiom.
    expect(java).toContain("public String toggleValue");
    expect(java).toContain("public String createValue");
    // the catalog is server-derived, kept out of the snapshot (a record list cannot round-trip).
    expect(java).toMatch(/@LievitProperty\(serialize = false\)[\s\S]*?List<Option> allOptions/);
    // the Option record carries the rich-label fields.
    expect(java).toMatch(/record Option\([\s\S]*?String avatar[\s\S]*?String icon[\s\S]*?String subtext/);
  });

  test("the wire template is server-pure: no <slot>, no inline <script>, the L1 affordances", () => {
    const jte = read("wire/rich-select/rich-select.jte");
    const markup = jte.replace(/<%--[\s\S]*?--%>/g, "");
    // the whole reason for the pivot: no native <slot>, no inline script.
    expect(markup).not.toMatch(/<slot[\s>]/);
    expect(markup).not.toMatch(/<script/i);
    // a real APG combobox + listbox.
    expect(jte).toContain('role="combobox"');
    expect(jte).toContain('role="listbox"');
    expect(jte).toContain('role="option"');
    expect(jte).toContain("aria-selected");
    expect(jte).toContain("aria-multiselectable");
    // server-side debounced filter, no per-keystroke client filtering.
    expect(jte).toContain('l:model.debounce.250ms="query"');
    // single picks `selected`, multiple toggles membership via `toggleValue` (both $set magic).
    expect(jte).toContain("$set('selected'");
    expect(jte).toContain("$set('toggleValue'");
    // chips: a removable chip is a real <button> arming the same toggle to remove its value.
    expect(jte).toContain("data-rich-select-chip");
    expect(jte).toContain("data-rich-select-chip-remove");
    // create: a no-match query renders a Create affordance arming the new value.
    expect(jte).toContain("$set('createValue'");
    expect(jte).toContain("data-rich-select-create");
    // rich labels: avatar img + icon + subtext.
    expect(jte).toContain("data-rich-select-option-avatar");
    expect(jte).toContain("data-rich-select-option-icon");
    expect(jte).toContain("data-rich-select-option-subtext");
  });

  test("the enhancer is CSP-clean: addEventListener only, no inline handler, no Lit", () => {
    const ts = read("wire/rich-select/rich-select.ts");
    // strip comments (the doc-comment names lit in prose to explain its absence).
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).toContain('addEventListener("keydown"');
    expect(code).toContain("preventDefault");
    // it activates an option by re-using its own server l:click (a synthetic click), never an eval.
    expect(code).toContain(".click()");
    expect(code).not.toMatch(/\bnew Function\b|\beval\(/);
    // no Lit import (the server owns the state; the client only moves the active option).
    expect(code).not.toMatch(/^import .*from "lit"/m);
  });

  test("resolving the wire item pulls its tokens + icon partial dependencies", () => {
    const closure = resolve(registry, ["rich-select"]).map((i) => i.name);
    expect(closure).toContain("rich-select");
    expect(closure).toContain("tokens");
    expect(closure).toContain("icon");
    expect(closure.indexOf("icon")).toBeLessThan(closure.indexOf("rich-select"));
  });
});

// ---------------------------------------------------------------------------
// The typed-TS keyboard enhancer, against a DOM shaped like the rich-select.jte output.
// ---------------------------------------------------------------------------

/** Build a rich-select root matching rich-select.jte: a search input + three option rows. */
function renderRichSelect(): { root: HTMLElement; search: HTMLElement; options: HTMLElement[] } {
  const root = document.createElement("div");
  root.setAttribute("data-lievit-component", "dev.lievit.wire.RichSelectComponent");
  root.setAttribute("data-rich-select", "");

  const search = document.createElement("input");
  search.setAttribute("data-rich-select-search", "");
  root.appendChild(search);

  const list = document.createElement("ul");
  list.setAttribute("role", "listbox");
  list.setAttribute("data-rich-select-listbox", "");
  const options = ["apple", "banana", "cherry"].map((value) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.setAttribute("data-rich-select-option", value);
    li.setAttribute("aria-selected", "false");
    list.appendChild(li);
    return li;
  });
  root.appendChild(list);
  document.body.appendChild(root);
  return { root, search, options };
}

/** Dispatch a keydown of `key` on the search input. */
function pressKey(search: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  search.dispatchEvent(event);
  return event;
}

describe("rich-select keyboard enhancer (the one irreducible client bit)", () => {
  let teardown: () => void;
  const runtime = { $lievit: () => null };

  afterEach(() => {
    teardown?.();
    document.body.innerHTML = "";
  });

  test("ArrowDown moves the active option down and wraps at the end", () => {
    const { root, search, options } = renderRichSelect();
    teardown = enhanceRichSelects(runtime, root);

    pressKey(search, "ArrowDown");
    expect(options[0].getAttribute("data-rich-select-active")).toBe("true");
    pressKey(search, "ArrowDown");
    expect(options[1].getAttribute("data-rich-select-active")).toBe("true");
    expect(options[0].getAttribute("data-rich-select-active")).toBeNull();
    // wrap: third down then a fourth wraps back to the first.
    pressKey(search, "ArrowDown");
    pressKey(search, "ArrowDown");
    expect(options[0].getAttribute("data-rich-select-active")).toBe("true");
  });

  test("ArrowUp moves up and wraps to the last option from the top", () => {
    const { search, options } = renderRichSelect();
    teardown = enhanceRichSelects(runtime);

    pressKey(search, "ArrowUp"); // from none (-1) wraps to the last
    expect(options[2].getAttribute("data-rich-select-active")).toBe("true");
  });

  test("Enter activates the focused option by synthetically clicking it (its server l:click)", () => {
    const { search, options } = renderRichSelect();
    let clicked = "";
    options[1].addEventListener("click", () => (clicked = "banana"));
    teardown = enhanceRichSelects(runtime);

    pressKey(search, "ArrowDown"); // active = apple
    pressKey(search, "ArrowDown"); // active = banana
    const event = pressKey(search, "Enter");
    expect(clicked).toBe("banana");
    expect(event.defaultPrevented).toBe(true);
  });

  test("enhancing twice is idempotent (a re-render after a morph re-uses the same root)", () => {
    const { root, search, options } = renderRichSelect();
    teardown = enhanceRichSelects(runtime, root);
    const second = enhanceRichSelects(runtime, root); // no-op: already wired
    second();

    pressKey(search, "ArrowDown");
    // exactly one activation, not a double-step from two listeners.
    expect(options[0].getAttribute("data-rich-select-active")).toBe("true");
    expect(options[1].getAttribute("data-rich-select-active")).toBeNull();
  });
});
