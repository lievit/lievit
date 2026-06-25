/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * markdown-editor is a server-first WIRE markdown field (Filament MarkdownEditor parity): a plain
 * <textarea name=...> is the posted form control JS-off; the lv-markdown-editor Stimulus controller
 * adds the toolbar (selection-wrapping, a PURE transform) + a live preview rendered through an
 * injected, sanitizing renderer. The behaviour moved from the registry:wire island
 * (registry/wire/markdown-editor/markdown-editor.ts, left dormant for coexistence) to the runtime
 * controller; this suite proves it through the REAL Stimulus Application + the REAL lievit wire
 * morph (no mocked $lievit, no mocked runtime: a fetch stub captures the actual `_calls` the runtime
 * would POST, which for this field must always be ZERO -- it never round-trips the wire).
 *
 * It pins (a) the registry:wire item shape, (b) the server-first fallback IS a real form control +
 * the template is server-pure + wires the controller CSP-clean, (c) the island is CSP-clean, (d) the
 * pure applyCommand transform, (e) the live-preview + toolbar wiring against a fake renderer through
 * the real controller, (f) the controlled/uncontrolled doctrine (this field is uncontrolled => zero
 * wire calls), and (g) morph-safety (one gesture => one effect; a removed root fires nothing).
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import type { Registry } from "../cli/registry.js";
import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import {
  startStimulus,
  stopStimulus,
  flushStimulus,
} from "../runtime/stimulus/application.js";
import {
  applyCommand,
  setMarkdownRenderer,
} from "../runtime/stimulus/controllers/lv-markdown-editor-controller.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");
const controllerSrc = () =>
  readFileSync(
    join(
      import.meta.dirname,
      "..",
      "runtime",
      "stimulus",
      "controllers",
      "lv-markdown-editor-controller.ts",
    ),
    "utf8",
  );

describe("markdown-editor registry:wire item shape", () => {
  test("it is a single registry:wire item with a .jte (jte root) + a .ts (alias root)", () => {
    const matches = registry.items.filter((i) => i.name === "markdown-editor");
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe("registry:wire");
    const jte = matches[0].files.find((f) => f.target.endsWith(".jte"))!;
    const ts = matches[0].files.find((f) => f.target.endsWith(".ts"))!;
    expect(jte.root).toBe("jte");
    expect(ts.root).toBeUndefined();
    expect(ts.target).toBe("components/ui/markdown-editor.ts");
  });

  test("it declares the markdown lib + sanitizer deps", () => {
    const item = registry.items.find((i) => i.name === "markdown-editor")!;
    expect(item.dependencies ?? []).toContain("marked");
    expect(item.dependencies ?? []).toContain("dompurify");
  });
});

describe("markdown-editor server-first template", () => {
  const jte = () => read("wire/markdown-editor/markdown-editor.jte");

  test("the JS-off fallback is a real, form-associated <textarea name=...>", () => {
    const markup = jte().replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toContain('name="${name}"');
    expect(markup).toMatch(/<textarea[\s\S]*?data-markdown-editor-input/);
  });

  test("the toolbar starts hidden + the preview pane starts hidden (no dead UI JS-off)", () => {
    const markup = jte().replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/data-markdown-editor-toolbar[\s\S]*?hidden/);
    expect(markup).toMatch(/data-markdown-editor-preview[\s\S]*?hidden/);
  });

  test("the template is server-pure: no <slot>, no inline <script>, no on*= handler", () => {
    const markup = jte().replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/<slot[\s>]/);
    expect(markup).not.toMatch(/<script/i);
    expect(markup.match(/\son[a-z]+=/gi) ?? []).toEqual([]);
  });

  test("the template wires the controller CSP-clean: data-controller + data-action + targets", () => {
    // The behaviour moved from the markdown-editor island to the lv-markdown-editor Stimulus
    // controller; the template declares the wiring as CSP-clean attributes (NOT on* handlers):
    // the root carries the controller, the toolbar buttons / toggle / textarea carry their actions.
    const markup = jte();
    expect(markup).toContain('data-controller="lv-markdown-editor"');
    expect(markup).toContain('data-action="click->lv-markdown-editor#command"'); // toolbar commands
    expect(markup).toContain('data-action="click->lv-markdown-editor#togglePreview"'); // preview toggle
    expect(markup).toContain('data-action="input->lv-markdown-editor#refresh"'); // textarea live preview
    // targets the controller reads instead of querySelector
    expect(markup).toContain('data-lv-markdown-editor-target="input"');
    expect(markup).toContain('data-lv-markdown-editor-target="toolbar"');
    expect(markup).toContain('data-lv-markdown-editor-target="preview"');
    expect(markup).toContain('data-lv-markdown-editor-target="toggle"');
  });
});

describe("markdown-editor island + controller CSP", () => {
  test("the dormant island is CSP-clean: no eval/new Function, no Lit import", () => {
    const ts = read("wire/markdown-editor/markdown-editor.ts");
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\beval\(|\bnew Function\b/);
    expect(code).not.toMatch(/^import .*from "lit"/m);
    expect(code).toContain("addEventListener");
  });

  test("the controller is CSP-clean: no eval/new Function, no Lit import, no inline handler", () => {
    const code = controllerSrc()
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\beval\(|\bnew Function\b/);
    expect(code).not.toMatch(/from "lit"/);
    expect(code).not.toMatch(/\.innerHTML\s*=\s*[^;]*\+/); // no string-concatenated innerHTML
  });
});

describe("markdown-editor applyCommand (the pure toolbar transform)", () => {
  test("bold wraps the selection in ** and moves the selection inside", () => {
    const r = applyCommand("bold", { value: "hello world", start: 6, end: 11 });
    expect(r.value).toBe("hello **world**");
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("world");
  });

  test("bold on an empty selection inserts a placeholder wrapped in **", () => {
    const r = applyCommand("bold", { value: "", start: 0, end: 0 });
    expect(r.value).toBe("**bold text**");
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("bold text");
  });

  test("bold toggles OFF when the selection is already wrapped", () => {
    // value "**word**", selection on "word" (indices 2..6).
    const r = applyCommand("bold", { value: "**word**", start: 2, end: 6 });
    expect(r.value).toBe("word");
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("word");
  });

  test("italic wraps in _ , code wraps in backticks", () => {
    expect(applyCommand("italic", { value: "x", start: 0, end: 1 }).value).toBe("_x_");
    expect(applyCommand("code", { value: "x", start: 0, end: 1 }).value).toBe("`x`");
  });

  test("link builds [text](url) with the selection on the url", () => {
    const r = applyCommand("link", { value: "click", start: 0, end: 5 });
    expect(r.value).toBe("[click](url)");
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("url");
  });

  test("heading / quote / ul prefix the line", () => {
    expect(applyCommand("heading", { value: "Title", start: 0, end: 0 }).value).toBe("## Title");
    expect(applyCommand("quote", { value: "q", start: 0, end: 0 }).value).toBe("> q");
    expect(applyCommand("ul", { value: "item", start: 0, end: 0 }).value).toBe("- item");
  });

  test("a block command prefixes EVERY selected line", () => {
    const r = applyCommand("ul", { value: "a\nb\nc", start: 0, end: 5 });
    expect(r.value).toBe("- a\n- b\n- c");
  });

  test("an unknown command is a no-op", () => {
    const r = applyCommand("nope", { value: "x", start: 0, end: 1 });
    expect(r.value).toBe("x");
  });
});

// ---------------------------------------------------------------------------
// Live-preview + toolbar wiring through the REAL controller + REAL lievit morph.
// ---------------------------------------------------------------------------

/** A runtime backed by a fetch stub that records every action the runtime would POST. */
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
  return { runtime: new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch }), calledActions };
}

interface Mounted {
  componentRoot: HTMLElement;
  root: HTMLElement;
  textarea: HTMLTextAreaElement;
}

/** Build a component root + a markdown-editor root exactly as markdown-editor.jte emits it. */
function mountEditor(opts: { disabled?: boolean } = {}): Mounted {
  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.Md");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const root = document.createElement("div");
  root.setAttribute("data-controller", "lv-markdown-editor");
  root.setAttribute("data-markdown-editor", "");
  root.setAttribute("data-markdown-editor-disabled", opts.disabled ? "true" : "false");

  const toolbar = document.createElement("div");
  toolbar.setAttribute("data-markdown-editor-toolbar", "");
  toolbar.setAttribute("data-lv-markdown-editor-target", "toolbar");
  toolbar.hidden = true;
  const bold = document.createElement("button");
  bold.type = "button";
  bold.setAttribute("data-markdown-cmd", "bold");
  bold.setAttribute("data-action", "click->lv-markdown-editor#command");
  toolbar.appendChild(bold);
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.setAttribute("data-markdown-preview-toggle", "");
  toggle.setAttribute("data-lv-markdown-editor-target", "toggle");
  toggle.setAttribute("data-action", "click->lv-markdown-editor#togglePreview");
  toggle.setAttribute("aria-pressed", "false");
  toolbar.appendChild(toggle);
  root.appendChild(toolbar);

  const textarea = document.createElement("textarea");
  textarea.setAttribute("data-markdown-editor-input", "");
  textarea.setAttribute("data-lv-markdown-editor-target", "input");
  textarea.setAttribute("data-action", "input->lv-markdown-editor#refresh");
  textarea.name = "notes";
  if (opts.disabled) {
    textarea.disabled = true;
  }
  root.appendChild(textarea);

  const preview = document.createElement("div");
  preview.setAttribute("data-markdown-editor-preview", "");
  preview.setAttribute("data-lv-markdown-editor-target", "preview");
  preview.hidden = true;
  root.appendChild(preview);

  componentRoot.appendChild(root);
  document.body.appendChild(componentRoot);
  return { componentRoot, root, textarea };
}

afterEach(() => {
  stopStimulus();
  setMarkdownRenderer(null);
  document.body.innerHTML = "";
});

describe("markdown-editor controller wiring (real Stimulus + real runtime)", () => {
  test("connect reveals the toolbar (server renders it hidden)", async () => {
    const { runtime } = makeRuntime();
    const { root } = mountEditor();
    startStimulus({ runtime });
    await flushStimulus();
    expect(root.querySelector<HTMLElement>("[data-markdown-editor-toolbar]")!.hidden).toBe(false);
  });

  test("a toolbar click applies the transform to the textarea selection + fires input", async () => {
    const { runtime } = makeRuntime();
    const { root, textarea } = mountEditor();
    startStimulus({ runtime });
    await flushStimulus();

    textarea.value = "hi";
    textarea.setSelectionRange(0, 2);
    let fired = 0;
    textarea.addEventListener("input", () => (fired += 1));
    root.querySelector<HTMLButtonElement>('[data-markdown-cmd="bold"]')!.click();

    expect(textarea.value).toBe("**hi**");
    expect(fired).toBe(1);
  });

  test("the preview toggle reveals + renders the sanitized HTML on input", async () => {
    const { runtime } = makeRuntime();
    const { root, textarea } = mountEditor();
    const calls: string[] = [];
    setMarkdownRenderer((md) => {
      calls.push(md);
      return `<p>${md}</p>`;
    });
    startStimulus({ runtime });
    await flushStimulus();

    const preview = root.querySelector<HTMLElement>("[data-markdown-editor-preview]")!;
    const toggle = root.querySelector<HTMLButtonElement>("[data-markdown-preview-toggle]")!;
    textarea.value = "hello";
    toggle.click();
    expect(preview.hidden).toBe(false);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(preview.innerHTML).toBe("<p>hello</p>");

    // typing refreshes the preview through the renderer.
    textarea.value = "world";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    expect(preview.innerHTML).toBe("<p>world</p>");
    expect(calls).toContain("world");
  });

  test("without a renderer the toolbar still works (preview simply not wired)", async () => {
    const { runtime } = makeRuntime();
    const { root, textarea } = mountEditor(); // no setMarkdownRenderer
    startStimulus({ runtime });
    await flushStimulus();

    const preview = root.querySelector<HTMLElement>("[data-markdown-editor-preview]")!;
    root.querySelector<HTMLButtonElement>("[data-markdown-preview-toggle]")!.click();
    expect(preview.hidden).toBe(true); // toggle is a no-op without a renderer

    textarea.value = "hi";
    textarea.setSelectionRange(0, 2);
    root.querySelector<HTMLButtonElement>('[data-markdown-cmd="bold"]')!.click();
    expect(textarea.value).toBe("**hi**"); // the toolbar transform still works
  });

  test("a disabled root is left as the plain textarea (toolbar not revealed)", async () => {
    const { runtime } = makeRuntime();
    const { root } = mountEditor({ disabled: true });
    startStimulus({ runtime });
    await flushStimulus();
    expect(root.querySelector<HTMLElement>("[data-markdown-editor-toolbar]")!.hidden).toBe(true);
  });
});

describe("markdown-editor controlled/uncontrolled doctrine (zero wire round-trips)", () => {
  test("no gesture round-trips the wire: the field's state is the textarea the form owns", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { root, textarea } = mountEditor();
    setMarkdownRenderer((md) => `<p>${md}</p>`);
    startStimulus({ runtime });
    await flushStimulus();

    textarea.value = "hi";
    textarea.setSelectionRange(0, 2);
    root.querySelector<HTMLButtonElement>('[data-markdown-cmd="bold"]')!.click();
    root.querySelector<HTMLButtonElement>("[data-markdown-preview-toggle]")!.click();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0); // uncontrolled by construction: never a /lievit/<id>/call
  });
});

describe("markdown-editor morph-safety (real lievit morph)", () => {
  test("after a real morph one toolbar click = one transform (no stacked listeners)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, root, textarea } = mountEditor();
    startStimulus({ runtime });
    await flushStimulus();

    // A real lievit wire morph re-renders the subtree (idiomorph preserves node identity), so the
    // controller stays connected and the data-action must NOT double-bind.
    morph(componentRoot, componentRoot.outerHTML);
    await flushStimulus();

    const ta = root.querySelector<HTMLTextAreaElement>("[data-markdown-editor-input]")!;
    ta.value = "hi";
    ta.setSelectionRange(0, 2);
    let fired = 0;
    ta.addEventListener("input", () => (fired += 1));
    root.querySelector<HTMLButtonElement>('[data-markdown-cmd="bold"]')!.click();

    // a stacked second handler would re-run applyCommand (toggling **hi** back to hi) + fire input twice.
    expect(ta.value).toBe("**hi**");
    expect(fired).toBe(1);
    void textarea; // original reference retained for clarity; the live node is re-queried post-morph
  });

  test("a root removed by a morph stops firing (disconnect tears the wiring down)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, root } = mountEditor();
    startStimulus({ runtime });
    await flushStimulus();

    const bold = root.querySelector<HTMLButtonElement>('[data-markdown-cmd="bold"]')!;
    const detachedTextarea = root.querySelector<HTMLTextAreaElement>("[data-markdown-editor-input]")!;
    detachedTextarea.value = "hi";
    detachedTextarea.setSelectionRange(0, 2);

    // Morph the editor out of the tree.
    morph(componentRoot, `<div data-lievit-component="com.example.Md" data-lievit-snapshot="s2"><span>gone</span></div>`);
    await flushStimulus();

    // The detached button no longer reaches a live controller -> the transform must not run.
    bold.click();
    expect(detachedTextarea.value).toBe("hi");
  });
});
