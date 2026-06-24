@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui combobox partial (v-next) -- a searchable select with a progressive-enhancement
  contract (ADR-0012). JS-OFF it IS a real native <select name=...>: form-bound, platform-
  accessible, zero-JS. JS-ON the colocated combobox.enhancer.ts activates a WAI-ARIA combobox
  surface (an editable text input over a collapsible listbox) over the SAME <option> set, writing
  selections back to the native <select> so the field always POSTs under `name` regardless of JS.

  TIER: PARTIAL (+ colocated enhancer). The catalog and selected value are server-rendered HTML;
  client-side filtering + keyboard navigation are the only irreducible client bits (there is nothing
  for the server to decide between keystrokes when the catalog is already on the page).

  STRUCTURE (scientific decision rule):
  - WAI-ARIA APG Combobox with listbox popup:
    https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
    Example: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/
    The editable <input type="text" role="combobox"> is the single tab-stop; DOM focus NEVER moves
    into the listbox (aria-activedescendant model, not roving-tabindex). This is the load-bearing
    APG distinction between a combobox and a menu/select.
  - KEYBOARD nav (ArrowUp/Down/Home/End/Enter/Escape) is delegated to the shared
    collection-nav.enhancer.ts via data-lievit-collection on the listbox. The combobox-enhancer
    intercepts keydown on the <input> and re-dispatches to the listbox for collection-nav to own;
    it also manages open/close, filter, write-back, and blur commits.
  - POPOVER SEAM: the listbox <ul> always remains in the DOM (aria-controls must resolve per APG)
    but is visually hidden when closed via the native popover + CSS; no hidden/display:none.
  - Inventory reference: Ant Design Select with search (groups, loading, clear, size, disabled).
  - Styling: ORIGINAL generation over --lv-* tokens; look inspired by Tailwind UI (no code copied).

  A11y (WAI-ARIA APG Combobox with listbox popup):
  - Input: role="combobox" aria-expanded aria-haspopup="listbox" aria-controls="<listboxId>"
    aria-autocomplete aria-activedescendant(empty) autocomplete="off" (suppresses browser dropdown).
  - Listbox: role="listbox" id="<listboxId>" aria-labelledby popover="auto" (always in DOM).
  - Options: role="option" data-lievit-item id="opt-<value>" aria-selected aria-disabled.
  - Groups: presentation wrapper + role="group" aria-labelledby on the inner <ul>.
  - Toggle button: tabindex="-1" aria-hidden="true" (visual affordance only, not a tab stop).
  - Clear button (clearable + text non-empty): tab-stop, aria-label="Clear", a real action.
  - Loading spinner: role="status" aria-label="Loading suggestions" aria-live="polite".
  - No-results: role="option" aria-disabled="true" (not a tab stop; read by AT as active item).
  - Focus stays on <input> throughout; active option is virtual (aria-activedescendant).

  Params:
    String name              the field name (POSTs JS-off; hidden input carries committed value JS-on).
    String id = name         the combobox id (for a <label for>); defaults to name.
    java.util.List<String> options = null
                             simple option list where value == label.
    java.util.Map<String, java.util.List<String>> optionGroups = null
                             group label -> option list (renders <li role="group"> in the listbox).
    gg.jte.Content content = null
                             hand-authored <option>/<optgroup> markup (wins over options/optionGroups).
    String value = null      the committed value (single selection).
    String inputText = null  the live text in the <input>; defaults to the label for value if found.
    String label = null      visible <label> text above the control.
    String ariaLabel = null  aria-label when no visible label exists.
    String placeholder = "Select..."
                             shown in the input when inputText is empty.
    String emptyText = "No results"
                             text rendered in the listbox when no options match the filter.
    boolean clearable = false
                             shows an x clear button when inputText is non-empty.
    boolean disabled = false disables the input and the toggle button.
    boolean required = false native required on the hidden form input.
    boolean invalid = false  destructive border + ring + aria-invalid="true".
    boolean loading = false  shows a spinner + aria-busy="true" on the listbox (async fetch state).
    String size = "md"       "sm" | "md" | "lg" -- height-based, toolbar-aligned.
    String mode = "select-only"
                             "free-type" (commit any typed text) | "select-only" (must pick from list).
    String autocomplete = "list"
                             "none" | "list" | "both" -- maps to aria-autocomplete.
    String cssClass = ""     extra utility classes on the wrapper root.
    String attrs = ""        TRUSTED raw ($unsafe) -- STATIC author-typed strings only.
    java.util.Map<String, String> dataAttrs = java.util.Map.of()
                             SAFE dynamic data-* attributes (value escaped via Escape.htmlAttribute).

  Usage:
    @@template.lievit.combobox(name = "agente", label = "Agente", placeholder = "Cerca agente...",
      options = java.util.List.of("Cecchetto", "Scarpino", "Meli"), value = contatto.agente()
    )
    @@template.lievit.combobox(name = "citta", optionGroups = java.util.Map.of(
      "Emilia", java.util.List.of("Parma", "Reggio"), "Lombardia", java.util.List.of("Milano")),
      label = "Citta", size = "sm"
    )
    @@template.lievit.combobox(name = "city", label = "City", mode = "free-type", clearable = true,
      options = java.util.List.of("Milan", "Rome", "Naples"), placeholder = "Type or choose...")
--%>
@param String name = null
@param String id = null
@param java.util.List<String> options = null
@param java.util.Map<String, java.util.List<String>> optionGroups = null
@param gg.jte.Content content = null
@param String value = null
@param String inputText = null
@param String label = null
@param String ariaLabel = null
@param String placeholder = "Select..."
@param String emptyText = "No results"
@param boolean clearable = false
@param boolean disabled = false
@param boolean required = false
@param boolean invalid = false
@param boolean loading = false
@param String size = "md"
@param String mode = "select-only"
@param String autocomplete = "list"
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

!{var _id = (id != null && !id.isBlank()) ? id : name;}
!{var _inputId = _id + "-input";}
!{var _listboxId = _id + "-listbox";}
!{var _labelId = _id + "-label";}
!{var _anchorName = "--lv-combobox-" + _id;}

<%-- Resolve the displayed input text: caller-supplied inputText > matched label for value > empty. --%>
!{var _inputText = inputText != null ? inputText : (value != null && !value.isBlank() ? value : "");}
!{var _hasText = _inputText != null && !_inputText.isBlank();}

<%-- Size: height class for the input wrapper and the toggle button. COMPLETE static strings. --%>
!{var _heightClass = switch (size) {
    case "sm" -> "h-[var(--lv-space-8)]";
    case "lg" -> "h-[var(--lv-space-10)]";
    default   -> "h-[var(--lv-space-9)]";
  };}
!{var _textClass = switch (size) {
    case "sm" -> "text-[length:var(--lv-text-xs)]";
    case "lg" -> "text-[length:var(--lv-text-base)]";
    default   -> "text-[length:var(--lv-text-sm)]";
  };}

<%-- SAFE dynamic data-* attributes fragment (pattern from button.jte + badge.jte). --%>
!{var _dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      _dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), _dataAttrs_);
      _dataAttrs_.writeContent("\"");
    }
  }}
!{var _dataAttrsMarkup = _dataAttrs_.toString();}

<%-- Root wrapper. data-slot + data-size + data-mode for test selectors and styling hooks.
     data-lievit-combobox activates the colocated combobox enhancer. --%>
<div
  data-slot="combobox"
  data-size="${size}"
  data-mode="${mode}"
  data-lievit-combobox
  data-combobox-listbox-id="${_listboxId}"
  data-combobox-input-id="${_inputId}"
  data-combobox-empty-text="${emptyText}"
  data-combobox-mode="${mode}"
  data-combobox-clearable="${clearable}"
  class="relative w-full ${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{_dataAttrsMarkup}
  $unsafe{attrs}
>
  <%-- Visible label (above the control): rendered as a real <label for> so it binds to the input.
       Points to the text input (not the hidden select) so click-to-focus works with JS-on. --%>
  @if(label != null && !label.isBlank())
    <label
      id="${_labelId}"
      for="${_inputId}"
      data-slot="combobox-label"
      class="mb-[var(--lv-space-1-5)] block ${_textClass} font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]"
    >${label}</label>
  @endif

  <%-- INPUT WRAPPER: the styled control row (input + optional clear + toggle button).
       The focus ring applies to the wrapper via focus-within so the ring is visible
       whether the text input or the clear button has focus. --%>
  <div
    data-slot="combobox-control"
    data-disabled="${disabled}"
    data-invalid="${invalid}"
    data-size="${size}"
    class="relative flex w-full items-center rounded-[var(--lv-radius-md)] border bg-[var(--lv-color-input)] transition-[border-color,box-shadow] outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-[var(--lv-opacity-disabled)] data-[invalid=false]:border-[var(--lv-color-border)] data-[invalid=true]:border-[var(--lv-color-destructive)] focus-within:ring-[3px] data-[invalid=false]:focus-within:ring-[color-mix(in_srgb,var(--lv-color-ring)_35%,transparent)] data-[invalid=true]:focus-within:ring-[color-mix(in_srgb,var(--lv-color-destructive)_35%,transparent)] ${_heightClass}"
  >
    <%-- THE COMBOBOX INPUT: role="combobox" per APG; aria-expanded reflects open state (closed
         server-side; JS-on opens it). aria-controls must always reference a present element. --%>
    <input
      type="text"
      id="${_inputId}"
      data-slot="combobox-input"
      role="combobox"
      aria-expanded="false"
      aria-haspopup="listbox"
      aria-controls="${_listboxId}"
      aria-autocomplete="${autocomplete}"
      aria-activedescendant=""
      aria-label="${ariaLabel}"
      aria-labelledby="${(label != null && !label.isBlank()) ? _labelId : null}"
      aria-invalid="${invalid ? "true" : null}"
      aria-required="${required ? "true" : null}"
      autocomplete="off"
      disabled="${disabled}"
      placeholder="${placeholder}"
      value="${_inputText}"
      style="anchor-name:${_anchorName};"
      class="min-w-0 flex-1 border-0 bg-transparent pl-[var(--lv-space-3)] pr-[var(--lv-space-1)] ${_textClass} text-[var(--lv-color-fg)] placeholder:text-[var(--lv-color-muted)] outline-none focus:outline-none focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed"
    >

    <%-- CLEAR BUTTON: absent (not hidden) when !clearable or inputText is empty.
         Absent = zero tab-stop for an inactive action. IS in the tab sequence when rendered. --%>
    @if(clearable && _hasText)
      <button
        type="button"
        data-slot="combobox-clear"
        aria-label="Clear"
        class="flex shrink-0 items-center justify-center px-[var(--lv-space-1)] text-[var(--lv-color-muted)] hover:text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] rounded-[var(--lv-radius-sm)]"
      >
        <svg aria-hidden="true" width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    @endif

    <%-- TOGGLE BUTTON: visual affordance for pointer + touch users; NOT a tab stop per APG.
         aria-hidden: the input IS the tab-stop; AT users interact via the input. --%>
    <button
      type="button"
      data-slot="combobox-toggle"
      tabindex="-1"
      aria-hidden="true"
      aria-label="Toggle suggestions"
      disabled="${disabled}"
      class="flex shrink-0 items-center justify-center pr-[var(--lv-space-3)] pl-[var(--lv-space-1)] text-[var(--lv-color-muted)] disabled:pointer-events-none"
    >
      <svg aria-hidden="true" width="1rem" height="1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
  </div>

  <%-- LISTBOX PANEL: ALWAYS in the DOM so aria-controls="${_listboxId}" always resolves (APG rule).
       Visibility toggled via CSS popover seam (native popover attribute + anchor positioning), NOT
       via hidden or display:none -- the element must stay in the a11y tree as unexpanded.
       data-lievit-collection activates collection-nav.enhancer.ts in aria-activedescendant mode.
       data-lievit-collection-activedescendant-target points at the <input> (the single DOM focus
       target; collection-nav writes aria-activedescendant there). --%>
  <ul
    id="${_listboxId}"
    role="listbox"
    data-slot="combobox-listbox"
    popover="auto"
    data-lv-opener="${_inputId}"
    data-lv-wire-close="close"
    data-lievit-collection
    data-lievit-collection-orientation="vertical"
    data-lievit-collection-wrap="true"
    data-lievit-collection-activedescendant-target="#${_inputId}"
    aria-labelledby="${(label != null && !label.isBlank()) ? _labelId : null}"
    aria-busy="${loading ? "true" : "false"}"
    class="m-0 box-border w-full list-none overflow-y-auto rounded-[var(--lv-radius-lg)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] p-[var(--lv-space-1)] text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-md)] outline-none"
    style="position-anchor:${_anchorName};position-area:bottom span-right;position-try-fallbacks:flip-block;margin-block-start:var(--lv-space-1);z-index:var(--lv-z-popover);max-height:var(--lv-combobox-listbox-max-h,260px);min-width:anchor-size(width);font-family:var(--lv-font-sans);"
  >
    <%-- LOADING SPINNER: rendered before options when a server fetch is in flight.
         role="status" aria-live="polite": AT announces "Loading suggestions" politely. --%>
    @if(loading)
      <li role="status" aria-live="polite" aria-label="Loading suggestions" data-slot="combobox-loading" class="flex items-center justify-center py-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted)]">
        <span aria-hidden="true" class="inline-block h-[1rem] w-[1rem] animate-spin rounded-full border-2 border-[var(--lv-color-border)] border-t-[var(--lv-color-primary)]"></span>
      </li>
    @endif

    <%-- OPTIONS: rendered from the same option set as the native <select>.
         Each option is a data-lievit-item so collection-nav can navigate them.
         id="opt-<escaped-value>" is required for aria-activedescendant to reference the item.
         aria-selected: server-compares option value to the committed value.
         data-slot / data-combobox-option: stable hooks for the enhancer + test selectors.
         SAFE escaping: all values go through Escape.htmlAttribute for data-combobox-option
         (they are DB-derived / caller-supplied, never trusted-raw). --%>
    @if(!loading)
      @if(content != null)
        <%-- hand-authored <option>/<optgroup> content: the enhancer reads and renders these. --%>
        ${content}
      @elseif(optionGroups != null)
        !{var _grpIdx = new int[]{0};}
        @for(java.util.Map.Entry<String, java.util.List<String>> _grp : optionGroups.entrySet())
          !{var _grpId = _id + "-grp-" + _grpIdx[0]++;}
          <li role="presentation" data-slot="combobox-group-wrapper">
            <div id="${_grpId}" role="none" aria-hidden="true" data-slot="combobox-group-label" class="px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted)] uppercase tracking-wide select-none">${_grp.getKey()}</div>
            <ul role="group" aria-labelledby="${_grpId}" class="m-0 list-none p-0">
              @for(String _opt : _grp.getValue())
                !{var _isSelected = value != null && _opt.equals(value);}
                !{var _optId = _id + "-opt-" + _opt.replaceAll("[^A-Za-z0-9]", "-");}
                !{var _optAttr = new StringOutput();}
                !{Escape.htmlAttribute(_opt, _optAttr);}
                <li
                  role="option"
                  id="${_optId}"
                  data-lievit-item
                  data-slot="combobox-option"
                  aria-selected="${_isSelected ? "true" : "false"}"
                  data-combobox-option="$unsafe{_optAttr.toString()}"
                  class="flex cursor-pointer select-none items-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-sm)] px-[var(--lv-space-2)] py-[var(--lv-space-2)] ${_textClass} text-[var(--lv-color-popover-fg)] data-[active]:bg-[var(--lv-color-accent)] data-[active]:text-[var(--lv-color-accent-fg)] aria-selected:font-[var(--lv-font-medium)]"
                >
                  @if(_isSelected)
                    <span aria-hidden="true" class="flex h-[0.875rem] w-[0.875rem] shrink-0 items-center justify-center text-[var(--lv-color-primary)]"><svg width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
                  @else
                    <span aria-hidden="true" class="h-[0.875rem] w-[0.875rem] shrink-0"></span>
                  @endif
                  ${_opt}
                </li>
              @endfor
            </ul>
          </li>
        @endfor
      @elseif(options != null)
        @for(String _opt : options)
          !{var _isSelected = value != null && _opt.equals(value);}
          !{var _optId = _id + "-opt-" + _opt.replaceAll("[^A-Za-z0-9]", "-");}
          !{var _optAttr = new StringOutput();}
          !{Escape.htmlAttribute(_opt, _optAttr);}
          <li
            role="option"
            id="${_optId}"
            data-lievit-item
            data-slot="combobox-option"
            aria-selected="${_isSelected ? "true" : "false"}"
            data-combobox-option="$unsafe{_optAttr.toString()}"
            class="flex cursor-pointer select-none items-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-sm)] px-[var(--lv-space-2)] py-[var(--lv-space-2)] ${_textClass} text-[var(--lv-color-popover-fg)] data-[active]:bg-[var(--lv-color-accent)] data-[active]:text-[var(--lv-color-accent-fg)] aria-selected:font-[var(--lv-font-medium)]"
          >
            @if(_isSelected)
              <span aria-hidden="true" class="flex h-[0.875rem] w-[0.875rem] shrink-0 items-center justify-center text-[var(--lv-color-primary)]"><svg width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
            @else
              <span aria-hidden="true" class="h-[0.875rem] w-[0.875rem] shrink-0"></span>
            @endif
            ${_opt}
          </li>
        @endfor
      @else
        <%-- No options source: render the empty state immediately. --%>
        <li role="option" aria-disabled="true" data-slot="combobox-empty" class="cursor-default select-none py-[var(--lv-space-3)] px-[var(--lv-space-2)] text-center ${_textClass} text-[var(--lv-color-muted)]">${emptyText}</li>
      @endif
    @endif
  </ul>

  <%-- HIDDEN FORM INPUT: always rendered; carries the committed `value` to form POSTs.
       The visible <input type="text"> carries inputText only; this hidden input carries the
       final committed selection so the form sees the right value on submit. --%>
  <input
    type="hidden"
    name="${name}"
    value="${value}"
    data-slot="combobox-hidden"
    required="${required}"
  >

  <%-- JS-OFF NATIVE SELECT: the accessible fallback when JS has not run. The enhancer hides this
       visually (it stays in the DOM as the form-bound source for write-back) and activates the
       combobox surface above. Kept aria-hidden until the enhancer activates; the enhancer sets
       aria-hidden="true" and tabIndex=-1 on it to remove it from the AT tree. --%>
  <div data-slot="combobox-native-wrapper" class="sr-only" aria-hidden="true">
    <select
      data-combobox-native
      id="${_id}-native"
      name="${name}-native"
      disabled="${disabled}"
      required="${required}"
      tabindex="-1"
      aria-hidden="true"
    >
      @if(content != null)
        ${content}
      @elseif(optionGroups != null)
        @for(java.util.Map.Entry<String, java.util.List<String>> _ngrp : optionGroups.entrySet())
          <optgroup label="${_ngrp.getKey()}">
            @for(String _nopt : _ngrp.getValue())
              <option value="${_nopt}" selected="${value != null && _nopt.equals(value)}">${_nopt}</option>
            @endfor
          </optgroup>
        @endfor
      @elseif(options != null)
        @for(String _nopt : options)
          <option value="${_nopt}" selected="${value != null && _nopt.equals(value)}">${_nopt}</option>
        @endfor
      @endif
    </select>
  </div>
</div>
