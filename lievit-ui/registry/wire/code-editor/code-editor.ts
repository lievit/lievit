/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The CSP-clean island that progressively enhances a server-first code field
 * (registry/wire/code-editor/code-editor.jte) into a CodeMirror 6 editor.
 *
 * SERVER-FIRST CONTRACT (never broken): the partial renders a real, form-associated monospace
 * `<textarea name="...">` that POSTs with the surrounding `<form>` whether or not this island runs.
 * This module finds that textarea, builds a CodeMirror view seeded from its value, reveals the
 * editor surface, hides the textarea (it STAYS in the DOM and the form: it is the posted control),
 * and on every document change writes the source back into the textarea + dispatches a native
 * `input` event so wire `l:model` / dirty-tracking observe the field. JS off => the textarea is the
 * editor. JS on => CodeMirror drives it.
 *
 * CSP: no `eval`, no `new Function`, no inline `<script>`, no `on*=` handler -- `addEventListener` +
 * the CodeMirror API only. CodeMirror 6 is CSP-clean (no eval; theming injects a `<style>` element
 * via style-mod, not inline style attributes), so a strict CSP passes.
 *
 * ENGINE INJECTION (the seam): CodeMirror is wrapped behind {@link CodeEditorFactory} so (a) the
 * adopter pins the CodeMirror version + the language pack(s) + extensions, and (b) this module's
 * pure orchestration (find textarea, reveal, writeback, teardown) is unit-testable without booting
 * a real CodeMirror in happy-dom. The language id (`data-code-editor-language`) is passed to the
 * factory so the adopter maps it to the right `@codemirror/lang-*`.
 *
 * Usage (adopter, after `npm i codemirror @codemirror/state @codemirror/view @codemirror/lang-javascript`):
 * ```ts
 * import { EditorView, basicSetup } from "codemirror";
 * import { javascript } from "@codemirror/lang-javascript";
 * import { enhanceCodeEditors } from "./components/ui/code-editor.js";
 * enhanceCodeEditors({
 *   factory: ({ element, doc, language, onUpdate }) => {
 *     const view = new EditorView({
 *       doc,
 *       parent: element,
 *       extensions: [
 *         basicSetup,
 *         language === "javascript" ? javascript() : [],
 *         EditorView.updateListener.of((u) => { if (u.docChanged) onUpdate(u.state.doc.toString()); }),
 *       ],
 *     });
 *     return { destroy: () => view.destroy() };
 *   },
 * });
 * ```
 */

/** Marks a code-editor root so enhancement runs exactly once per element. */
const WIRED = "data-code-editor-wired";

/** The minimal editor handle the island holds. Maps onto a CodeMirror `EditorView`. */
export interface CodeEditorHandle {
  /** Tear the editor down (called on enhancer teardown). */
  readonly destroy: () => void;
}

/** Inputs the factory receives to build the concrete (CodeMirror) editor. */
export interface CodeEditorFactoryArgs {
  /** The element CodeMirror mounts into (`[data-code-editor-surface]`). */
  readonly element: HTMLElement;
  /** The seed document (the textarea's current value). */
  readonly doc: string;
  /** The language id from `data-code-editor-language` (may be empty). */
  readonly language: string;
  /** Call on every document change with the source; the island writes it to the textarea. */
  readonly onUpdate: (doc: string) => void;
}

/** Builds the concrete editor. Default wraps CodeMirror; injectable for tests + language packs. */
export type CodeEditorFactory = (args: CodeEditorFactoryArgs) => CodeEditorHandle;

/** Options for {@link enhanceCodeEditors}. */
export interface CodeEditorOptions {
  /** The editor factory (REQUIRED: the adopter supplies the pinned CodeMirror build). */
  readonly factory: CodeEditorFactory;
  /** The subtree to scan (defaults to `document`). */
  readonly root?: ParentNode;
}

/**
 * Enhance every server-first `[data-code-editor]` in `root` into a CodeMirror editor. Idempotent;
 * disabled roots are left as the plain textarea. Returns a teardown destroying the editors +
 * restoring the textareas this call enhanced.
 */
export function enhanceCodeEditors(options: CodeEditorOptions): () => void {
  const root: ParentNode = options.root ?? document;
  const teardowns: Array<() => void> = [];
  for (const el of collectRoots(root, "[data-code-editor]")) {
    if (el.getAttribute(WIRED) === "true") {
      continue;
    }
    if (el.getAttribute("data-code-editor-disabled") === "true") {
      continue;
    }
    el.setAttribute(WIRED, "true");
    const teardown = wireOne(el, options.factory);
    if (teardown) {
      teardowns.push(teardown);
    }
  }
  return () => {
    for (const t of teardowns) {
      t();
    }
  };
}

/** Wire one code-editor root; returns a teardown, or null if the required parts are missing. */
function wireOne(rootEl: HTMLElement, factory: CodeEditorFactory): (() => void) | null {
  const textarea = rootEl.querySelector<HTMLTextAreaElement>(
    "[data-code-editor-input]",
  );
  const surface = rootEl.querySelector<HTMLElement>(
    "[data-code-editor-surface]",
  );
  if (!textarea || !surface) {
    // Server-first contract intact: no surface => the textarea simply stays the editor.
    return null;
  }

  const editor = factory({
    element: surface,
    doc: textarea.value,
    language: rootEl.getAttribute("data-code-editor-language") ?? "",
    onUpdate: (doc) => writeBack(textarea, doc),
  });

  surface.hidden = false;
  hideTextareaVisually(textarea);

  return () => {
    editor.destroy();
    surface.hidden = true;
    restoreTextareaVisually(textarea);
    rootEl.removeAttribute(WIRED);
  };
}

/** Write the editor doc into the textarea + fire a native `input` so wire/dirty observe it. */
export function writeBack(textarea: HTMLTextAreaElement, doc: string): void {
  if (textarea.value === doc) {
    return;
  }
  textarea.value = doc;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Collect matching roots under `root`, including `root` itself when it matches. */
function collectRoots(root: ParentNode, selector: string): HTMLElement[] {
  const found = Array.from(root.querySelectorAll<HTMLElement>(selector));
  if (
    root instanceof HTMLElement &&
    root.matches(selector) &&
    !found.includes(root)
  ) {
    found.unshift(root);
  }
  return found;
}

/** Visually hide the textarea while keeping it form-associated + submitted. */
function hideTextareaVisually(textarea: HTMLTextAreaElement): void {
  textarea.setAttribute("aria-hidden", "true");
  textarea.tabIndex = -1;
  textarea.style.position = "absolute";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.padding = "0";
  textarea.style.overflow = "hidden";
  textarea.style.clip = "rect(0 0 0 0)";
  textarea.style.whiteSpace = "nowrap";
  textarea.style.border = "0";
}

/** Reverse {@link hideTextareaVisually} (teardown). */
function restoreTextareaVisually(textarea: HTMLTextAreaElement): void {
  textarea.removeAttribute("aria-hidden");
  textarea.removeAttribute("tabindex");
  for (const prop of [
    "position",
    "width",
    "height",
    "padding",
    "overflow",
    "clip",
    "white-space",
    "border",
  ]) {
    textarea.style.removeProperty(prop);
  }
}
