/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * code-editor is a server-first WIRE code field: a plain monospace <textarea name=...> is the posted
 * form control JS-off; the `lv-code-editor` Stimulus controller enhances it into a CodeMirror 6
 * editor whose document is written back into the same textarea. This pins (a) the registry:wire item
 * shape, (b) the server-first fallback IS a real form control + the template is server-pure, (c) the
 * controller + its registry source are CSP-clean, and (d) the controller orchestration (seed, reveal,
 * writeback, language pass-through, server-first no-op, teardown, morph-safety) through the REAL
 * Stimulus Application + the REAL lievit wire morph against an injected fake editor factory (no real
 * CodeMirror in happy-dom). The controller never round-trips the wire (a code field owns no
 * open/close state), so the controlled/uncontrolled doctrine holds trivially: zero `/lievit/<id>/call`
 * on every path.
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import type { Registry } from "../cli/registry.js";
import {
  startStimulus,
  stopStimulus,
  flushStimulus,
} from "../runtime/stimulus/application.js";
import { morph } from "../runtime/morph.js";
import {
  setCodeEditorFactory,
  writeBack,
  type CodeEditorFactory,
  type CodeEditorHandle,
} from "../runtime/stimulus/controllers/lv-code-editor-controller.js";

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

  test("the root wires the lv-code-editor controller with surface + input targets", () => {
    const markup = jte().replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toContain('data-controller="lv-code-editor"');
    expect(markup).toContain('data-lv-code-editor-target="surface"');
    expect(markup).toContain('data-lv-code-editor-target="input"');
    expect(markup).toContain('data-lv-code-editor-language-value="${language}"');
  });

  test("the template is server-pure: no <slot>, no inline <script>, no on*= handler", () => {
    const markup = jte().replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/<slot[\s>]/);
    expect(markup).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });
});

describe("code-editor CSP", () => {
  test("the registry island source is CSP-clean: no eval/new Function, no inline-handler API, no Lit import", () => {
    const ts = read("wire/code-editor/code-editor.ts");
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\beval\(|\bnew Function\b/);
    expect(code).not.toMatch(/^import .*from "lit"/m);
    expect(code).not.toMatch(/\.\s*setAttribute\(\s*["']on[a-z]+["']/);
  });

  test("the lv-code-editor controller is CSP-clean: no eval/new Function, no inline-handler API", () => {
    const ts = readFileSync(
      join(import.meta.dirname, "..", "runtime", "stimulus", "controllers", "lv-code-editor-controller.ts"),
      "utf8",
    );
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\beval\(|\bnew Function\b/);
    expect(code).not.toMatch(/\.\s*setAttribute\(\s*["']on[a-z]+["']/);
  });
});

// ---------------------------------------------------------------------------
// Controller orchestration: REAL Stimulus Application + REAL lievit morph, injected fake factory.
// ---------------------------------------------------------------------------

/** A fake editor handle that records its teardown (stands in for a CodeMirror EditorView). */
function fakeHandle(): CodeEditorHandle & { destroyed: boolean } {
  return { destroyed: false, destroy() { this.destroyed = true; } };
}

interface FactorySpy {
  factory: CodeEditorFactory;
  builds: number;
  lastDoc: string;
  lastLanguage: string;
  handles: Array<ReturnType<typeof fakeHandle>>;
  push?: (doc: string) => void;
}

/** A spying factory: counts builds, captures the seeded doc/language, exposes the last onUpdate. */
function spyFactory(): FactorySpy {
  const spy: FactorySpy = { builds: 0, lastDoc: "", lastLanguage: "", handles: [], factory: () => fakeHandle() };
  spy.factory = ({ doc, language, onUpdate }) => {
    spy.builds += 1;
    spy.lastDoc = doc;
    spy.lastLanguage = language;
    spy.push = onUpdate;
    const handle = fakeHandle();
    spy.handles.push(handle);
    return handle;
  };
  return spy;
}

/** The field markup exactly as code-editor.jte emits it (data-controller + targets + values). */
function fieldHtml(opts: { language?: string; disabled?: boolean; value?: string } = {}): string {
  const language = opts.language ?? "javascript";
  const disabled = opts.disabled ?? false;
  const value = opts.value ?? "const x = 1;";
  return `
    <div data-controller="lv-code-editor"
         data-lv-code-editor-language-value="${language}"
         data-lv-code-editor-disabled-value="${disabled}"
         data-code-editor>
      <div data-lv-code-editor-target="surface" data-code-editor-surface hidden></div>
      <textarea data-lv-code-editor-target="input" data-code-editor-input name="source">${value}</textarea>
    </div>`;
}

/** A host wrapper carrying the field as a CHILD, so a morph preserves the controller element. */
function hostHtml(opts: { language?: string; disabled?: boolean; value?: string } = {}): string {
  return `<div data-host>${fieldHtml(opts)}</div>`;
}

/** Mount one field inside a `data-host` wrapper (the morph surface) and return the parts. */
function mountField(opts: { language?: string; disabled?: boolean; value?: string } = {}): {
  host: HTMLElement;
  root: HTMLElement;
  surface: HTMLElement;
  textarea: HTMLTextAreaElement;
} {
  const host = document.createElement("div");
  host.setAttribute("data-host", "");
  host.innerHTML = fieldHtml(opts);
  document.body.appendChild(host);
  const root = host.querySelector<HTMLElement>("[data-controller='lv-code-editor']")!;
  const surface = root.querySelector<HTMLElement>("[data-lv-code-editor-target='surface']")!;
  const textarea = root.querySelector<HTMLTextAreaElement>("[data-lv-code-editor-target='input']")!;
  return { host, root, surface, textarea };
}

describe("lv-code-editor controller — orchestration (real Stimulus)", () => {
  afterEach(() => {
    stopStimulus();
    setCodeEditorFactory(null);
    document.body.innerHTML = "";
  });

  test("enhancing seeds the doc + language, reveals surface, hides textarea (still posted)", async () => {
    const spy = spyFactory();
    setCodeEditorFactory(spy.factory);
    const { surface, textarea } = mountField({ language: "sql" });
    startStimulus();
    await flushStimulus();

    expect(spy.builds).toBe(1);
    expect(spy.lastDoc).toBe("const x = 1;");
    expect(spy.lastLanguage).toBe("sql");
    expect(surface.hidden).toBe(false);
    expect(textarea.isConnected).toBe(true);
    expect(textarea.getAttribute("aria-hidden")).toBe("true");
  });

  test("the editor's onUpdate writes the document back into the textarea + fires input", async () => {
    const spy = spyFactory();
    setCodeEditorFactory(spy.factory);
    const { textarea } = mountField();
    startStimulus();
    await flushStimulus();

    let fired = 0;
    textarea.addEventListener("input", () => (fired += 1));
    spy.push!("const y = 2;");
    expect(textarea.value).toBe("const y = 2;");
    expect(fired).toBe(1);
  });

  test("writeBack is idempotent (no input event when the value is unchanged)", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "const x = 1;";
    let fired = 0;
    textarea.addEventListener("input", () => (fired += 1));
    writeBack(textarea, "const x = 1;");
    expect(fired).toBe(0);
  });

  test("a disabled root is left as the plain textarea (factory never called)", async () => {
    const spy = spyFactory();
    setCodeEditorFactory(spy.factory);
    const { surface, textarea } = mountField({ disabled: true });
    startStimulus();
    await flushStimulus();

    expect(spy.builds).toBe(0);
    expect(surface.hidden).toBe(true);
    expect(textarea.getAttribute("aria-hidden")).toBeNull();
  });

  test("with NO factory published the field stays the server-first textarea (no-op connect)", async () => {
    setCodeEditorFactory(null);
    const { surface, textarea } = mountField();
    startStimulus();
    await flushStimulus();

    expect(surface.hidden).toBe(true);
    expect(textarea.getAttribute("aria-hidden")).toBeNull();
  });

  test("disconnect destroys the editor + re-shows the textarea (Stimulus owns teardown)", async () => {
    const spy = spyFactory();
    setCodeEditorFactory(spy.factory);
    const { root, surface, textarea } = mountField();
    startStimulus();
    await flushStimulus();
    expect(spy.builds).toBe(1);
    expect(textarea.getAttribute("aria-hidden")).toBe("true");

    // Removing the field from the observed tree fires Stimulus disconnect() on the detached subtree
    // (the references stay valid), which is what tears the editor down -- no afterCall sweep.
    root.remove();
    await flushStimulus();
    expect(spy.handles[0].destroyed).toBe(true);
    expect(surface.hidden).toBe(true);
    expect(textarea.getAttribute("aria-hidden")).toBeNull();
  });
});

describe("lv-code-editor controller — morph-safety (real lievit morph)", () => {
  afterEach(() => {
    stopStimulus();
    setCodeEditorFactory(null);
    document.body.innerHTML = "";
  });

  test("a morph that preserves the field does NOT rebuild the editor (single controller, no double-init)", async () => {
    const spy = spyFactory();
    setCodeEditorFactory(spy.factory);
    const { host } = mountField({ language: "json" });
    startStimulus();
    await flushStimulus();
    expect(spy.builds).toBe(1);

    // idiomorph keeps the identical field element -> Stimulus keeps the SAME controller (no
    // reconnect): the editor is neither rebuilt nor torn down (no leaked second CodeMirror view).
    morph(host, hostHtml({ language: "json" }));
    await flushStimulus();

    expect(spy.builds).toBe(1); // not rebuilt
    expect(spy.handles).toHaveLength(1);
    expect(spy.handles[0].destroyed).toBe(false); // the one editor survives the morph
  });

  test("a morph that removes the field destroys the editor (disconnect tears it down)", async () => {
    const spy = spyFactory();
    setCodeEditorFactory(spy.factory);
    const { host } = mountField();
    startStimulus();
    await flushStimulus();
    expect(spy.builds).toBe(1);

    morph(host, `<div data-host></div>`);
    await flushStimulus();

    expect(spy.handles[0].destroyed).toBe(true);
  });

  test("a morph that adds a fresh field connects a new controller (the editor builds for it)", async () => {
    const spy = spyFactory();
    setCodeEditorFactory(spy.factory);
    const host = document.createElement("div");
    host.setAttribute("data-host", "");
    host.innerHTML = `<span>placeholder</span>`;
    document.body.appendChild(host);
    startStimulus();
    await flushStimulus();
    expect(spy.builds).toBe(0);

    morph(host, hostHtml({ language: "html", value: "h1 {}" }));
    await flushStimulus();

    expect(spy.builds).toBe(1);
    expect(spy.lastLanguage).toBe("html");
    expect(spy.lastDoc).toBe("h1 {}");
  });
});
