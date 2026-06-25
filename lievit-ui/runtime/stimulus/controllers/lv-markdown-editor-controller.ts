/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-markdown-editor` -- the server-first markdown form field (Filament MarkdownEditor parity), as
 * a Stimulus controller (the conversion of the registry:wire island
 * `registry/wire/markdown-editor/markdown-editor.ts`). Mounted on the field ROOT via
 * `data-controller="lv-markdown-editor"`.
 *
 * SERVER-FIRST CONTRACT (never broken): the partial's `<textarea name="...">` is the posted form
 * control with or without JS. This controller ONLY ADDS behaviour to it -- the toolbar buttons wrap
 * the current textarea selection in markdown syntax (the same edit a user could type by hand, the
 * PURE {@link applyCommand} transform), and the preview pane renders the markdown to sanitized HTML
 * on every input. Nothing here changes what the form submits: the textarea's value is always the
 * field. So even with the controller torn down (JS off) the textarea is the working, submittable
 * control and the toolbar stays hidden (no dead UI).
 *
 * The controlled/uncontrolled doctrine, honoured: this field NEVER round-trips the wire. There is no
 * close action, no `data-lv-wire-close`, no `callWire` -- every gesture (toolbar edit, preview
 * toggle) is purely client-side, so a `/lievit/<id>/call` is NEVER emitted. It is "uncontrolled" by
 * construction (its state is the textarea the form already owns), which is why it extends the plain
 * {@link Controller}, not {@link DismissableController}: there is no dismiss to gate.
 *
 * CSP: behaviour lives in this module -- no `eval`, no `new Function`, no inline `<script>`, no
 * `on*=` handler. The toolbar/toggle/input wiring is declared in the `.jte` as CSP-clean
 * `data-action` descriptors (re-bound for free across the wire morph by Stimulus's action observer).
 * The markdown renderer (default: a `marked` + DOMPurify pair) is injected via {@link
 * setMarkdownRenderer} so the adopter pins the lib + sanitizer; the output is sanitized before it
 * touches `innerHTML`, so the preview cannot inject script under a strict CSP. With no renderer
 * published the preview is simply not wired (the textarea + toolbar still work).
 *
 * Morph-safety: Stimulus connects this controller once per element+identifier and disconnects it
 * when a wire morph drops the root; the `data-action` listeners are re-bound automatically on the
 * re-rendered descendants. No `data-markdown-editor-wired` marker, no teardown sweep -- the
 * hand-rolled idempotency of the old island is gone because Stimulus owns the lifecycle.
 */

import { Controller } from "@hotwired/stimulus";

/** Renders markdown to SANITIZED HTML. Injected so the lib + sanitizer are pinned by the adopter. */
export type MarkdownRenderer = (markdown: string) => string;

/** A textarea selection: the value + the selection bounds. The unit of the pure transform. */
export interface Selection {
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

/** The result of a markdown transform: the new value + where to put the selection after. */
export interface TransformResult {
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

/**
 * The adopter-injected markdown renderer (module singleton, the same seam shape as the wire bridge):
 * the Stimulus {@link Application} instantiates controllers itself, so a per-instance `render`
 * option (the old island's contract) is published here once instead. `null` until the adopter calls
 * {@link setMarkdownRenderer}; while null the preview stays unwired (toolbar + textarea still work).
 */
let markdownRenderer: MarkdownRenderer | null = null;

/**
 * Publishes the markdown -> safe-HTML renderer for every `lv-markdown-editor` on the page. Called
 * once from the adopter's `main.ts` (alongside `startStimulus`), e.g.
 * `setMarkdownRenderer((md) => DOMPurify.sanitize(marked.parse(md, { async: false }) as string))`.
 *
 * @param renderer the renderer, or `null` to clear it (preview becomes unwired; test teardown)
 */
export function setMarkdownRenderer(renderer: MarkdownRenderer | null): void {
  markdownRenderer = renderer;
}

/** The published markdown renderer, or `null` before the adopter wired one. */
export function getMarkdownRenderer(): MarkdownRenderer | null {
  return markdownRenderer;
}

/**
 * Apply a markdown toolbar command to a selection, PURELY (no DOM). The testable core: inline
 * commands wrap the selection in a marker (toggle off if already wrapped); block commands prefix the
 * line(s). Returns the new value + the selection to restore.
 *
 * @param cmd the toolbar command id (`data-markdown-cmd`)
 * @param sel the current textarea selection
 * @returns the transformed value + the selection to restore
 */
export function applyCommand(cmd: string, sel: Selection): TransformResult {
  switch (cmd) {
    case "bold":
      return wrapInline(sel, "**", "**", "bold text");
    case "italic":
      return wrapInline(sel, "_", "_", "italic text");
    case "code":
      return wrapInline(sel, "`", "`", "code");
    case "link":
      return wrapLink(sel);
    case "heading":
      return prefixLines(sel, "## ");
    case "quote":
      return prefixLines(sel, "> ");
    case "ul":
      return prefixLines(sel, "- ");
    default:
      return { value: sel.value, selectionStart: sel.start, selectionEnd: sel.end };
  }
}

/** Wrap (or unwrap, if already wrapped) the selection in `open`/`close` markers. */
function wrapInline(
  sel: Selection,
  open: string,
  close: string,
  placeholder: string,
): TransformResult {
  const before = sel.value.slice(0, sel.start);
  const selected = sel.value.slice(sel.start, sel.end) || placeholder;
  const after = sel.value.slice(sel.end);

  // Toggle off: selection already wrapped by the exact markers.
  const wrappedOutside =
    before.endsWith(open) && after.startsWith(close) && sel.start !== sel.end;
  if (wrappedOutside) {
    const newValue =
      before.slice(0, before.length - open.length) +
      selected +
      after.slice(close.length);
    const start = sel.start - open.length;
    return { value: newValue, selectionStart: start, selectionEnd: start + selected.length };
  }

  const newValue = `${before}${open}${selected}${close}${after}`;
  const start = sel.start + open.length;
  return { value: newValue, selectionStart: start, selectionEnd: start + selected.length };
}

/** Wrap the selection as a markdown link `[text](url)`, selection landing on the url. */
function wrapLink(sel: Selection): TransformResult {
  const before = sel.value.slice(0, sel.start);
  const text = sel.value.slice(sel.start, sel.end) || "link text";
  const after = sel.value.slice(sel.end);
  const head = `${before}[${text}](`;
  const newValue = `${head}url)${after}`;
  return { value: newValue, selectionStart: head.length, selectionEnd: head.length + "url".length };
}

/** Prefix every line touched by the selection with `prefix` (block command). */
function prefixLines(sel: Selection, prefix: string): TransformResult {
  const lineStart = sel.value.lastIndexOf("\n", sel.start - 1) + 1;
  const lineEndIdx = sel.value.indexOf("\n", sel.end);
  const lineEnd = lineEndIdx === -1 ? sel.value.length : lineEndIdx;
  const head = sel.value.slice(0, lineStart);
  const block = sel.value.slice(lineStart, lineEnd);
  const tail = sel.value.slice(lineEnd);
  const prefixed = block
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
  const newValue = `${head}${prefixed}${tail}`;
  const added = prefixed.length - block.length;
  return {
    value: newValue,
    selectionStart: sel.start + prefix.length,
    selectionEnd: sel.end + added,
  };
}

const DISABLED_ATTR = "data-markdown-editor-disabled";

export default class LvMarkdownEditorController extends Controller<HTMLElement> {
  static targets = ["input", "toolbar", "preview", "toggle"];

  declare readonly hasInputTarget: boolean;
  declare readonly inputTarget: HTMLTextAreaElement;
  declare readonly hasToolbarTarget: boolean;
  declare readonly toolbarTarget: HTMLElement;
  declare readonly hasPreviewTarget: boolean;
  declare readonly previewTarget: HTMLElement;
  declare readonly hasToggleTarget: boolean;
  declare readonly toggleTarget: HTMLElement;

  /**
   * Reveal the toolbar (the server renders it `hidden` so JS-off sees no dead buttons). A disabled
   * field stays the plain textarea: leave the toolbar hidden, wire nothing.
   */
  connect(): void {
    if (this.element.getAttribute(DISABLED_ATTR) === "true") {
      return;
    }
    if (this.hasToolbarTarget) {
      this.toolbarTarget.hidden = false;
    }
  }

  /**
   * A toolbar command button was clicked: apply the pure transform to the current textarea
   * selection, restore the caret, and fire `input` (so the preview, if open, refreshes). The same
   * edit the user could type by hand; submission is unchanged (the textarea is still the field).
   *
   * @param event the click on a `[data-markdown-cmd]` button
   */
  command(event: Event): void {
    if (!this.hasInputTarget) {
      return;
    }
    const button = event.currentTarget as HTMLElement | null;
    const cmd = button?.getAttribute("data-markdown-cmd");
    if (cmd == null || cmd.length === 0) {
      return;
    }
    event.preventDefault();
    const textarea = this.inputTarget;
    const result = applyCommand(cmd, {
      value: textarea.value,
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
    textarea.value = result.value;
    textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    textarea.focus();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /**
   * The preview toggle: reveal/hide the preview pane + render the current markdown. A no-op when no
   * renderer is published (the old "without a renderer the preview is simply not wired" contract).
   *
   * @param event the click on the `[data-markdown-preview-toggle]` button
   */
  togglePreview(event: Event): void {
    event.preventDefault();
    if (markdownRenderer == null || !this.hasPreviewTarget) {
      return;
    }
    const preview = this.previewTarget;
    preview.hidden = !preview.hidden;
    if (this.hasToggleTarget) {
      this.toggleTarget.setAttribute("aria-pressed", preview.hidden ? "false" : "true");
    }
    this.renderPreview();
  }

  /** The textarea fired `input` (typed text or a toolbar edit): re-render the preview if it is open. */
  refresh(): void {
    this.renderPreview();
  }

  /** Render the current markdown into the preview, only when a renderer is published + the pane is shown. */
  private renderPreview(): void {
    const renderer = markdownRenderer;
    if (renderer == null || !this.hasPreviewTarget || !this.hasInputTarget) {
      return;
    }
    if (!this.previewTarget.hidden) {
      this.previewTarget.innerHTML = renderer(this.inputTarget.value);
    }
  }
}
