/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * markdown-editor is a server-first WIRE markdown field (Filament MarkdownEditor parity): a plain
 * <textarea name=...> is the posted form control JS-off; a CSP-clean island adds the toolbar
 * (selection-wrapping, a PURE transform) + a live preview rendered through an injected, sanitizing
 * renderer. This pins (a) the registry:wire item shape, (b) the server-first fallback IS a real
 * form control + the template is server-pure, (c) the island is CSP-clean, (d) the pure applyCommand
 * transform, and (e) the live-preview wiring against a fake renderer.
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import type { Registry } from "../cli/registry.js";
import {
  applyCommand,
  enhanceMarkdownEditors,
} from "../registry/wire/markdown-editor/markdown-editor.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");

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
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });
});

describe("markdown-editor island CSP", () => {
  test("the island is CSP-clean: no eval/new Function, no Lit import", () => {
    const ts = read("wire/markdown-editor/markdown-editor.ts");
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\beval\(|\bnew Function\b/);
    expect(code).not.toMatch(/^import .*from "lit"/m);
    expect(code).toContain("addEventListener");
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
// Live-preview + toolbar wiring against the DOM, with a fake (sanitizing) renderer.
// ---------------------------------------------------------------------------

function renderRoot(): { root: HTMLElement; textarea: HTMLTextAreaElement } {
  const root = document.createElement("div");
  root.setAttribute("data-markdown-editor", "");

  const toolbar = document.createElement("div");
  toolbar.setAttribute("data-markdown-editor-toolbar", "");
  toolbar.hidden = true;
  const bold = document.createElement("button");
  bold.type = "button";
  bold.setAttribute("data-markdown-cmd", "bold");
  toolbar.appendChild(bold);
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.setAttribute("data-markdown-preview-toggle", "");
  toggle.setAttribute("aria-pressed", "false");
  toolbar.appendChild(toggle);
  root.appendChild(toolbar);

  const textarea = document.createElement("textarea");
  textarea.setAttribute("data-markdown-editor-input", "");
  textarea.name = "notes";
  root.appendChild(textarea);

  const preview = document.createElement("div");
  preview.setAttribute("data-markdown-editor-preview", "");
  preview.hidden = true;
  root.appendChild(preview);

  document.body.appendChild(root);
  return { root, textarea };
}

describe("markdown-editor island wiring", () => {
  let teardown: () => void;
  afterEach(() => {
    teardown?.();
    document.body.innerHTML = "";
  });

  test("a toolbar click applies the transform to the textarea selection + fires input", () => {
    const { root, textarea } = renderRoot();
    textarea.value = "hi";
    teardown = enhanceMarkdownEditors({ root });
    textarea.setSelectionRange(0, 2);
    let fired = 0;
    textarea.addEventListener("input", () => (fired += 1));
    root.querySelector<HTMLButtonElement>('[data-markdown-cmd="bold"]')!.click();
    expect(textarea.value).toBe("**hi**");
    expect(fired).toBe(1);
  });

  test("the preview toggle reveals + renders the sanitized HTML on input", () => {
    const { root, textarea } = renderRoot();
    const calls: string[] = [];
    const render = (md: string) => {
      calls.push(md);
      return `<p>${md}</p>`;
    };
    teardown = enhanceMarkdownEditors({ root, render });
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

  test("without a renderer the toolbar still works (preview simply not wired)", () => {
    const { root, textarea } = renderRoot();
    teardown = enhanceMarkdownEditors({ root });
    textarea.value = "hi";
    textarea.setSelectionRange(0, 2);
    root.querySelector<HTMLButtonElement>('[data-markdown-cmd="bold"]')!.click();
    expect(textarea.value).toBe("**hi**");
  });

  test("a disabled root is left as the plain textarea (toolbar not revealed)", () => {
    const { root } = renderRoot();
    root.setAttribute("data-markdown-editor-disabled", "true");
    teardown = enhanceMarkdownEditors({ root });
    expect(root.querySelector<HTMLElement>("[data-markdown-editor-toolbar]")!.hidden).toBe(true);
  });
});
