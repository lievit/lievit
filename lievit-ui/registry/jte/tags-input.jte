@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui tags-input partial -- a free-text TAGS field: existing tags shown as removable chips +
  a text input to add more, with optional suggestions (Filament TagsInput; shadcn composes Badge +
  Input). The committed tags POST as a REPEATED `name` via one hidden input per chip, so the set
  submits with zero JS (the platform does the work). JS-OFF an explicit Add submit button
  (name=name__add) and a per-chip remove submit (name=name__remove) round-trip to the server.
  JS-ON a CSP-clean typed-TS enhancer makes the editing in-place: Enter / delimiter key / Add
  appends a chip + hidden input without a round-trip, chip x deletes it, Backspace-on-empty pops
  the last, paste splits on the delimiter, and chip keyboard navigation (ArrowLeft/Right, Home/End)
  uses roving tabindex; an aria-live region announces changes. Hidden inputs stay the form source
  of truth either way.

  TIER: CLIENT-ENHANCER (form-native, NOT WIRE). Every tag value is a hidden input whose name
  matches the field name; the set POSTs as a repeated name. No wire round-trips for add/remove
  (the enhancer owns that locally). The server re-renders the whole template on full submit.

  STRUCTURE (scientific decision rule): JS-only token fields reimplement chips + value plumbing in
  script and break no-JS submit. Hidden inputs per tag give the repeated-name POST for free from
  the platform, so they are the base layer; chip editing is an enhancement on top, never the value
  itself. Same pattern as checkbox-list / file-upload.

  A11y (WAI-ARIA BUILT model -- no APG pattern for token entry; built from three APG sources):
    (1) APG Keyboard Interface practices for roving-tabindex focus management after deletion.
    (2) APG Combobox for the optional suggestion group (no popup in form-native; just a group
        of buttons).
    (3) Raw WAI-ARIA group + option semantics.
  root: role="group" aria-labelledby -> label element id; aria-disabled when disabled;
    aria-invalid when invalid.
  chips: role="option" aria-selected="true" tabindex="-1" (roving: enhancer sets one to 0 at
    a time). aria-label includes "press Delete or Backspace to remove" instruction. Remove button
    is a real button type="submit" (JS-off) / type="button" (JS-on), tabindex="-1".
  entry input: plain input type="text" (no combobox role; no popup in form-native).
    aria-labelledby -> label id (if label present); aria-label fallback; aria-describedby.
  suggestions: role="group" aria-label="Suggestions" container; each suggestion is a real button.
  live region: role="status" aria-live="polite" aria-atomic="true". Announces add/remove/dedup.
  clear-all: real button aria-label="Clear all tags" (present only when clearable and hasTags).

  Escaping channels (the XSS decision rule):
    tag values in attr-value position (data-tags-input-chip, data-tags-input-remove, value):
      -> JTE default ${} escaping covers attr-value position safely.
    delimiter in data-delimiter attribute:
      -> built via StringOutput + Escape.htmlAttribute, emitted $unsafe (full fragment).
    dynamic data-* from dataAttrs map:
      -> built via StringOutput + Escape.htmlAttribute, emitted $unsafe.
    attrs:
      -> $unsafe, STATIC author-typed strings only. NEVER interpolate per-row DB values.

  Params:
    String name                                      required: field name for POST.
    String id             = null                     entry input id (defaults to name).
    java.util.List of String values = null           existing tags (rendered as chips).
    java.util.List of String suggestions = null      optional quick-pick suggestions.
    String label          = null                     visible label text (for element).
    String ariaLabel      = null                     aria-label when no visible label.
    String describedBy    = null                     id of external hint/error element.
    String placeholder    = "Add a tag..."           add-input placeholder.
    String addLabel       = "Add"                    JS-off Add submit text.
    String delimiter      = ","                      paste-split delimiter (and keydown trigger).
    String size           = "md"                     "sm" or "md" or "lg" toolbar-aligned.
    boolean disabled      = false                    disables the control.
    boolean invalid       = false                    danger ring + aria-invalid.
    boolean clearable     = false                    show clear-all button when hasTags.
    String cssClass       = ""                       extra utility classes on root.
    String attrs          = ""                       TRUSTED raw attrs on root.
    Map of String to String dataAttrs = {}           SAFE dynamic data-* on root.

  Usage:
    @@template.lievit.tags-input(name = "etichette", label = "Etichette",
        values = contatto.etichette(),
        suggestions = java.util.List.of("urgente", "richiamare", "trattativa"))
    @@template.lievit.tags-input(name = "tags", size = "sm", clearable = true,
        values = entity.tags(), delimiter = ";")
--%>
@param String name
@param String id = null
@param java.util.List<String> values = null
@param java.util.List<String> suggestions = null
@param String label = null
@param String ariaLabel = null
@param String describedBy = null
@param String placeholder = "Add a tag..."
@param String addLabel = "Add"
@param String delimiter = ","
@param String size = "md"
@param boolean disabled = false
@param boolean invalid = false
@param boolean clearable = false
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

!{var inputId = (id != null && !id.isBlank()) ? id : name;}
!{var labelId = label != null && !label.isBlank() ? inputId + "__label" : null;}
!{var tagList = values != null ? values : java.util.List.<String>of();}
!{var hasTags = !tagList.isEmpty();}
!{var hasSuggestions = suggestions != null && !suggestions.isEmpty();}
!{var showClearAll = clearable && hasTags && !disabled;}

!{var wellMinH = switch(size) {
    case "sm" -> "var(--lv-space-8)";
    case "lg" -> "var(--lv-space-10)";
    default   -> "var(--lv-space-9)";
  };}
!{var chipH = switch(size) {
    case "sm" -> "var(--lv-space-6)";
    case "lg" -> "var(--lv-space-8)";
    default   -> "var(--lv-space-7)";
  };}
!{var textSz = switch(size) {
    case "sm" -> "var(--lv-text-xs)";
    case "lg" -> "var(--lv-text-base)";
    default   -> "var(--lv-text-sm)";
  };}

<%-- Escape the delimiter for data-delimiter attribute. --%>
!{var _delimOut_ = new StringOutput();}
!{_delimOut_.writeContent(" data-delimiter=\"");}
!{Escape.htmlAttribute(delimiter, _delimOut_);}
!{_delimOut_.writeContent("\"");}

<%-- SAFE dynamic data-* attributes. --%>
!{var _dataAttrs_ = new StringOutput();}
!{for (var _e_ : dataAttrs.entrySet()) {
    if (_e_.getKey() != null && _e_.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      _dataAttrs_.writeContent(" data-" + _e_.getKey() + "=\"");
      Escape.htmlAttribute(_e_.getValue() == null ? "" : _e_.getValue(), _dataAttrs_);
      _dataAttrs_.writeContent("\"");
    }
  }}

<div
  data-slot="tags-input"
  data-lievit-tags-input
  data-name="${name}"
  data-size="${size}"
  data-disabled="${disabled ? "true" : null}"
  data-invalid="${invalid ? "true" : null}"
  role="group"
  aria-labelledby="${labelId}"
  aria-disabled="${disabled ? "true" : null}"
  aria-invalid="${invalid ? "true" : null}"
  class="flex flex-col gap-[var(--lv-space-2)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{_delimOut_.toString()}
  $unsafe{_dataAttrs_.toString()}
  $unsafe{attrs}
>
  @if(label != null && !label.isBlank())
    <label
      id="${labelId}"
      for="${inputId}"
      data-slot="tags-input-label"
      class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]"
    >${label}</label>
  @endif

  <%-- Well: visual input container holding chips + entry input + clear-all --%>
  <div
    data-slot="tags-input-well"
    data-invalid="${invalid ? "true" : null}"
    data-disabled="${disabled ? "true" : null}"
    class="flex min-h-[${wellMinH}] flex-wrap items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] p-[var(--lv-space-1)] shadow-[var(--lv-shadow-xs)] transition-[color,box-shadow] focus-within:shadow-[var(--lv-ring)] data-[invalid=true]:border-[var(--lv-color-destructive)] data-[invalid=true]:focus-within:shadow-[var(--lv-ring-destructive)] data-[disabled=true]:opacity-50"
  >
    <%-- Chips host: each chip carries a hidden input (the form POST channel) --%>
    <div data-slot="tags-input-chips" data-tags-input-chips class="contents">
      @for(String tag : tagList)
        <span
          data-slot="tags-input-chip"
          data-tags-input-chip="${tag}"
          role="option"
          aria-selected="true"
          tabindex="-1"
          aria-label="${tag}, press Delete or Backspace to remove"
          class="inline-flex h-[${chipH}] items-center gap-[var(--lv-space-1)] rounded-full border border-transparent bg-[var(--lv-color-secondary)] px-[var(--lv-space-2)] text-[length:${textSz}] font-[var(--lv-font-medium)] leading-none text-[var(--lv-color-secondary-fg)] outline-none transition-colors focus-visible:shadow-[var(--lv-ring)] cursor-default select-none"
        >
          <input type="hidden" data-slot="tags-input-value" data-tags-input-value name="${name}" value="${tag}">
          <span data-slot="tags-input-chip-label" aria-hidden="true">${tag}</span>
          <button
            type="submit"
            data-slot="tags-input-remove"
            data-tags-input-remove="${tag}"
            name="${name}__remove"
            value="${tag}"
            aria-label="Remove ${tag}"
            disabled="${disabled}"
            tabindex="-1"
            class="-mr-[2px] inline-flex shrink-0 items-center rounded-full p-[2px] opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed"
            style="color:inherit;"
          ><svg aria-hidden="true" focusable="false" width="0.75rem" height="0.75rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
        </span>
      @endfor
    </div>

    <%-- Entry input: plain text (no combobox role; no popup in form-native tier) --%>
    <input
      data-slot="tags-input-field"
      data-tags-input-field
      type="text"
      id="${inputId}"
      placeholder="${hasTags ? null : placeholder}"
      autocomplete="off"
      disabled="${disabled}"
      aria-label="${label == null && ariaLabel != null ? ariaLabel : null}"
      aria-labelledby="${labelId}"
      aria-describedby="${describedBy}"
      aria-invalid="${invalid ? "true" : null}"
      class="h-[${chipH}] min-w-[6rem] flex-1 border-0 bg-transparent px-[var(--lv-space-1)] text-[length:${textSz}] text-[var(--lv-color-fg)] outline-none placeholder:text-[var(--lv-color-muted-fg)] disabled:cursor-not-allowed"
      style="font-family:var(--lv-font-sans);"
    >

    @if(showClearAll)
      <button
        type="button"
        data-slot="tags-input-clear-all"
        data-tags-input-clear-all
        aria-label="Clear all tags"
        class="ml-auto inline-flex shrink-0 items-center justify-center rounded-[var(--lv-radius-sm)] p-[var(--lv-space-1)] text-[var(--lv-color-muted-fg)] transition-colors hover:text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
      ><svg aria-hidden="true" focusable="false" width="1rem" height="1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/></svg></button>
    @endif

    <%-- JS-OFF: explicit Add submit round-trips to the server (enhancer hides JS-on). --%>
    <button
      type="submit"
      data-slot="tags-input-add"
      data-tags-input-add
      name="${name}__add"
      value="1"
      disabled="${disabled}"
      class="inline-flex h-[${chipH}] shrink-0 items-center rounded-[var(--lv-radius-sm)] px-[var(--lv-space-2)] text-[length:${textSz}] font-[var(--lv-font-medium)] text-[var(--lv-color-primary)] outline-none transition-colors hover:bg-[var(--lv-color-muted-bg)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50"
    >${addLabel}</button>
  </div>

  @if(hasSuggestions)
    <div
      data-slot="tags-input-suggestions"
      data-tags-input-suggestions
      role="group"
      aria-label="Suggestions"
      class="flex flex-wrap gap-[var(--lv-space-1)]"
    >
      @for(String suggestion : suggestions)
        <button
          type="button"
          data-slot="tags-input-suggestion"
          data-tags-input-suggestion="${suggestion}"
          disabled="${disabled}"
          class="inline-flex items-center rounded-full border border-dashed border-[var(--lv-color-border)] bg-transparent px-[var(--lv-space-2)] py-[2px] text-[length:${textSz}] text-[var(--lv-color-muted-fg)] outline-none transition-colors hover:border-[var(--lv-color-primary)] hover:text-[var(--lv-color-fg)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50"
          style="font-family:var(--lv-font-sans);"
        >${suggestion}</button>
      @endfor
    </div>
  @endif

  <%-- Live region: announces add/remove/dedup to screen readers. --%>
  <span
    role="status"
    aria-live="polite"
    aria-atomic="true"
    data-slot="tags-input-live"
    data-tags-input-live
    class="sr-only"
  ></span>
</div>
