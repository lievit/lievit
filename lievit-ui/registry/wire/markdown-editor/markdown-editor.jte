@import dev.lievit.component.ComponentMetadata
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui markdown-editor partial (Filament MarkdownEditor parity) -- a SERVER-FIRST markdown
  form field: a toolbar + a <textarea name="..."> + a preview pane. The canonical control is the
  plain textarea, which POSTs its markdown with the surrounding <form> whether or not JS runs. The
  island (markdown-editor.ts) adds the toolbar behaviour (wrap the current selection in markdown
  syntax) and the LIVE PREVIEW (render the markdown to sanitized HTML into the preview pane on
  every input). Nothing about submission depends on the island: the textarea is always the field.

  SERVER-FIRST FALLBACK (the law): JS off renders one native, form-associated control --
  <textarea name="${name}"> -- editable and submittable. The toolbar is plain <button> elements
  that, JS-off, do nothing (no dead links, no broken state); the preview pane starts hidden and is
  only revealed + populated by the island. So a JS-off client sees a clean, working markdown
  textarea.

  CSP: no inline <script>, no on*= handler. The island uses a CSP-safe markdown lib (e.g. `marked`,
  which does not use eval) + a sanitizer (e.g. DOMPurify) so the preview cannot inject script.
  The renderer is injected by the adopter (the seam) so the lib + sanitizer are pinned downstream.

  Params:
    name        String   the form field name the <textarea> POSTs under (REQUIRED)
    value       String   initial markdown (seeds the textarea + the first preview)
    rows        int      textarea rows
    placeholder String   placeholder text
    disabled    boolean  disable the control
    label       String   accessible label for the textarea
    _component  ComponentMetadata  wire metadata (className anchor); optional for static use
--%>
@param String name
@param String value = ""
@param int rows = 10
@param String placeholder = ""
@param boolean disabled = false
@param String label = "Markdown editor"
@param ComponentMetadata _component = null
!{var cid = _component == null ? "" : _component.className();}
!{var fieldId = "lv-md-" + name;}
!{var previewId = "lv-md-preview-" + name;}
<%-- Behaviour is the lv-markdown-editor Stimulus controller (CSP-clean data-controller/data-action,
     never an inline <script> / on*= handler). JS-off the textarea below is still the posted field. --%>
<div
    @if(!cid.isEmpty())data-lievit-component="${cid}"@endif
    data-controller="lv-markdown-editor"
    data-markdown-editor
    data-markdown-editor-disabled="${disabled ? "true" : "false"}"
    style="display: block; font-family: var(--lv-font-sans); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); background: var(--lv-color-surface); overflow: hidden;"
>
    <div
        data-markdown-editor-toolbar
        data-lv-markdown-editor-target="toolbar"
        role="toolbar"
        aria-label="Markdown formatting"
        hidden
        style="display: flex; flex-wrap: wrap; gap: var(--lv-space-1); padding: var(--lv-space-2); border-bottom: 1px solid var(--lv-color-border); background: var(--lv-color-bg);"
    >
        <button type="button" data-markdown-cmd="bold" data-action="click->lv-markdown-editor#command" aria-label="Bold" style="min-width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer; font-weight: var(--lv-font-bold);">B</button>
        <button type="button" data-markdown-cmd="italic" data-action="click->lv-markdown-editor#command" aria-label="Italic" style="min-width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer; font-style: italic;">I</button>
        <button type="button" data-markdown-cmd="heading" data-action="click->lv-markdown-editor#command" aria-label="Heading" style="min-width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer;">H</button>
        <button type="button" data-markdown-cmd="link" data-action="click->lv-markdown-editor#command" aria-label="Link" style="min-width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer;">&#128279;</button>
        <button type="button" data-markdown-cmd="code" data-action="click->lv-markdown-editor#command" aria-label="Inline code" style="min-width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer; font-family: var(--lv-font-mono);">&lt;&gt;</button>
        <button type="button" data-markdown-cmd="quote" data-action="click->lv-markdown-editor#command" aria-label="Quote" style="min-width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer;">&rdquo;</button>
        <button type="button" data-markdown-cmd="ul" data-action="click->lv-markdown-editor#command" aria-label="Bullet list" style="min-width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer;">&bull;</button>
        <button type="button" data-markdown-preview-toggle data-lv-markdown-editor-target="toggle" data-action="click->lv-markdown-editor#togglePreview" aria-label="Toggle preview" aria-pressed="false" style="margin-left: auto; height: 2rem; padding: 0 var(--lv-space-2); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer; font-size: var(--lv-text-sm);">Preview</button>
    </div>

    <div data-markdown-editor-panes style="display: flex; align-items: stretch;">
        <textarea
            id="${fieldId}"
            name="${name}"
            rows="${rows}"
            placeholder="${placeholder}"
            aria-label="${label}"
            disabled="${disabled}"
            data-markdown-editor-input
            data-lv-markdown-editor-target="input"
            data-action="input->lv-markdown-editor#refresh"
            style="display: block; flex: 1 1 0; min-width: 0; box-sizing: border-box; border: 0; padding: var(--lv-space-3); background: var(--lv-color-surface); color: var(--lv-color-fg); font-family: var(--lv-font-mono); font-size: var(--lv-text-sm); resize: vertical; line-height: var(--lv-leading-normal);"
        >${value}</textarea>
        <div
            id="${previewId}"
            data-markdown-editor-preview
            data-lv-markdown-editor-target="preview"
            aria-label="Preview"
            aria-live="polite"
            hidden
            style="flex: 1 1 0; min-width: 0; padding: var(--lv-space-3); border-left: 1px solid var(--lv-color-border); background: var(--lv-color-bg); color: var(--lv-color-fg); overflow: auto; line-height: var(--lv-leading-normal);"
        ></div>
    </div>
</div>
