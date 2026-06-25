/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * rich-editor is a server-first WIRE rich-text field (Filament RichEditor parity): a plain
 * <textarea name=...> is the posted form control JS-off; the `lv-rich-editor` Stimulus controller
 * (runtime/stimulus/controllers/lv-rich-editor-controller.ts) progressively enhances it into a
 * TipTap editor whose HTML is written back into the same textarea. It is the morph-safe successor to
 * the colocated rich-editor.ts enhancer (retained, behind a migration guard, for non-Stimulus
 * adopters). The TipTap engine is an ADOPTER dependency injected once via setRichEditorFactory().
 *
 * This file pins (a) the registry:wire item shape, (b) the JS-off server-first fallback markup IS a
 * real form control + the template is server-pure (no inline script/slot) + carries the
 * data-controller / data-action contract, (c) the legacy enhancer is CSP-clean + skips a converted
 * root, and (d) the controller's DOM behaviour against a DOM shaped like the partial output, driven
 * by the REAL Stimulus Application + the REAL lievit wire morph (no mocked $lievit, no mocked
 * editor: a fake EditorHandle stands in for TipTap, a fetch stub captures the wire round-trips so
 * the "zero wire calls" doctrine is proven, not assumed).
 */
import { describe, test, it, expect, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import { resolve } from "../cli/registry.js";
import type { Registry } from "../cli/registry.js";
import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";
import {
  setRichEditorFactory,
  type EditorHandle,
  type EditorFactory,
} from "../runtime/stimulus/controllers/lv-rich-editor-controller.js";

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

  test("the editor is the lv-rich-editor Stimulus controller, wired CSP-clean via data-action + targets", () => {
    const jteSrc = jte();
    expect(jteSrc).toContain('data-controller="lv-rich-editor"');
    expect(jteSrc).toContain('data-action="click->lv-rich-editor#runCommand"');
    expect(jteSrc).toContain('data-lv-rich-editor-target="input"');
    expect(jteSrc).toContain('data-lv-rich-editor-target="surface"');
    expect(jteSrc).toContain('data-lv-rich-editor-target="toolbar"');
    expect(jteSrc).toContain('data-lv-rich-editor-target="command"');
  });
});

describe("rich-editor legacy enhancer (retained for non-Stimulus adopters)", () => {
  test("the island is CSP-clean: no eval/new Function, no Lit import", () => {
    const ts = read("wire/rich-editor/rich-editor.ts");
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\beval\(|\bnew Function\b/);
    expect(code).not.toMatch(/^import .*from "lit"/m);
    expect(code).toContain("addEventListener");
  });

  test("it skips a Stimulus-controlled root so the controller and enhancer never double-build", () => {
    const ts = read("wire/rich-editor/rich-editor.ts");
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).toContain('[data-controller~="lv-rich-editor"]');
  });
});

// ---------------------------------------------------------------------------
// The lv-rich-editor Stimulus controller, against a DOM shaped like rich-editor.jte's output,
// driven by the REAL Stimulus Application + the REAL lievit wire morph (no mocked $lievit).
// The TipTap engine is a fake EditorHandle injected via setRichEditorFactory().
// ---------------------------------------------------------------------------

/** A real runtime backed by a fetch stub that records the wire actions the runtime POSTs. */
function makeRuntime(): { runtime: LievitRuntime; calledActions: string[] } {
  const calledActions: string[] = [];
  const fetchImpl = async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls) {
      calledActions.push(...calls);
    }
    return new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } });
  };
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calledActions };
}

/** A fake editor handle recording commands; isActive returns true for whatever was last commanded. */
function fakeEditor(): EditorHandle & { last: string | null; destroyed: number } {
  const handle = {
    last: null as string | null,
    destroyed: 0,
    command(name: string) {
      handle.last = name;
    },
    isActive(name: string) {
      return handle.last === name;
    },
    destroy() {
      handle.destroyed += 1;
    },
  };
  return handle;
}

interface Built {
  built: number;
  seeded: string[];
  pushers: Array<(html: string) => void>;
  editors: ReturnType<typeof fakeEditor>[];
}

/** A factory that records every build (seed content + the onUpdate pusher + the editor handle). */
function recordingFactory(): { factory: EditorFactory; rec: Built } {
  const rec: Built = { built: 0, seeded: [], pushers: [], editors: [] };
  const factory: EditorFactory = ({ content, onUpdate }) => {
    rec.built += 1;
    rec.seeded.push(content);
    rec.pushers.push(onUpdate);
    const e = fakeEditor();
    rec.editors.push(e);
    return e;
  };
  return { factory, rec };
}

interface Mounted {
  container: HTMLElement;
  root: HTMLElement;
  toolbar: HTMLElement;
  surface: HTMLElement;
  textarea: HTMLTextAreaElement;
}

/** Build a rich-editor root matching rich-editor.jte's output: toolbar + surface + textarea. */
function renderRoot(opts: { disabled?: boolean; value?: string } = {}): Mounted {
  const container = document.createElement("div");

  const root = document.createElement("div");
  root.setAttribute("data-lievit-component", "dev.lievit.wire.RichEditorComponent");
  root.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  root.setAttribute("data-lievit-snapshot", "s1");
  root.setAttribute("data-controller", "lv-rich-editor");
  root.setAttribute("data-rich-editor", "");
  root.setAttribute("data-rich-editor-disabled", opts.disabled === true ? "true" : "false");

  const toolbar = document.createElement("div");
  toolbar.setAttribute("data-rich-editor-toolbar", "");
  toolbar.setAttribute("data-lv-rich-editor-target", "toolbar");
  toolbar.hidden = true;
  for (const [cmd, arg] of [["bold"], ["italic"], ["heading", "2"]] as [string, string?][]) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-rich-editor-cmd", cmd);
    if (arg != null) {
      b.setAttribute("data-rich-editor-arg", arg);
    }
    b.setAttribute("data-lv-rich-editor-target", "command");
    b.setAttribute("data-action", "click->lv-rich-editor#runCommand");
    b.setAttribute("aria-pressed", "false");
    toolbar.appendChild(b);
  }
  root.appendChild(toolbar);

  const surface = document.createElement("div");
  surface.setAttribute("data-rich-editor-surface", "");
  surface.setAttribute("data-lv-rich-editor-target", "surface");
  surface.hidden = true;
  root.appendChild(surface);

  const textarea = document.createElement("textarea");
  textarea.setAttribute("data-rich-editor-input", "");
  textarea.setAttribute("data-lv-rich-editor-target", "input");
  textarea.name = "body";
  textarea.value = opts.value ?? "<p>seed</p>";
  root.appendChild(textarea);

  container.appendChild(root);
  document.body.appendChild(container);
  return { container, root, toolbar, surface, textarea };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  setRichEditorFactory(null);
  document.body.innerHTML = "";
});

describe("lv-rich-editor controller — enhancement (real Stimulus + real runtime)", () => {
  it("seeds the editor from the textarea, reveals surface + toolbar, hides the textarea", async () => {
    const { runtime } = makeRuntime();
    const { factory, rec } = recordingFactory();
    setRichEditorFactory(factory);
    const { surface, toolbar, textarea } = renderRoot();
    startStimulus({ runtime });
    await flushStimulus();

    expect(rec.built).toBe(1);
    expect(rec.seeded[0]).toBe("<p>seed</p>");
    expect(surface.hidden).toBe(false);
    expect(toolbar.hidden).toBe(false);
    // the textarea stays in the DOM + the form (it is still the posted control), just hidden.
    expect(textarea.isConnected).toBe(true);
    expect(textarea.getAttribute("aria-hidden")).toBe("true");
  });

  it("with no factory published the textarea stays the editor (server-first fallback)", async () => {
    const { runtime } = makeRuntime();
    // setRichEditorFactory NOT called.
    const { surface, toolbar, textarea } = renderRoot();
    startStimulus({ runtime });
    await flushStimulus();

    expect(surface.hidden).toBe(true);
    expect(toolbar.hidden).toBe(true);
    expect(textarea.hasAttribute("aria-hidden")).toBe(false);
  });

  it("a disabled root is left as the plain textarea (no editor built)", async () => {
    const { runtime } = makeRuntime();
    const { factory, rec } = recordingFactory();
    setRichEditorFactory(factory);
    const { surface } = renderRoot({ disabled: true });
    startStimulus({ runtime });
    await flushStimulus();

    expect(rec.built).toBe(0);
    expect(surface.hidden).toBe(true);
  });

  it("the editor's onUpdate writes back to the textarea + fires a native input (idempotent)", async () => {
    const { runtime } = makeRuntime();
    const { factory, rec } = recordingFactory();
    setRichEditorFactory(factory);
    const { textarea } = renderRoot();
    startStimulus({ runtime });
    await flushStimulus();

    let fired = 0;
    textarea.addEventListener("input", () => (fired += 1));
    rec.pushers[0]("<p>typed</p>");
    expect(textarea.value).toBe("<p>typed</p>");
    expect(fired).toBe(1);
    // idempotent: the same value does not re-fire.
    rec.pushers[0]("<p>typed</p>");
    expect(fired).toBe(1);
  });
});

describe("lv-rich-editor controller — toolbar commands", () => {
  it("a toolbar click runs the matching command and reflects active state into aria-pressed", async () => {
    const { runtime } = makeRuntime();
    const { factory, rec } = recordingFactory();
    setRichEditorFactory(factory);
    const { toolbar } = renderRoot();
    startStimulus({ runtime });
    await flushStimulus();

    const boldBtn = toolbar.querySelector<HTMLButtonElement>('[data-rich-editor-cmd="bold"]')!;
    boldBtn.click();
    expect(rec.editors[0].last).toBe("bold");
    expect(boldBtn.getAttribute("aria-pressed")).toBe("true");
    // the other buttons reflect not-active.
    expect(
      toolbar.querySelector('[data-rich-editor-cmd="italic"]')!.getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("the heading button passes its data-rich-editor-arg to the command", async () => {
    const { runtime } = makeRuntime();
    const { factory, rec } = recordingFactory();
    setRichEditorFactory(factory);
    const { toolbar } = renderRoot();
    startStimulus({ runtime });
    await flushStimulus();

    const headingBtn = toolbar.querySelector<HTMLButtonElement>('[data-rich-editor-cmd="heading"]')!;
    headingBtn.click();
    expect(rec.editors[0].last).toBe("heading");
    expect(headingBtn.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("lv-rich-editor controller — controlled/uncontrolled doctrine (zero wire calls)", () => {
  it("never round-trips the wire on enhance, writeback, or a toolbar command", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { factory, rec } = recordingFactory();
    setRichEditorFactory(factory);
    const { toolbar } = renderRoot();
    startStimulus({ runtime });
    await flushStimulus();

    rec.pushers[0]("<p>typed</p>"); // writeback fires a native input, NOT a wire call
    toolbar.querySelector<HTMLButtonElement>('[data-rich-editor-cmd="bold"]')!.click();

    await new Promise((r) => setTimeout(r, 10));
    // the rich-editor owns NO server open-state: it issues zero /lievit/<id>/call (the 410 bug class
    // is structurally absent -- there is no close action to fire).
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-rich-editor controller — morph-safety (real lievit morph)", () => {
  it("after a real morph one click still fires exactly one command (no rebuild, no stacked listeners)", async () => {
    const { runtime } = makeRuntime();
    const { factory, rec } = recordingFactory();
    setRichEditorFactory(factory);
    const { root, container } = renderRoot();
    startStimulus({ runtime });
    await flushStimulus();
    expect(rec.built).toBe(1);

    // A real wire morph re-renders the component subtree (idiomorph). The root markup is identical,
    // so Stimulus keeps the single live controller (element+identifier dedupe): no second editor is
    // built and the data-action stays single.
    morph(container, `<div>${root.outerHTML}</div>`);
    await flushStimulus();
    expect(rec.built).toBe(1);

    const boldBtn = container.querySelector<HTMLButtonElement>('[data-rich-editor-cmd="bold"]')!;
    boldBtn.click();
    // exactly one editor exists; it recorded the single command.
    expect(rec.editors).toHaveLength(1);
    expect(rec.editors[0].last).toBe("bold");
  });

  it("a root removed by a morph tears the editor down (disconnect destroys it)", async () => {
    const { runtime } = makeRuntime();
    const { factory, rec } = recordingFactory();
    setRichEditorFactory(factory);
    const { container } = renderRoot();
    startStimulus({ runtime });
    await flushStimulus();
    expect(rec.built).toBe(1);

    // Morph the rich-editor root out of the tree.
    morph(container, `<div><span>gone</span></div>`);
    await flushStimulus();

    expect(rec.editors[0].destroyed).toBe(1);
  });
});
