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
    java.util.Map<String, String> optionPairs = null
                             value != label option source: a LinkedHashMap of POSTED VALUE (option id,
                             e.g. a username) -> DISPLAYED LABEL (e.g. a person's name). The hidden
                             form input + chips carry the VALUE; the listbox + trigger show the LABEL;
                             the filter matches the LABEL. Insertion order is preserved (use a
                             LinkedHashMap). Wins over `options`; `content` / `optionGroups` win over it.
    java.util.Map<String, java.util.List<String>> optionGroups = null
                             group label -> option list (renders <li role="group"> in the listbox).
    java.util.Map<String, java.util.Map<String, String>> optionGroupPairs = null
                             GROUPED value != label source: a LinkedHashMap of group label -> an ordered
                             {POSTED VALUE -> DISPLAYED LABEL} map (use LinkedHashMaps at both levels to
                             keep order). Renders the same <li role="group"> optgroups as optionGroups,
                             but each option posts the VALUE while showing the LABEL (same split as the
                             flat optionPairs, just grouped). The filter matches the LABEL and an empty
                             group is hidden. Wins over optionGroups; content wins over it.
    gg.jte.Content content = null
                             hand-authored <option>/<optgroup> markup (wins over options/optionGroups).
    String value = null      the committed value (single selection).
    java.util.List<String> values = null
                             the committed values when multiple=true (one chip + one hidden input each).
    boolean multiple = false multi-select mode: picking an option ADDS it (listbox stays open), selected
                             values render as removable chips and POST as repeated hidden inputs under name.
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
    value != label: POST the username, SHOW the person's name (use a LinkedHashMap to keep order)
    @@template.lievit.combobox(name = "assignee", label = "Assignee", value = "jdoe",
      optionPairs = new java.util.LinkedHashMap<>(java.util.Map.of("jdoe", "John Doe", "asmith", "Anna Smith")))
    grouped value != label: optgroup heading -> {posted id -> shown name}; here POST idSottotipologie, show its name
    @@template.lievit.combobox(name = "sottotipologia", label = "Tipologia", value = "12", optionGroupPairs = grouped)
--%>
@param String name = null
@param String id = null
@param java.util.List<String> options = null
@param java.util.Map<String, String> optionPairs = null
@param java.util.Map<String, java.util.List<String>> optionGroups = null
@param java.util.Map<String, java.util.Map<String, String>> optionGroupPairs = null
@param gg.jte.Content content = null
@param String value = null
@param java.util.List<String> values = null
@param boolean multiple = false
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

<%-- Resolve the displayed input text: caller-supplied inputText > matched LABEL for value > empty.
     For a value != label source (optionPairs) the trigger must show the LABEL of the committed value,
     never the raw value (the posted id). value == label sources fall back to the value unchanged.
     In multiple mode the visible input is a SEARCH box only (never carries the committed value); the
     committed set lives in chips + repeated hidden inputs, so the input starts blank. --%>
!{String _valueLabel = null;}
!{if (!multiple && value != null && !value.isBlank()) {
    if (optionPairs != null && optionPairs.containsKey(value)) {
      _valueLabel = optionPairs.get(value);
    } else if (optionGroupPairs != null) {
      for (var _gp : optionGroupPairs.values()) {
        if (_gp != null && _gp.containsKey(value)) { _valueLabel = _gp.get(value); break; }
      }
    }
    if (_valueLabel == null) { _valueLabel = value; }
  }}
!{var _inputText = multiple ? "" : (inputText != null ? inputText : (_valueLabel != null ? _valueLabel : ""));}
!{var _hasText = _inputText != null && !_inputText.isBlank();}

<%-- The committed multi-select set (empty when single-select or when no values were supplied). --%>
!{java.util.List<String> _values = values != null ? values : java.util.List.of();}

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
     data-controller="lv-combobox" mounts the Stimulus controller (the morph-safe successor to the
     colocated combobox.enhancer.ts); data-lievit-combobox is retained so a non-Stimulus adopter can
     still wire the legacy enhancer (which skips any [data-controller~="lv-combobox"] root). The
     blur-commit fires via a CSP-clean data-action on the root (focus leaving the whole combobox). --%>
<div
  data-slot="combobox"
  data-size="${size}"
  data-mode="${mode}"
  data-controller="lv-combobox"
  data-action="focusout->lv-combobox#onFocusout"
  data-lievit-combobox
  data-combobox-listbox-id="${_listboxId}"
  data-combobox-input-id="${_inputId}"
  data-combobox-empty-text="${emptyText}"
  data-combobox-mode="${mode}"
  data-combobox-multiple="${multiple}"
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
    data-lv-combobox-target="control"
    data-disabled="${disabled}"
    data-invalid="${invalid}"
    data-size="${size}"
    class="relative flex w-full items-center rounded-[var(--lv-radius-md)] border bg-[var(--lv-color-bg)] transition-[border-color,box-shadow] outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-[var(--lv-opacity-disabled)] data-[invalid=false]:border-[var(--lv-color-border)] data-[invalid=true]:border-[var(--lv-color-destructive)] focus-within:ring-[3px] data-[invalid=false]:focus-within:ring-[color-mix(in_srgb,var(--lv-color-ring)_35%,transparent)] data-[invalid=true]:focus-within:ring-[color-mix(in_srgb,var(--lv-color-destructive)_35%,transparent)] ${_heightClass}"
  >
    <%-- CHIPS (multiple mode only): one removable tag per committed value. Server-rendered from
         `values`; the controller adds/removes chips client-side as the user picks/deselects. Each
         chip's remove button carries a CSP-clean data-action so Stimulus binds it after a morph too. --%>
    @if(multiple)
      <div data-slot="combobox-chips" class="flex shrink min-w-0 flex-wrap items-center gap-[var(--lv-space-1)] pl-[var(--lv-space-2)]">
        @for(String _v : _values)
          !{var _chipAttr = new StringOutput();}
          !{Escape.htmlAttribute(_v, _chipAttr);}
          <%-- chip VALUE = the posted id (_v); chip LABEL = optionPairs label for it, or _v itself
               when value == label. data-combobox-chip-value always carries the VALUE (the id the
               controller matches against the hidden inputs + options). --%>
          !{String _chipLabel = _v;}
          !{if (optionPairs != null && optionPairs.containsKey(_v)) {
              _chipLabel = optionPairs.get(_v);
            } else if (optionGroupPairs != null) {
              for (var _gp : optionGroupPairs.values()) {
                if (_gp != null && _gp.containsKey(_v)) { _chipLabel = _gp.get(_v); break; }
              }
            }}
          <span
            data-slot="combobox-chip"
            data-combobox-chip-value="$unsafe{_chipAttr.toString()}"
            class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-sm)] bg-[var(--lv-color-accent)] px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-xs)] text-[var(--lv-color-accent-fg)]"
          >
            <span data-slot="combobox-chip-label">${_chipLabel}</span>
            <button
              type="button"
              data-slot="combobox-chip-remove"
              data-action="click->lv-combobox#onChipRemove"
              data-combobox-chip-value="$unsafe{_chipAttr.toString()}"
              aria-label="Remove ${_chipLabel}"
              class="flex shrink-0 items-center justify-center text-[var(--lv-color-accent-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] rounded-[var(--lv-radius-sm)]"
            >
              <svg aria-hidden="true" width="0.75rem" height="0.75rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </span>
        @endfor
      </div>
    @endif

    <%-- THE COMBOBOX INPUT: role="combobox" per APG; aria-expanded reflects open state (closed
         server-side; JS-on opens it). aria-controls must always reference a present element. --%>
    <input
      type="text"
      id="${_inputId}"
      data-slot="combobox-input"
      data-lv-combobox-target="input"
      data-action="input->lv-combobox#onInput focus->lv-combobox#onFocus keydown->lv-combobox#onKeydown"
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
        data-action="click->lv-combobox#clear"
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
      data-lv-combobox-target="toggle"
      data-action="click->lv-combobox#onToggleClick"
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
       The lv-combobox controller owns this popover's toggle (open/close + light-dismiss sync) via
       data-action; it is an UNCONTROLLED overlay (its open state is pure client filter state), so it
       carries NO data-lv-wire-close -- the controlled/uncontrolled doctrine (a spurious close on an
       uncontrolled overlay is the wire-410 page-expired bug). It deliberately does NOT carry
       data-lv-opener either: that is the hook the SHARED popover-anchor.enhancer.ts scans, and the
       controller fully owns the toggle here, so omitting it prevents double-handling.
       data-lievit-collection activates collection-nav.enhancer.ts in aria-activedescendant mode.
       data-lievit-collection-activedescendant-target points at the <input> (the single DOM focus
       target; collection-nav writes aria-activedescendant there). --%>
  <ul
    id="${_listboxId}"
    role="listbox"
    data-slot="combobox-listbox"
    data-lv-combobox-target="listbox"
    data-action="toggle->lv-combobox#onListboxToggle mousedown->lv-combobox#onListboxMousedown click->lv-combobox#onOptionClick"
    popover="auto"
    data-lievit-collection
    data-lievit-collection-orientation="vertical"
    data-lievit-collection-wrap="true"
    data-lievit-collection-activedescendant-target="#${_inputId}"
    aria-labelledby="${(label != null && !label.isBlank()) ? _labelId : null}"
    aria-multiselectable="${multiple ? "true" : null}"
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
      @elseif(optionPairs != null)
        <%-- value != label source: data-combobox-option carries the VALUE (the posted id), the text
             node is the LABEL (what the user sees + the filter matches). The id is derived from the
             VALUE so aria-activedescendant + the option id stay stable per option. --%>
        @for(java.util.Map.Entry<String, String> _pair : optionPairs.entrySet())
          !{var _pval = _pair.getKey();}
          !{var _plbl = _pair.getValue();}
          !{var _isSelected = multiple ? _values.contains(_pval) : (value != null && _pval.equals(value));}
          !{var _optId = _id + "-opt-" + _pval.replaceAll("[^A-Za-z0-9]", "-");}
          !{var _optAttr = new StringOutput();}
          !{Escape.htmlAttribute(_pval, _optAttr);}
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
            ${_plbl}
          </li>
        @endfor
      @elseif(optionGroupPairs != null)
        <%-- GROUPED value != label: the same optgroup chrome as optionGroups, but each option carries
             the VALUE in data-combobox-option and shows the LABEL as its text (the flat optionPairs
             split, grouped). Empty-group hiding + the label filter are owned by the controller. --%>
        !{var _gpIdx = new int[]{0};}
        @for(java.util.Map.Entry<String, java.util.Map<String, String>> _gpe : optionGroupPairs.entrySet())
          !{var _gpId = _id + "-grp-" + _gpIdx[0]++;}
          <li role="presentation" data-slot="combobox-group-wrapper">
            <div id="${_gpId}" role="none" aria-hidden="true" data-slot="combobox-group-label" class="px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted)] uppercase tracking-wide select-none">${_gpe.getKey()}</div>
            <ul role="group" aria-labelledby="${_gpId}" class="m-0 list-none p-0">
              @for(java.util.Map.Entry<String, String> _gpair : _gpe.getValue().entrySet())
                !{var _gpval = _gpair.getKey();}
                !{var _gplbl = _gpair.getValue();}
                !{var _isSelected = multiple ? _values.contains(_gpval) : (value != null && _gpval.equals(value));}
                !{var _optId = _id + "-opt-" + _gpval.replaceAll("[^A-Za-z0-9]", "-");}
                !{var _optAttr = new StringOutput();}
                !{Escape.htmlAttribute(_gpval, _optAttr);}
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
                  ${_gplbl}
                </li>
              @endfor
            </ul>
          </li>
        @endfor
      @elseif(optionGroups != null)
        !{var _grpIdx = new int[]{0};}
        @for(java.util.Map.Entry<String, java.util.List<String>> _grp : optionGroups.entrySet())
          !{var _grpId = _id + "-grp-" + _grpIdx[0]++;}
          <li role="presentation" data-slot="combobox-group-wrapper">
            <div id="${_grpId}" role="none" aria-hidden="true" data-slot="combobox-group-label" class="px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted)] uppercase tracking-wide select-none">${_grp.getKey()}</div>
            <ul role="group" aria-labelledby="${_grpId}" class="m-0 list-none p-0">
              @for(String _opt : _grp.getValue())
                !{var _isSelected = multiple ? _values.contains(_opt) : (value != null && _opt.equals(value));}
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
          !{var _isSelected = multiple ? _values.contains(_opt) : (value != null && _opt.equals(value));}
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

  <%-- HIDDEN FORM INPUT(S): carry the committed selection to a plain form POST when JS is ON.
       Single-select: ONE hidden input under `name`, carrying `value`.
       Multiple-select: a hidden-list wrapper holding ONE hidden input per committed value, all under
       the SAME `name` (the shape a server multi-bind expects: repeated form field). The controller
       adds/removes these as chips are added/removed and fires a native change/input on the wrapper so
       `l:model.live` / native form listeners react. The visible <input type="text"> never carries the
       committed value (it is the search box).
       JS-OFF / JS-ON OWNERSHIP HANDOFF (exactly one control POSTs under `name`): these hidden inputs
       are rendered `disabled` so a no-JS submit ignores them and the native <select> below (the real
       form control under `name`) is the single source. On connect() the controller ENABLES these
       hidden carrier(s) and DISABLES the native <select>, so JS-ON the hidden input drives the POST
       and the native one never double-submits. --%>
  @if(multiple)
    <div data-slot="combobox-hidden-list" data-combobox-name="${name}" hidden>
      @for(String _v : _values)
        <input
          type="hidden"
          name="${name}"
          value="${_v}"
          data-slot="combobox-hidden"
          data-combobox-hidden-value="${_v}"
          disabled
        >
      @endfor
    </div>
  @else
    <input
      type="hidden"
      name="${name}"
      value="${value}"
      data-slot="combobox-hidden"
      data-lv-combobox-target="hidden"
      required="${required}"
      disabled
    >
  @endif

  <%-- JS-OFF NATIVE SELECT: the accessible + form-bound fallback when JS has not run. It carries the
       REAL `name` (so a plain GET/POST submits the user's selection under the right field with zero
       JS), and JS-ON the controller disables it (handing `name` ownership to the hidden input above)
       so the value is never submitted twice. Visually hidden; aria-hidden + tabindex=-1 keep it out
       of the AT tree (the activated combobox surface above is the accessible control JS-ON). --%>
  <div data-slot="combobox-native-wrapper" class="sr-only" aria-hidden="true">
    <select
      data-combobox-native
      id="${_id}-native"
      name="${name}"
      multiple="${multiple}"
      disabled="${disabled}"
      required="${required}"
      tabindex="-1"
      aria-hidden="true"
    >
      @if(content != null)
        ${content}
      @elseif(optionPairs != null)
        @for(java.util.Map.Entry<String, String> _npair : optionPairs.entrySet())
          <option value="${_npair.getKey()}" selected="${multiple ? _values.contains(_npair.getKey()) : (value != null && _npair.getKey().equals(value))}">${_npair.getValue()}</option>
        @endfor
      @elseif(optionGroupPairs != null)
        @for(java.util.Map.Entry<String, java.util.Map<String, String>> _ngpe : optionGroupPairs.entrySet())
          <optgroup label="${_ngpe.getKey()}">
            @for(java.util.Map.Entry<String, String> _ngpair : _ngpe.getValue().entrySet())
              <option value="${_ngpair.getKey()}" selected="${multiple ? _values.contains(_ngpair.getKey()) : (value != null && _ngpair.getKey().equals(value))}">${_ngpair.getValue()}</option>
            @endfor
          </optgroup>
        @endfor
      @elseif(optionGroups != null)
        @for(java.util.Map.Entry<String, java.util.List<String>> _ngrp : optionGroups.entrySet())
          <optgroup label="${_ngrp.getKey()}">
            @for(String _nopt : _ngrp.getValue())
              <option value="${_nopt}" selected="${multiple ? _values.contains(_nopt) : (value != null && _nopt.equals(value))}">${_nopt}</option>
            @endfor
          </optgroup>
        @endfor
      @elseif(options != null)
        @for(String _nopt : options)
          <option value="${_nopt}" selected="${multiple ? _values.contains(_nopt) : (value != null && _nopt.equals(value))}">${_nopt}</option>
        @endfor
      @endif
    </select>
  </div>
</div>
