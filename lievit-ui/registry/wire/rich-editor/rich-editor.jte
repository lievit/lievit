@import io.lievit.component.ComponentMetadata
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui rich-editor partial (Filament RichEditor / shadcn rich-text parity) -- a SERVER-FIRST
  rich-text form field. The canonical form control is a plain <textarea name="..."> that POSTs its
  value with the surrounding <form>; the island (rich-editor.ts) progressively enhances it into a
  TipTap (ProseMirror) WYSIWYG editor whose serialized HTML is written back into the SAME textarea
  on every change, so the form keeps POSTing the field with or without JavaScript.

  SERVER-FIRST FALLBACK (the law): with JS off this renders exactly one native, form-associated
  control -- <textarea name="${name}"> inside the page's <form>. It is editable, it submits, it is
  labelled. The toolbar and the contenteditable surface are added by the island AFTER hydration and
  are hidden (hidden attribute) until then, so a JS-off client never sees a dead toolbar.

  PROGRESSIVE ENHANCEMENT seam: the island reads `data-rich-editor`, mounts TipTap into
  `[data-rich-editor-surface]`, seeds it from the textarea's current value, then on every TipTap
  update writes editor.getHTML() back to the textarea and dispatches a native `input` event (so wire
  l:model / dirty tracking still observes the field). The textarea becomes visually hidden but stays
  in the DOM and in the form: it is still the posted control. No inline <script>, no on*= handler.

  CSP: TipTap / ProseMirror are CSP-clean (no eval, no inline script; ProseMirror styles are injected
  as a <style> element via the prosemirror-view stylesheet, not inline style attributes). Ship the
  TipTap CSS the adopter chooses; this partial only provides the structural surface + tokens.

  Params:
    name        String   the form field name the <textarea> POSTs under (REQUIRED)
    value       String   the initial HTML value (server-held; seeds both textarea + editor)
    rows        int      textarea rows for the JS-off fallback height
    placeholder String   placeholder text for the empty editor / textarea
    disabled    boolean  disable the control
    label       String   accessible label for the editing surface
    _component  ComponentMetadata  wire metadata (className anchor); optional for static use
--%>
@param String name
@param String value = ""
@param int rows = 8
@param String placeholder = ""
@param boolean disabled = false
@param String label = "Rich text editor"
@param ComponentMetadata _component = null
!{var cid = _component == null ? "" : _component.className();}
!{var fieldId = "lv-rich-" + name;}
<div
    @if(!cid.isEmpty())data-lievit-component="${cid}"@endif
    data-rich-editor
    data-rich-editor-disabled="${disabled ? "true" : "false"}"
    style="display: block; font-family: var(--lv-font-sans); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); background: var(--lv-color-surface); overflow: hidden;"
>
    <%-- Toolbar: hidden until the island reveals it (JS-off never sees a dead toolbar). --%>
    <div
        data-rich-editor-toolbar
        role="toolbar"
        aria-label="Formatting"
        hidden
        style="display: flex; flex-wrap: wrap; gap: var(--lv-space-1); padding: var(--lv-space-2); border-bottom: 1px solid var(--lv-color-border); background: var(--lv-color-bg);"
    >
        <button type="button" data-rich-editor-cmd="bold" aria-label="Bold" aria-pressed="false" style="min-width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer; font-weight: var(--lv-font-bold);">B</button>
        <button type="button" data-rich-editor-cmd="italic" aria-label="Italic" aria-pressed="false" style="min-width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer; font-style: italic;">I</button>
        <button type="button" data-rich-editor-cmd="strike" aria-label="Strikethrough" aria-pressed="false" style="min-width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer; text-decoration: line-through;">S</button>
        <button type="button" data-rich-editor-cmd="heading" data-rich-editor-arg="2" aria-label="Heading" aria-pressed="false" style="min-width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer;">H</button>
        <button type="button" data-rich-editor-cmd="bulletList" aria-label="Bullet list" aria-pressed="false" style="min-width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer;">&bull;</button>
        <button type="button" data-rich-editor-cmd="orderedList" aria-label="Numbered list" aria-pressed="false" style="min-width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer;">1.</button>
        <button type="button" data-rich-editor-cmd="blockquote" aria-label="Quote" aria-pressed="false" style="min-width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: var(--lv-color-surface); color: var(--lv-color-fg); cursor: pointer;">&rdquo;</button>
    </div>

    <%-- The mount point for the TipTap editor; empty + hidden until the island fills it. --%>
    <div
        data-rich-editor-surface
        aria-label="${label}"
        hidden
        style="min-height: 8rem; padding: var(--lv-space-3); color: var(--lv-color-fg); line-height: var(--lv-leading-normal);"
    ></div>

    <%-- SERVER-FIRST FALLBACK: the real, posted form control. Visible + editable with JS off. --%>
    <textarea
        id="${fieldId}"
        name="${name}"
        rows="${rows}"
        placeholder="${placeholder}"
        aria-label="${label}"
        disabled="${disabled}"
        data-rich-editor-input
        style="display: block; width: 100%; box-sizing: border-box; border: 0; padding: var(--lv-space-3); background: var(--lv-color-surface); color: var(--lv-color-fg); font-family: var(--lv-font-sans); font-size: var(--lv-text-sm); resize: vertical;"
    >${value}</textarea>
</div>
