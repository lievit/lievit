/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The CSP-clean island that enhances a server-first markdown field
 * (registry/wire/markdown-editor/markdown-editor.jte): toolbar selection-wrapping + a live preview.
 *
 * SERVER-FIRST CONTRACT (never broken): the partial's `<textarea name="...">` is the posted form
 * control with or without JS. This island only ADDS behaviour to it -- the toolbar buttons wrap
 * the current textarea selection in markdown syntax (the same edit a user could type by hand), and
 * the preview pane renders the markdown to sanitized HTML on every input. Nothing here changes
 * what the form submits: the textarea's value is always the field.
 *
 * CSP: no `eval`, no `new Function`, no inline `<script>`, no `on*=` handler -- `addEventListener`
 * + DOM APIs only. The markdown renderer (default: a `marked` + DOMPurify pair the adopter wires)
 * does not use eval and the output is sanitized before it touches `innerHTML`, so the preview
 * cannot inject script under a strict CSP.
 *
 * RENDERER INJECTION (the seam): the markdown->safe-HTML render is injected via {@link MarkdownRenderer}
 * so the adopter pins the lib + sanitizer; the toolbar transform logic is pure and unit-tested here
 * with no lib. With no renderer, the preview toggle is simply not wired (the textarea still works).
 *
 * Usage (adopter, after `npm i marked dompurify`):
 * ```ts
 * import { marked } from "marked";
 * import DOMPurify from "dompurify";
 * import { enhanceMarkdownEditors } from "./components/ui/markdown-editor.js";
 * enhanceMarkdownEditors({
 *   render: (md) => DOMPurify.sanitize(marked.parse(md, { async: false }) as string),
 * });
 * ```
 */

/** Marks a markdown-editor root so enhancement runs exactly once per element. */
const WIRED = "data-markdown-editor-wired";

/** Renders markdown to SANITIZED HTML. Injected so the lib + sanitizer are pinned by the adopter. */
export type MarkdownRenderer = (markdown: string) => string;

/** Options for {@link enhanceMarkdownEditors}. */
export interface MarkdownEditorOptions {
  /** markdown -> safe HTML. Omit to enhance the toolbar only (no preview). */
  readonly render?: MarkdownRenderer;
  /** The subtree to scan (defaults to `document`). */
  readonly root?: ParentNode;
}

/** A textarea selection: the value, the selection bounds. The unit of the pure transform. */
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
 * Apply a markdown toolbar command to a selection, PURELY (no DOM). This is the testable core:
 * inline commands wrap the selection in a marker (toggle off if already wrapped); block commands
 * prefix the line(s). Returns the new value + the selection to restore.
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

/**
 * Enhance every server-first `[data-markdown-editor]` in `root`. Idempotent; disabled roots are
 * left as the plain textarea. Returns a teardown removing exactly the listeners this call added.
 */
export function enhanceMarkdownEditors(options: MarkdownEditorOptions = {}): () => void {
  const root: ParentNode = options.root ?? document;
  const teardowns: Array<() => void> = [];
  for (const el of collectRoots(root, "[data-markdown-editor]")) {
    if (el.getAttribute(WIRED) === "true") {
      continue;
    }
    if (el.getAttribute("data-markdown-editor-disabled") === "true") {
      continue;
    }
    el.setAttribute(WIRED, "true");
    const teardown = wireOne(el, options.render);
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

/** Wire one markdown-editor root; returns a teardown. */
function wireOne(rootEl: HTMLElement, render?: MarkdownRenderer): (() => void) | null {
  const textarea = rootEl.querySelector<HTMLTextAreaElement>(
    "[data-markdown-editor-input]",
  );
  const toolbar = rootEl.querySelector<HTMLElement>(
    "[data-markdown-editor-toolbar]",
  );
  if (!textarea) {
    return null;
  }
  if (toolbar) {
    toolbar.hidden = false;
  }

  const cleanups: Array<() => void> = [];

  // Toolbar selection-wrapping.
  if (toolbar) {
    const onCmd = (event: Event): void => {
      const button = event.currentTarget as HTMLElement | null;
      const cmd = button?.getAttribute("data-markdown-cmd");
      if (!cmd) {
        return;
      }
      event.preventDefault();
      const result = applyCommand(cmd, {
        value: textarea.value,
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      });
      textarea.value = result.value;
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
      textarea.focus();
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const cmdButtons = Array.from(
      toolbar.querySelectorAll<HTMLButtonElement>("[data-markdown-cmd]"),
    );
    for (const button of cmdButtons) {
      button.addEventListener("click", onCmd);
      cleanups.push(() => button.removeEventListener("click", onCmd));
    }
  }

  // Live preview (only when a renderer is supplied).
  const preview = rootEl.querySelector<HTMLElement>(
    "[data-markdown-editor-preview]",
  );
  const toggle = toolbar?.querySelector<HTMLButtonElement>(
    "[data-markdown-preview-toggle]",
  );
  if (render && preview && toggle) {
    const refresh = (): void => {
      if (!preview.hidden) {
        preview.innerHTML = render(textarea.value);
      }
    };
    const onToggle = (event: Event): void => {
      event.preventDefault();
      preview.hidden = !preview.hidden;
      toggle.setAttribute("aria-pressed", preview.hidden ? "false" : "true");
      refresh();
    };
    const onInput = (): void => refresh();
    toggle.addEventListener("click", onToggle);
    textarea.addEventListener("input", onInput);
    cleanups.push(() => toggle.removeEventListener("click", onToggle));
    cleanups.push(() => textarea.removeEventListener("input", onInput));
  }

  return () => {
    for (const c of cleanups) {
      c();
    }
    if (toolbar) {
      toolbar.hidden = true;
    }
    rootEl.removeAttribute(WIRED);
  };
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
