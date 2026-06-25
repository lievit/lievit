@import dev.lievit.component.ComponentMetadata
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui code-editor partial (Filament code-field / shadcn code parity) -- a SERVER-FIRST code
  form field. The canonical control is a plain monospace <textarea name="..."> that POSTs its source
  with the surrounding <form> whether or not JS runs. The island (code-editor.ts) progressively
  enhances it into a CodeMirror 6 editor (syntax highlight + line numbers + language) whose document
  is written back into the SAME textarea on every change, so the form keeps POSTing the field with
  or without JS.

  SERVER-FIRST FALLBACK (the law): JS off renders one native, form-associated control --
  <textarea name="${name}"> with a monospace font -- editable and submittable. The CodeMirror mount
  point starts empty + hidden; only the island reveals it and hides (but keeps) the textarea, which
  remains the posted control.

  CSP: CodeMirror 6 is CSP-clean -- no eval, no `new Function`; its theming injects a <style> element
  via style-mod (a DOM API), not inline style attributes, so a strict CSP (no `unsafe-inline`,
  no `unsafe-eval`) passes. No inline <script>, no on*= handler in this template.

  Params:
    name        String   the form field name the <textarea> POSTs under (REQUIRED)
    value       String   initial source (seeds the textarea + the editor)
    language    String   language id for the island (e.g. "javascript", "sql", "json", "html")
    rows        int      textarea rows for the JS-off fallback height
    placeholder String   placeholder text
    disabled    boolean  disable the control
    label       String   accessible label for the editor
    _component  ComponentMetadata  wire metadata (className anchor); optional for static use
--%>
@param String name
@param String value = ""
@param String language = ""
@param int rows = 12
@param String placeholder = ""
@param boolean disabled = false
@param String label = "Code editor"
@param ComponentMetadata _component = null
!{var cid = _component == null ? "" : _component.className();}
!{var fieldId = "lv-code-" + name;}
<div
    @if(!cid.isEmpty())data-lievit-component="${cid}"@endif
    data-code-editor
    data-code-editor-language="${language}"
    data-code-editor-disabled="${disabled ? "true" : "false"}"
    style="display: block; font-family: var(--lv-font-mono); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); background: var(--lv-color-surface); overflow: hidden;"
>
    <%-- The CodeMirror mount point; empty + hidden until the island fills it. --%>
    <div
        data-code-editor-surface
        aria-label="${label}"
        hidden
        style="min-height: 10rem; font-family: var(--lv-font-mono); font-size: var(--lv-text-sm);"
    ></div>

    <%-- SERVER-FIRST FALLBACK: the real, posted form control. Visible + editable with JS off. --%>
    <textarea
        id="${fieldId}"
        name="${name}"
        rows="${rows}"
        placeholder="${placeholder}"
        aria-label="${label}"
        disabled="${disabled}"
        spellcheck="false"
        data-code-editor-input
        style="display: block; width: 100%; box-sizing: border-box; border: 0; padding: var(--lv-space-3); background: var(--lv-color-surface); color: var(--lv-color-fg); font-family: var(--lv-font-mono); font-size: var(--lv-text-sm); tab-size: 2; resize: vertical; line-height: var(--lv-leading-normal); white-space: pre; overflow-wrap: normal; overflow-x: auto;"
    >${value}</textarea>
</div>
