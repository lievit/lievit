/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * rich-editor is a server-first WIRE rich-text field (Filament RichEditor parity): a plain
 * <textarea name=...> is the posted form control JS-off; a CSP-clean island enhances it into a
 * TipTap editor whose HTML is written back into the same textarea. This pins (a) the registry:wire
 * item shape, (b) the JS-off server-first fallback markup IS a real form control + the template is
 * server-pure (no inline script/slot), (c) the island is CSP-clean, and (d) the island's pure
 * orchestration (writeback fires input, toolbar drives commands + aria-pressed) against a fake
 * editor handle.
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import { resolve } from "../cli/registry.js";
import type { Registry } from "../cli/registry.js";
import {
  enhanceRichEditors,
  wireToolbar,
  syncPressed,
  writeBack,
  type EditorHandle,
} from "../registry/wire/rich-editor/rich-editor.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");

describe("rich-editor registry:wire item shape", () => {
  test("rich-editor is a single registry:wire item with a .jte (jte root) + a .ts (alias root)", () => {
    const matches = registry.items.filter((i) => i.name === "rich-editor");
    expect(matches, "exactly one rich-editor item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:wire");
    const jte = matches[0].files.find((f) => f.target.endsWith(".jte"))!;
    const ts = matches[0].files.find((f) => f.target.endsWith(".ts"))!;
    expect(jte.root).toBe("jte");
    expect(ts.root).toBeUndefined();
    expect(ts.target).toBe("components/ui/rich-editor.ts");
  });

  test("it declares TipTap as the engine dependency (the adopter installs it)", () => {
    const item = registry.items.find((i) => i.name === "rich-editor")!;
    expect(item.dependencies ?? []).toContain("@tiptap/core");
    expect(item.dependencies ?? []).toContain("@tiptap/starter-kit");
    // no Lit: it is a server-first wire, not an island.
    expect(JSON.stringify(item.dependencies ?? [])).not.toMatch(/\blit\b/);
  });

  test("resolving the item pulls its tokens dependency", () => {
    const closure = resolve(registry, ["rich-editor"]).map((i) => i.name);
    expect(closure).toContain("rich-editor");
    expect(closure).toContain("tokens");
  });
});

describe("rich-editor server-first template", () => {
  const jte = () => read("wire/rich-editor/rich-editor.jte");

  test("the JS-off fallback is a real, form-associated <textarea name=...>", () => {
    const markup = jte().replace(/<%--[\s\S]*?--%>/g, "");
    // a textarea bound to the form field name -- the control that POSTs with JS off.
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain("data-rich-editor-input");
    expect(markup).toMatch(/<textarea[\s\S]*?data-rich-editor-input/);
  });

  test("the toolbar + the editor surface start hidden (JS-off never sees a dead toolbar)", () => {
    const markup = jte().replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/data-rich-editor-toolbar[\s\S]*?hidden/);
    expect(markup).toMatch(/data-rich-editor-surface[\s\S]*?hidden/);
  });

  test("the template is server-pure: no <slot>, no inline <script>, no on*= handler", () => {
    const markup = jte().replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/<slot[\s>]/);
    expect(markup).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });

  test("the toolbar exposes the formatting commands as plain <button data-rich-editor-cmd>", () => {
    const markup = jte();
    for (const cmd of ["bold", "italic", "heading", "bulletList", "orderedList", "blockquote"]) {
      expect(markup).toContain(`data-rich-editor-cmd="${cmd}"`);
    }
  });
});

describe("rich-editor island CSP + behaviour", () => {
  test("the island is CSP-clean: no eval/new Function, no Lit import", () => {
    const ts = read("wire/rich-editor/rich-editor.ts");
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\beval\(|\bnew Function\b/);
    expect(code).not.toMatch(/^import .*from "lit"/m);
    expect(code).toContain("addEventListener");
  });
});

// ---------------------------------------------------------------------------
// The island orchestration against a fake editor handle (no real TipTap).
// ---------------------------------------------------------------------------

/** A fake editor handle recording commands; isActive returns true for whatever was last commanded. */
function fakeEditor(): EditorHandle & { last: string | null } {
  const state = { last: null as string | null };
  return {
    last: null,
    command(name) {
      state.last = name;
      this.last = name;
    },
    isActive(name) {
      return state.last === name;
    },
    destroy() {},
  };
}

/** Build a rich-editor root matching the partial: toolbar + surface + textarea. */
function renderRoot(): {
  root: HTMLElement;
  toolbar: HTMLElement;
  surface: HTMLElement;
  textarea: HTMLTextAreaElement;
} {
  const root = document.createElement("div");
  root.setAttribute("data-rich-editor", "");

  const toolbar = document.createElement("div");
  toolbar.setAttribute("data-rich-editor-toolbar", "");
  toolbar.hidden = true;
  for (const cmd of ["bold", "italic"]) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-rich-editor-cmd", cmd);
    b.setAttribute("aria-pressed", "false");
    toolbar.appendChild(b);
  }
  root.appendChild(toolbar);

  const surface = document.createElement("div");
  surface.setAttribute("data-rich-editor-surface", "");
  surface.hidden = true;
  root.appendChild(surface);

  const textarea = document.createElement("textarea");
  textarea.setAttribute("data-rich-editor-input", "");
  textarea.name = "body";
  textarea.value = "<p>seed</p>";
  root.appendChild(textarea);

  document.body.appendChild(root);
  return { root, toolbar, surface, textarea };
}

describe("rich-editor island wiring", () => {
  let teardown: () => void;
  afterEach(() => {
    teardown?.();
    document.body.innerHTML = "";
  });

  test("enhancing seeds the editor from the textarea, reveals surface + toolbar, hides textarea", () => {
    const { root, toolbar, surface, textarea } = renderRoot();
    let seeded = "";
    teardown = enhanceRichEditors({
      root,
      factory: ({ content }) => {
        seeded = content;
        return fakeEditor();
      },
    });
    expect(seeded).toBe("<p>seed</p>");
    expect(surface.hidden).toBe(false);
    expect(toolbar.hidden).toBe(false);
    // the textarea stays in the DOM + the form (it is still the posted control), just hidden.
    expect(textarea.isConnected).toBe(true);
    expect(textarea.getAttribute("aria-hidden")).toBe("true");
  });

  test("writeBack sets the textarea value and dispatches a native input event", () => {
    const { textarea } = renderRoot();
    let fired = 0;
    textarea.addEventListener("input", () => (fired += 1));
    writeBack(textarea, "<p>changed</p>");
    expect(textarea.value).toBe("<p>changed</p>");
    expect(fired).toBe(1);
    // idempotent: same value does not re-fire.
    writeBack(textarea, "<p>changed</p>");
    expect(fired).toBe(1);
    teardown = () => {};
  });

  test("the editor's onUpdate writes back to the textarea (the form keeps the field)", () => {
    const { root, textarea } = renderRoot();
    let push: (html: string) => void = () => {};
    teardown = enhanceRichEditors({
      root,
      factory: ({ onUpdate }) => {
        push = onUpdate;
        return fakeEditor();
      },
    });
    push("<p>typed</p>");
    expect(textarea.value).toBe("<p>typed</p>");
  });

  test("toolbar clicks run the matching command and reflect active state into aria-pressed", () => {
    const { toolbar } = renderRoot();
    const editor = fakeEditor();
    const remove = wireToolbar(toolbar, editor);
    const boldBtn = toolbar.querySelector<HTMLButtonElement>('[data-rich-editor-cmd="bold"]')!;
    boldBtn.click();
    expect(editor.last).toBe("bold");
    expect(boldBtn.getAttribute("aria-pressed")).toBe("true");
    remove();
    teardown = () => {};
  });

  test("syncPressed reflects each button against the editor", () => {
    const { toolbar } = renderRoot();
    const editor = fakeEditor();
    editor.command("italic");
    syncPressed(
      Array.from(toolbar.querySelectorAll<HTMLButtonElement>("[data-rich-editor-cmd]")),
      editor,
    );
    expect(toolbar.querySelector('[data-rich-editor-cmd="italic"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(toolbar.querySelector('[data-rich-editor-cmd="bold"]')!.getAttribute("aria-pressed")).toBe("false");
    teardown = () => {};
  });

  test("a disabled root is left as the plain textarea (no editor built)", () => {
    const { root } = renderRoot();
    root.setAttribute("data-rich-editor-disabled", "true");
    let built = 0;
    teardown = enhanceRichEditors({
      root,
      factory: () => {
        built += 1;
        return fakeEditor();
      },
    });
    expect(built).toBe(0);
  });

  test("enhancing twice is idempotent (a morph re-scan does not double-build)", () => {
    const { root } = renderRoot();
    let built = 0;
    teardown = enhanceRichEditors({
      root,
      factory: () => {
        built += 1;
        return fakeEditor();
      },
    });
    enhanceRichEditors({ root, factory: () => fakeEditor() })();
    expect(built).toBe(1);
  });
});
