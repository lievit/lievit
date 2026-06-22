/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * code-editor is a server-first WIRE code field: a plain monospace <textarea name=...> is the posted
 * form control JS-off; a CSP-clean island enhances it into a CodeMirror 6 editor whose document is
 * written back into the same textarea. This pins (a) the registry:wire item shape, (b) the server-
 * first fallback IS a real form control + the template is server-pure, (c) the island is CSP-clean,
 * and (d) the island orchestration (seed, reveal, writeback, language pass-through) against a fake
 * editor handle (no real CodeMirror in happy-dom).
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import type { Registry } from "../cli/registry.js";
import {
  enhanceCodeEditors,
  writeBack,
  type CodeEditorHandle,
} from "../registry/wire/code-editor/code-editor.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");

describe("code-editor registry:wire item shape", () => {
  test("it is a single registry:wire item with a .jte (jte root) + a .ts (alias root)", () => {
    const matches = registry.items.filter((i) => i.name === "code-editor");
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe("registry:wire");
    const jte = matches[0].files.find((f) => f.target.endsWith(".jte"))!;
    const ts = matches[0].files.find((f) => f.target.endsWith(".ts"))!;
    expect(jte.root).toBe("jte");
    expect(ts.root).toBeUndefined();
    expect(ts.target).toBe("components/ui/code-editor.ts");
  });

  test("it declares CodeMirror as the engine dependency (the adopter installs it + lang packs)", () => {
    const item = registry.items.find((i) => i.name === "code-editor")!;
    expect(item.dependencies ?? []).toContain("codemirror");
    expect(JSON.stringify(item.dependencies ?? [])).not.toMatch(/\blit\b/);
  });
});

describe("code-editor server-first template", () => {
  const jte = () => read("wire/code-editor/code-editor.jte");

  test("the JS-off fallback is a real, form-associated monospace <textarea name=...>", () => {
    const markup = jte().replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toContain('name="${name}"');
    expect(markup).toMatch(/<textarea[\s\S]*?data-code-editor-input/);
    expect(markup).toContain("--lv-font-mono");
  });

  test("the editor surface starts hidden (JS-off shows the textarea, not a dead mount)", () => {
    const markup = jte().replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/data-code-editor-surface[\s\S]*?hidden/);
  });

  test("the template is server-pure: no <slot>, no inline <script>, no on*= handler", () => {
    const markup = jte().replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/<slot[\s>]/);
    expect(markup).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });
});

describe("code-editor island CSP", () => {
  test("the island is CSP-clean: no eval/new Function, no inline-handler API, no Lit import", () => {
    const ts = read("wire/code-editor/code-editor.ts");
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\beval\(|\bnew Function\b/);
    expect(code).not.toMatch(/^import .*from "lit"/m);
    // it drives the editor via the injected factory + writeBack; no inline-handler assignment.
    expect(code).not.toMatch(/\.\s*setAttribute\(\s*["']on[a-z]+["']/);
  });
});

// ---------------------------------------------------------------------------
// Island orchestration against a fake editor handle.
// ---------------------------------------------------------------------------

function fakeHandle(): CodeEditorHandle & { destroyed: boolean } {
  return { destroyed: false, destroy() { this.destroyed = true; } };
}

function renderRoot(language = "javascript"): {
  root: HTMLElement;
  surface: HTMLElement;
  textarea: HTMLTextAreaElement;
} {
  const root = document.createElement("div");
  root.setAttribute("data-code-editor", "");
  root.setAttribute("data-code-editor-language", language);

  const surface = document.createElement("div");
  surface.setAttribute("data-code-editor-surface", "");
  surface.hidden = true;
  root.appendChild(surface);

  const textarea = document.createElement("textarea");
  textarea.setAttribute("data-code-editor-input", "");
  textarea.name = "source";
  textarea.value = "const x = 1;";
  root.appendChild(textarea);

  document.body.appendChild(root);
  return { root, surface, textarea };
}

describe("code-editor island wiring", () => {
  let teardown: () => void;
  afterEach(() => {
    teardown?.();
    document.body.innerHTML = "";
  });

  test("enhancing seeds the doc + language, reveals surface, hides textarea (still posted)", () => {
    const { root, surface, textarea } = renderRoot("sql");
    let seededDoc = "";
    let seededLang = "";
    teardown = enhanceCodeEditors({
      root,
      factory: ({ doc, language }) => {
        seededDoc = doc;
        seededLang = language;
        return fakeHandle();
      },
    });
    expect(seededDoc).toBe("const x = 1;");
    expect(seededLang).toBe("sql");
    expect(surface.hidden).toBe(false);
    expect(textarea.isConnected).toBe(true);
    expect(textarea.getAttribute("aria-hidden")).toBe("true");
  });

  test("the editor's onUpdate writes the document back into the textarea + fires input", () => {
    const { root, textarea } = renderRoot();
    let push: (doc: string) => void = () => {};
    teardown = enhanceCodeEditors({
      root,
      factory: ({ onUpdate }) => {
        push = onUpdate;
        return fakeHandle();
      },
    });
    let fired = 0;
    textarea.addEventListener("input", () => (fired += 1));
    push("const y = 2;");
    expect(textarea.value).toBe("const y = 2;");
    expect(fired).toBe(1);
  });

  test("writeBack is idempotent (no input event when the value is unchanged)", () => {
    const { textarea } = renderRoot();
    let fired = 0;
    textarea.addEventListener("input", () => (fired += 1));
    writeBack(textarea, "const x = 1;"); // same as seed
    expect(fired).toBe(0);
    teardown = () => {};
  });

  test("teardown destroys the editor, re-shows the textarea, and un-wires the root", () => {
    const { root, surface, textarea } = renderRoot();
    let handle: ReturnType<typeof fakeHandle>;
    const stop = enhanceCodeEditors({
      root,
      factory: () => (handle = fakeHandle()),
    });
    stop();
    expect(handle!.destroyed).toBe(true);
    expect(surface.hidden).toBe(true);
    expect(textarea.getAttribute("aria-hidden")).toBeNull();
    expect(root.getAttribute("data-code-editor-wired")).toBeNull();
    teardown = () => {};
  });

  test("a disabled root is left as the plain textarea", () => {
    const { root } = renderRoot();
    root.setAttribute("data-code-editor-disabled", "true");
    let built = 0;
    teardown = enhanceCodeEditors({
      root,
      factory: () => {
        built += 1;
        return fakeHandle();
      },
    });
    expect(built).toBe(0);
  });
});
