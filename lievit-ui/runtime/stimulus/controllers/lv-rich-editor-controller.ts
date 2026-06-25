/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-rich-editor` -- the server-first rich-text form field (Filament RichEditor / shadcn rich-text
 * parity), as a Stimulus controller (the conversion of the colocated
 * `registry/wire/rich-editor/rich-editor.ts` enhancer). Mounted on the rich-editor ROOT via
 * `data-controller="lv-rich-editor"`.
 *
 * SERVER-FIRST CONTRACT (never broken): the partial renders a real, form-associated
 * `<textarea name="...">` (target `input`) that POSTs with the surrounding `<form>` whether or not
 * this controller connects. On `connect()` it builds a TipTap editor seeded from the textarea's
 * current value, reveals the toolbar + the editing surface, hides the textarea visually (it STAYS in
 * the DOM and in the form: it is still the posted control), and on every editor update writes
 * `editor.getHTML()` back into the textarea + dispatches a native `input` event so wire `l:model` /
 * dirty-tracking still observe the field. JS off => the textarea is the editor. JS on => TipTap
 * drives it. `disconnect()` reverses all of it (so a morph that drops the field tears the editor
 * down cleanly).
 *
 * ENGINE INJECTION (the seam): TipTap is an ADOPTER dependency, not a runtime dependency, so this
 * controller cannot `import "@tiptap/core"`. A Stimulus controller is instantiated by the
 * Application and cannot be constructor-injected, so the adopter publishes its pinned editor build
 * once via {@link setRichEditorFactory} (the module singleton, the same shape as the runtime bridge
 * in `bridge.ts`). No factory published => the controller leaves the textarea as the editor (the
 * server-first fallback is intact, never a dead toolbar). This keeps the version + extension set
 * pinned downstream and the orchestration unit-testable without a real ProseMirror in happy-dom.
 *
 * Controlled / uncontrolled doctrine: this controller issues ZERO wire calls of its own (it extends
 * plain `Controller`, not `DismissableController`). The only server touch is the native `input`
 * event the textarea already fires for `l:model`; there is no overlay to close, so the wire-410
 * "page expired" bug class is structurally absent -- there is nothing to fire spuriously.
 *
 * CSP: behaviour lives in this module; the toolbar buttons carry
 * `data-action="click->lv-rich-editor#runCommand"` (a plain string attribute, no eval, no inline
 * `<script>` / `on*=`). TipTap / ProseMirror are CSP-clean (view CSS injected as a `<style>`
 * element, not inline style attributes).
 *
 * Morph-safety: the toolbar wiring is a declared `data-action`, so Stimulus's action observer
 * re-binds it automatically when a wire morph re-renders a button, and the buttons are read through
 * `commandTargets` (re-resolved on every morph). No `data-rich-editor-wired` marker, no WeakSet, no
 * afterCall sweep -- Stimulus connects this controller once per element+identifier and disconnects
 * it (destroying the editor) when the morph removes the root, so re-enhancing after a morph cannot
 * stack a second listener or build a second editor on the same live element.
 */

import { Controller } from "@hotwired/stimulus";

/** The minimal editor handle the controller drives. Maps 1:1 onto a TipTap `Editor`. */
export interface EditorHandle {
  /** Run a named formatting command (bold / italic / heading / ...) with an optional arg. */
  readonly command: (name: string, arg?: string) => void;
  /** Whether a named command's mark/node is currently active (drives aria-pressed). */
  readonly isActive: (name: string, arg?: string) => boolean;
  /** Tear the editor down (called on disconnect). */
  readonly destroy: () => void;
}

/** Inputs the factory receives to build the concrete (TipTap) editor. */
export interface EditorFactoryArgs {
  /** The element TipTap mounts into (the `surface` target). */
  readonly element: HTMLElement;
  /** The seed HTML (the textarea's current value). */
  readonly content: string;
  /** Call on every editor change with the serialized HTML; the controller writes it to the textarea. */
  readonly onUpdate: (html: string) => void;
}

/** Builds the concrete editor. Wraps TipTap downstream; injectable for tests + custom extension sets. */
export type EditorFactory = (args: EditorFactoryArgs) => EditorHandle;

/**
 * The published editor factory, or `null` before the adopter registered one. A module singleton (the
 * same seam shape as the runtime bridge) because Stimulus instantiates controllers itself and cannot
 * constructor-inject the adopter's pinned TipTap build.
 */
let factoryRef: EditorFactory | null = null;

/**
 * Publishes the adopter's pinned editor factory so every `lv-rich-editor` controller can build its
 * editor. Call once from `main.ts` after `startLievit()` / `startStimulus()`, having
 * `npm i @tiptap/core @tiptap/starter-kit`:
 *
 * ```ts
 * import { Editor } from "@tiptap/core";
 * import StarterKit from "@tiptap/starter-kit";
 * import { setRichEditorFactory } from "lievit-ui/runtime/stimulus";
 * setRichEditorFactory(({ element, content, onUpdate }) =>
 *   new Editor({ element, content, extensions: [StarterKit],
 *     onUpdate: ({ editor }) => onUpdate(editor.getHTML()) }));
 * ```
 *
 * @param factory the editor factory, or `null` to clear it (test teardown / disabling enhancement)
 */
export function setRichEditorFactory(factory: EditorFactory | null): void {
  factoryRef = factory;
}

/** The factory published by the adopter, or `null` before {@link setRichEditorFactory} ran. */
export function getRichEditorFactory(): EditorFactory | null {
  return factoryRef;
}

const DISABLED_ATTR = "data-rich-editor-disabled";
const CMD_ATTR = "data-rich-editor-cmd";
const ARG_ATTR = "data-rich-editor-arg";

export default class LvRichEditorController extends Controller<HTMLElement> {
  static targets = ["input", "surface", "toolbar", "command"];

  declare readonly hasInputTarget: boolean;
  declare readonly inputTarget: HTMLTextAreaElement;
  declare readonly hasSurfaceTarget: boolean;
  declare readonly surfaceTarget: HTMLElement;
  declare readonly hasToolbarTarget: boolean;
  declare readonly toolbarTarget: HTMLElement;
  declare readonly commandTargets: HTMLButtonElement[];

  /** The live editor, or `null` while server-first (disabled, no factory, or missing parts). */
  private editor: EditorHandle | null = null;

  connect(): void {
    // Disabled roots stay the plain textarea; never a dead toolbar.
    if (this.element.getAttribute(DISABLED_ATTR) === "true") {
      return;
    }
    // No editor build is possible without the textarea + the mount surface => server-first stands.
    if (!this.hasInputTarget || !this.hasSurfaceTarget) {
      return;
    }
    const factory = factoryRef;
    if (factory == null) {
      // No engine published (e.g. a non-Stimulus / JS-light adopter): the textarea IS the editor.
      return;
    }

    const textarea = this.inputTarget;
    this.editor = factory({
      element: this.surfaceTarget,
      content: textarea.value,
      onUpdate: (html) => this.writeBack(html),
    });

    // Reveal the rich surface; hide (but KEEP) the textarea -- it is still the posted control.
    this.surfaceTarget.hidden = false;
    if (this.hasToolbarTarget) {
      this.toolbarTarget.hidden = false;
    }
    this.hideTextareaVisually(textarea);
  }

  disconnect(): void {
    if (this.editor == null) {
      return;
    }
    this.editor.destroy();
    this.editor = null;
    if (this.hasSurfaceTarget) {
      this.surfaceTarget.hidden = true;
    }
    if (this.hasToolbarTarget) {
      this.toolbarTarget.hidden = true;
    }
    if (this.hasInputTarget) {
      this.restoreTextareaVisually(this.inputTarget);
    }
  }

  /**
   * Toolbar click handler, wired via `data-action="click->lv-rich-editor#runCommand"` on each
   * `[data-rich-editor-cmd]` button. Runs the matching editor command (with the optional
   * `data-rich-editor-arg`, e.g. a heading level) then reflects every button's active state into
   * `aria-pressed`. A no-op before the editor is built (JS-off / disabled).
   *
   * @param event the click from a toolbar button (currentTarget = the button)
   */
  runCommand(event: Event): void {
    const editor = this.editor;
    if (editor == null) {
      return;
    }
    const button = event.currentTarget as HTMLElement | null;
    const cmd = button?.getAttribute(CMD_ATTR);
    if (cmd == null || cmd.length === 0) {
      return;
    }
    event.preventDefault();
    const arg = button?.getAttribute(ARG_ATTR) ?? undefined;
    editor.command(cmd, arg);
    this.syncPressed();
  }

  /** Reflect each toolbar button's active state into `aria-pressed` (called after a command). */
  private syncPressed(): void {
    const editor = this.editor;
    if (editor == null) {
      return;
    }
    for (const button of this.commandTargets) {
      const cmd = button.getAttribute(CMD_ATTR);
      if (cmd == null || cmd.length === 0) {
        continue;
      }
      const arg = button.getAttribute(ARG_ATTR) ?? undefined;
      button.setAttribute("aria-pressed", editor.isActive(cmd, arg) ? "true" : "false");
    }
  }

  /** Write the editor HTML into the textarea + fire a native `input` so wire/dirty observe it. */
  private writeBack(html: string): void {
    if (!this.hasInputTarget) {
      return;
    }
    const textarea = this.inputTarget;
    if (textarea.value === html) {
      return; // idempotent: the same value does not re-fire input
    }
    textarea.value = html;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /** Visually hide the textarea while keeping it form-associated + submitted. */
  private hideTextareaVisually(textarea: HTMLTextAreaElement): void {
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

  /** Reverse {@link hideTextareaVisually} (disconnect). */
  private restoreTextareaVisually(textarea: HTMLTextAreaElement): void {
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
}
