/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The CSP-clean island that progressively enhances a server-first rich-text field
 * (registry/wire/rich-editor/rich-editor.jte) into a TipTap (ProseMirror) WYSIWYG editor.
 *
 * SERVER-FIRST CONTRACT (never broken): the partial renders a real, form-associated
 * `<textarea name="...">` that POSTs with the surrounding `<form>` whether or not this island
 * runs. This module finds that textarea, builds a TipTap editor seeded from its current value,
 * reveals the toolbar + the editing surface, hides the textarea (it STAYS in the DOM and in the
 * form: it is still the posted control), and on every editor update writes `editor.getHTML()`
 * back into the textarea + dispatches a native `input` event so wire `l:model` / dirty-tracking
 * still observe the field. JS off => the textarea is the editor. JS on => TipTap drives it.
 *
 * CSP: no `eval`, no `new Function`, no inline `<script>`, no `on*=` handler -- `addEventListener`
 * + the TipTap API only. TipTap / ProseMirror are CSP-clean; ProseMirror injects its view CSS as a
 * `<style>` element (DOM API), not inline style attributes, so a strict CSP (no `unsafe-inline`)
 * passes.
 *
 * ENGINE INJECTION (the seam): TipTap is wrapped behind {@link EditorFactory} so (a) the adopter
 * pins the TipTap version + the exact extension set they want, and (b) this module's pure
 * orchestration (find textarea, reveal, writeback, command dispatch, teardown) is unit-testable
 * without booting a real ProseMirror in jsdom/happy-dom. The default factory builds a TipTap
 * StarterKit editor; pass your own to add tables, links, images, mentions, etc.
 *
 * Usage (adopter calls once from main.ts after startLievit(), having `npm i @tiptap/core
 * @tiptap/starter-kit`):
 * ```ts
 * import { Editor } from "@tiptap/core";
 * import StarterKit from "@tiptap/starter-kit";
 * import { enhanceRichEditors } from "./components/ui/rich-editor.js";
 * enhanceRichEditors({
 *   factory: ({ element, content, onUpdate }) =>
 *     new Editor({ element, content, extensions: [StarterKit], onUpdate: ({ editor }) =>
 *       onUpdate(editor.getHTML()) }),
 * });
 * ```
 */

/** Marks a rich-editor root so enhancement runs exactly once per element. */
const WIRED = "data-rich-editor-wired";

/** The minimal editor handle the island drives. Maps 1:1 onto a TipTap `Editor`. */
export interface EditorHandle {
  /** Run a named formatting command (bold / italic / heading / ...) with an optional arg. */
  readonly command: (name: string, arg?: string) => void;
  /** Whether a named command's mark/node is currently active (drives aria-pressed). */
  readonly isActive: (name: string, arg?: string) => boolean;
  /** Tear the editor down (called on enhancer teardown). */
  readonly destroy: () => void;
}

/** Inputs the factory receives to build the concrete (TipTap) editor. */
export interface EditorFactoryArgs {
  /** The element TipTap mounts into (`[data-rich-editor-surface]`). */
  readonly element: HTMLElement;
  /** The seed HTML (the textarea's current value). */
  readonly content: string;
  /** Call on every editor change with the serialized HTML; the island writes it to the textarea. */
  readonly onUpdate: (html: string) => void;
}

/** Builds the concrete editor. Default wraps TipTap; injectable for tests + custom extension sets. */
export type EditorFactory = (args: EditorFactoryArgs) => EditorHandle;

/** Options for {@link enhanceRichEditors}. */
export interface RichEditorOptions {
  /** The editor factory (REQUIRED: the adopter supplies the pinned TipTap build). */
  readonly factory: EditorFactory;
  /** The subtree to scan (defaults to `document`). */
  readonly root?: ParentNode;
}

/**
 * Enhance every server-first `[data-rich-editor]` in `root` into a TipTap editor. Idempotent: a
 * root already wired (e.g. re-scanned after a wire morph) is skipped. Disabled roots
 * (`data-rich-editor-disabled="true"`) are left as the plain textarea.
 *
 * @returns a teardown that destroys the editors + restores the textareas this call enhanced.
 */
export function enhanceRichEditors(options: RichEditorOptions): () => void {
  const root: ParentNode = options.root ?? document;
  const teardowns: Array<() => void> = [];
  for (const el of collectRoots(root, "[data-rich-editor]")) {
    if (el.getAttribute(WIRED) === "true") {
      continue;
    }
    // Migration guard (Stimulus conversion): a root converted to the `lv-rich-editor` Stimulus
    // controller owns its own editor build. This legacy enhancer must NOT also enhance it, or the
    // surface would mount two editors. Converted templates carry data-controller="lv-rich-editor";
    // mark it wired and skip.
    if (el.matches('[data-controller~="lv-rich-editor"]')) {
      el.setAttribute(WIRED, "true");
      continue;
    }
    if (el.getAttribute("data-rich-editor-disabled") === "true") {
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

/** Wire one rich-editor root; returns a teardown, or null if the required parts are missing. */
function wireOne(rootEl: HTMLElement, factory: EditorFactory): (() => void) | null {
  const textarea = rootEl.querySelector<HTMLTextAreaElement>(
    "[data-rich-editor-input]",
  );
  const surface = rootEl.querySelector<HTMLElement>(
    "[data-rich-editor-surface]",
  );
  const toolbar = rootEl.querySelector<HTMLElement>(
    "[data-rich-editor-toolbar]",
  );
  if (!textarea || !surface) {
    // Server-first contract intact: no surface => the textarea simply stays the editor.
    return null;
  }

  const editor = factory({
    element: surface,
    content: textarea.value,
    onUpdate: (html) => writeBack(textarea, html),
  });

  // Reveal the rich surface; hide (but KEEP) the textarea -- it is still the posted control.
  surface.hidden = false;
  toolbar && (toolbar.hidden = false);
  hideTextareaVisually(textarea);

  const removeToolbar = toolbar ? wireToolbar(toolbar, editor) : () => {};

  return () => {
    removeToolbar();
    editor.destroy();
    surface.hidden = true;
    toolbar && (toolbar.hidden = true);
    restoreTextareaVisually(textarea);
    rootEl.removeAttribute(WIRED);
  };
}

/** Wire the toolbar buttons to editor commands; returns a teardown removing the listeners. */
export function wireToolbar(toolbar: HTMLElement, editor: EditorHandle): () => void {
  const buttons = Array.from(
    toolbar.querySelectorAll<HTMLButtonElement>("[data-rich-editor-cmd]"),
  );
  const onClick = (event: Event): void => {
    const button = (event.currentTarget as HTMLElement) ?? null;
    if (!button) {
      return;
    }
    const cmd = button.getAttribute("data-rich-editor-cmd");
    if (!cmd) {
      return;
    }
    event.preventDefault();
    const arg = button.getAttribute("data-rich-editor-arg") ?? undefined;
    editor.command(cmd, arg);
    syncPressed(buttons, editor);
  };
  for (const button of buttons) {
    button.addEventListener("click", onClick);
  }
  return () => {
    for (const button of buttons) {
      button.removeEventListener("click", onClick);
    }
  };
}

/** Reflect each toolbar button's active state into aria-pressed (called after a command). */
export function syncPressed(buttons: HTMLButtonElement[], editor: EditorHandle): void {
  for (const button of buttons) {
    const cmd = button.getAttribute("data-rich-editor-cmd");
    if (!cmd) {
      continue;
    }
    const arg = button.getAttribute("data-rich-editor-arg") ?? undefined;
    button.setAttribute("aria-pressed", editor.isActive(cmd, arg) ? "true" : "false");
  }
}

/** Write the editor HTML into the textarea + fire a native `input` so wire/dirty observe it. */
export function writeBack(textarea: HTMLTextAreaElement, html: string): void {
  if (textarea.value === html) {
    return;
  }
  textarea.value = html;
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
