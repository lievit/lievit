/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-code-editor` -- the server-first code field's progressive enhancement, as a Stimulus
 * controller (the conversion of the hand-rolled `enhanceCodeEditors` / `data-code-editor-wired`
 * idempotency in `registry/wire/code-editor/code-editor.ts`). Mounted on the field ROOT via
 * `data-controller="lv-code-editor"`.
 *
 * SERVER-FIRST CONTRACT (never broken): the `.jte` renders a real, form-associated monospace
 * `<textarea name=...>` (target `input`) that POSTs with the surrounding `<form>` whether or not
 * this controller runs. On `connect()` the controller seeds a CodeMirror 6 view from the textarea's
 * value into the hidden mount point (target `surface`), reveals the surface, hides the textarea (it
 * STAYS in the DOM and the form: it is the posted control), and on every document change writes the
 * source back into the textarea + dispatches a native `input` so wire `l:model` / dirty-tracking
 * observe it. JS off, no engine published, or `disabled` => the textarea is the editor.
 *
 * CONTROLLED / UNCONTROLLED doctrine: N/A here, by construction. A code field is not a dismissable
 * overlay -- it owns no open/close state and NEVER round-trips the wire (zero `/lievit/<id>/call`).
 * So it extends `Controller`, not `DismissableController`; there is no `data-lv-wire-close`, and the
 * uncontrolled-silence invariant holds trivially (it makes no wire call on any path).
 *
 * ENGINE INJECTION (the seam): CodeMirror is wrapped behind {@link CodeEditorFactory} so (a) the
 * adopter pins the CodeMirror version + the language pack(s) + extensions, and (b) the controller's
 * pure orchestration (seed, reveal, writeback, teardown) is unit-testable without booting a real
 * CodeMirror in happy-dom. A Stimulus controller cannot be constructor-injected (the Application
 * instantiates it), so the factory is published as a module singleton via {@link setCodeEditorFactory}
 * -- the same pattern `bridge.ts` uses to publish the runtime. No factory published => `connect()`
 * is a no-op and the server-first textarea stays the editor. The adopter calls
 * `setCodeEditorFactory(...)` once from `main.ts`, replacing the old `enhanceCodeEditors({ factory })`.
 *
 * CSP: behaviour lives in this module (no inline `<script>` / `on*=`); CodeMirror 6 is CSP-clean
 * (no eval, no `new Function`; its theming injects a `<style>` element via style-mod, a DOM API).
 *
 * Morph-safety: the editor is built in `connect()` and torn down in `disconnect()`; Stimulus owns
 * the lifecycle, so a wire morph + idiomorph + Turbo Drive visit connects each field once and
 * destroys the view when the field leaves the DOM -- no `data-code-editor-wired` marker, no
 * `afterCall` teardown sweep, no leaked CodeMirror views.
 *
 * Usage (adopter, after `npm i codemirror @codemirror/state @codemirror/view @codemirror/lang-javascript`):
 * ```ts
 * import { EditorView, basicSetup } from "codemirror";
 * import { javascript } from "@codemirror/lang-javascript";
 * import { setCodeEditorFactory } from "lievit-ui/runtime/stimulus/controllers/lv-code-editor-controller.js";
 * setCodeEditorFactory(({ element, doc, language, onUpdate }) => {
 *   const view = new EditorView({
 *     doc,
 *     parent: element,
 *     extensions: [
 *       basicSetup,
 *       language === "javascript" ? javascript() : [],
 *       EditorView.updateListener.of((u) => { if (u.docChanged) onUpdate(u.state.doc.toString()); }),
 *     ],
 *   });
 *   return { destroy: () => view.destroy() };
 * });
 * ```
 */

import { Controller } from "@hotwired/stimulus";

/** The minimal editor handle the controller holds. Maps onto a CodeMirror `EditorView`. */
export interface CodeEditorHandle {
  /** Tear the editor down (called from `disconnect()`). */
  readonly destroy: () => void;
}

/** Inputs the factory receives to build the concrete (CodeMirror) editor. */
export interface CodeEditorFactoryArgs {
  /** The element CodeMirror mounts into (the `surface` target). */
  readonly element: HTMLElement;
  /** The seed document (the textarea's current value). */
  readonly doc: string;
  /** The language id from the `language` value (may be empty). */
  readonly language: string;
  /** Call on every document change with the source; the controller writes it to the textarea. */
  readonly onUpdate: (doc: string) => void;
}

/** Builds the concrete editor. The adopter supplies the pinned CodeMirror build; injectable for tests. */
export type CodeEditorFactory = (args: CodeEditorFactoryArgs) => CodeEditorHandle;

let factoryRef: CodeEditorFactory | null = null;

/**
 * Publishes the CodeMirror factory so every `lv-code-editor` controller can build its view. Called
 * once by the adopter's `main.ts` (the Stimulus-era replacement for `enhanceCodeEditors({ factory })`);
 * a test calls it directly with a fake factory. Pass `null` to clear it (test teardown).
 *
 * @param factory the editor factory, or `null` to unpublish it (then the controller no-ops)
 */
export function setCodeEditorFactory(factory: CodeEditorFactory | null): void {
  factoryRef = factory;
}

/** The published factory, or `null` before {@link setCodeEditorFactory} ran (server-first fallback). */
export function getCodeEditorFactory(): CodeEditorFactory | null {
  return factoryRef;
}

/**
 * Write the editor doc into the textarea + fire a native `input` so wire/dirty-tracking observe it.
 * Idempotent: a no-op (no `input` event) when the value is unchanged.
 *
 * @param textarea the posted form control
 * @param doc      the current editor source
 */
export function writeBack(textarea: HTMLTextAreaElement, doc: string): void {
  if (textarea.value === doc) {
    return;
  }
  textarea.value = doc;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
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

export default class LvCodeEditorController extends Controller<HTMLElement> {
  static targets = ["surface", "input"];
  static values = { language: String, disabled: Boolean };

  declare readonly hasSurfaceTarget: boolean;
  declare readonly surfaceTarget: HTMLElement;
  declare readonly hasInputTarget: boolean;
  declare readonly inputTarget: HTMLTextAreaElement;
  declare readonly languageValue: string;
  declare readonly disabledValue: boolean;

  /** The live editor handle while enhanced, or `null` when the field stayed the plain textarea. */
  private editor: CodeEditorHandle | null = null;

  connect(): void {
    // Server-first fallback (the law): leave the textarea as the editor when it cannot be enhanced.
    if (this.disabledValue) {
      return;
    }
    const factory = getCodeEditorFactory();
    if (factory == null) {
      return; // no engine published -> the textarea stays the posted, editable control
    }
    if (!this.hasSurfaceTarget || !this.hasInputTarget) {
      return; // server-first contract intact: missing parts => the textarea simply stays the editor
    }

    const textarea = this.inputTarget;
    const surface = this.surfaceTarget;
    this.editor = factory({
      element: surface,
      doc: textarea.value,
      language: this.languageValue,
      onUpdate: (doc) => writeBack(textarea, doc),
    });
    surface.hidden = false;
    hideTextareaVisually(textarea);
  }

  disconnect(): void {
    if (this.editor == null) {
      return; // never enhanced (disabled / no factory) -> nothing to tear down
    }
    this.editor.destroy();
    this.editor = null;
    // Restore the textarea only if it is still in the tree (a morph that removed the whole field
    // takes the textarea with it, so there is nothing to re-show).
    if (this.hasSurfaceTarget) {
      this.surfaceTarget.hidden = true;
    }
    if (this.hasInputTarget) {
      restoreTextareaVisually(this.inputTarget);
    }
  }
}
