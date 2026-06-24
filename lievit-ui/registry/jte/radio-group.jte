@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui radio-group partial -- a mutually-exclusive option group (APG Radio Group).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012 server-first pivot). PARTIAL because the
  selected value is a server fact: the controller reads it from the domain model and passes it as
  `value`; the partial renders aria-checked and tabindex from that server-provided selection.

  Options arrive via FOUR parallel lists (`optionIds`, `optionLabels`, `optionDescriptions`,
  `optionDisabled`) -- the same parallel-list pattern used by command.jte, data-table.jte,
  and other partials. The controller zips the domain List<RadioOption> into these four
  before calling the template; no domain type needs to be on the JTE compile classpath.

  The one irreducible client behaviour for the custom variants is roving-tabindex arrow-key
  navigation (APG Radio Group) -- this is the radio-group.enhancer.ts escape-hatch.
  The native variant (`nativeInputs=true`) needs no enhancer: the platform provides identical
  roving and arrow-key behaviour for real radio inputs sharing a `name`.

  STRUCTURE (scientific decision rule):
  a11y source: WAI-ARIA APG Radio Group (https://www.w3.org/WAI/ARIA/apg/patterns/radio/).
  Example verified: https://www.w3.org/WAI/ARIA/apg/patterns/radio/examples/radio/.
  react-aria `useRadioGroup` / `useRadio` consulted as interaction pattern reference (ORIGINAL
  output, no code copied -- 02-licensing.md).
  Inventory reference: Ant Design Radio (sizes, button-style group, vertical/horizontal layout,
  disabled per-option, disabled whole group).
  Styling: ORIGINAL token-driven generation; look inspired by Tailwind UI (no code copied).

  Two rendering paths:

  PATH A -- custom variant (default + button + button-vertical):
    Root: `div role="radiogroup"` carrying `aria-labelledby`, `data-lievit-enhancer="radio-group"`.
    Options: `div role="radio"` with `aria-checked`, `aria-disabled`, roving `tabindex`.
    Enhancer: radio-group.enhancer.ts mounts on `data-lievit-enhancer="radio-group"` and drives
    arrow-key navigation + aria-checked sync + lievit:radio-change dispatch.
    The custom indicator (ring + dot) is `data-slot="radio-indicator"`, button variants omit it.

  PATH B -- native variant (`nativeInputs=true`):
    Root: `fieldset` + `legend`. Each option: `input type="radio"` + `label for`. The shared `name`
    enforces single-select; the platform supplies roving arrow-key focus. No enhancer.

  A11y (WAI-ARIA APG Radio Group):
    Roles: role="radiogroup" (custom), fieldset+legend (native), role="radio" / input[type=radio].
    States: aria-checked="true|false", aria-disabled, aria-required, aria-invalid (from field).
    Keyboard (custom path, enhancer-driven): ArrowDown/Right -> next (wrap, skip disabled) + check;
    ArrowUp/Left -> prev + check; Space -> check focused if unchecked; Enter -> no-op (APG).
    Focus: roving tabindex -- exactly one option holds tabindex="0" (checked one, or first
    non-disabled if none checked). Tab exits the group normally (no trap).
    Live region: none -- screen readers announce label + aria-checked on focus movement.

  Escaping channels (the XSS decision rule, verbatim from button.jte):
    attrs       = TRUSTED raw ($unsafe) -- STATIC, author-typed strings ONLY (l:change, data-testid).
                  NEVER interpolate per-row or DB-derived values into attrs.
    dataAttrs   = SAFE escaped Map of String to String: each value through Escape.htmlAttribute.
    optionAttrs = SAFE escaped Map of String to String propagated to each option element.
    data-value  = always escaped via Escape.htmlAttribute (option id is potentially DB-derived).

  Params:
    String name                         REQUIRED. HTML `name` shared by all options.
    List<String> optionIds              REQUIRED. Submitted values, one per option.
    List<String> optionLabels           REQUIRED. Visible text, parallel to optionIds.
    List<String> optionDescriptions     Optional hint per option (null entry = no description).
                                        Parallel to optionIds; null or shorter list = no descriptions.
    List<Boolean> optionDisabled        Optional per-option disabled flags. Parallel to optionIds;
                                        null or shorter list = all enabled.
    String value = null                 Currently selected option id. null = nothing selected.
    String variant = "default"          "default" | "button" | "button-vertical"
    String size = "md"                  "sm" | "md" | "lg" -- height-based, toolbar-aligned.
    String layout = "vertical"          "vertical" | "horizontal" -- default variant only.
    boolean disabled = false            Disables the entire group.
    boolean required = false            aria-required="true" on the radiogroup.
    String labelledby = null            id of an external label element (aria-labelledby).
    String groupLabel = null            Inline group label text rendered inside the partial.
    String groupLabelId = null          id on the inline label element (auto: "rg-label-" + name).
    String describedby = null           id(s) of external hint/error elements (aria-describedby).
    boolean nativeInputs = false        Render real input[type=radio] with fieldset/legend.
    String cssClass = ""                Extra utility classes on the root element.
    String optionCssClass = ""          Extra utility classes on each option wrapper.
    String attrs = ""                   TRUSTED raw ($unsafe) -- STATIC strings only.
    Map<String,String> dataAttrs = {}   SAFE dynamic data-* (value escaped via Escape.htmlAttribute).
    Map<String,String> optionAttrs = {} SAFE per-option data-* (value escaped).

  Usage:
    @@template.lievit.radio_group(
      name = "priority",
      optionIds = priorityIds,
      optionLabels = priorityLabels,
      value = form.priority(),
      groupLabel = "Priorita",
      attrs = "l:change=\"updatePriority\""
    )
    @@template.lievit.radio_group(
      name = "role",
      optionIds = roleIds,
      optionLabels = roleLabels,
      value = form.role(),
      variant = "button",
      size = "sm",
      groupLabel = "Ruolo",
      nativeInputs = false
    )
--%>
@param String name
@param java.util.List<String> optionIds
@param java.util.List<String> optionLabels
@param java.util.List<String> optionDescriptions = null
@param java.util.List<Boolean> optionDisabled = null
@param String value = null
@param String variant = "default"
@param String size = "md"
@param String layout = "vertical"
@param boolean disabled = false
@param boolean required = false
@param String labelledby = null
@param String groupLabel = null
@param String groupLabelId = null
@param String describedby = null
@param boolean nativeInputs = false
@param String cssClass = ""
@param String optionCssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param java.util.Map<String, String> optionAttrs = java.util.Map.of()

<%-- Resolve the effective group-label id: use the provided one or auto-derive from name. --%>
!{var effectiveLabelId = (groupLabelId != null && !groupLabelId.isBlank())
    ? groupLabelId
    : "rg-label-" + name;}

<%-- Resolve aria-labelledby: inline groupLabel wins if set; fall back to external labelledby. --%>
!{var rootLabelledBy = (groupLabel != null && !groupLabel.isBlank()) ? effectiveLabelId : labelledby;}
<%-- If both are set, composite them (space-separated). --%>
!{var compositeLabelledBy = (groupLabel != null && !groupLabel.isBlank()
    && labelledby != null && !labelledby.isBlank())
    ? effectiveLabelId + " " + labelledby
    : rootLabelledBy;}

<%-- Option touch-target height class (toolbar-aligned per architecture contract S5.b):
     sm -> --lv-space-8 (32px), md -> --lv-space-9 (36px), lg -> --lv-space-10 (40px). --%>
!{var minHeightClass = switch (size) {
    case "sm" -> "min-h-[var(--lv-space-8)]";
    case "lg" -> "min-h-[var(--lv-space-10)]";
    default   -> "min-h-[var(--lv-space-9)]";
  };}

<%-- Text-size class per size step. --%>
!{var textSizeClass = switch (size) {
    case "sm" -> "text-[length:var(--lv-text-xs)]";
    case "lg" -> "text-[length:var(--lv-text-base)]";
    default   -> "text-[length:var(--lv-text-sm)]";
  };}

<%-- Button-variant pill height (flush with same-size button/input). --%>
!{var btnHeightClass = switch (size) {
    case "sm" -> "h-[var(--lv-space-8)]";
    case "lg" -> "h-[var(--lv-space-10)]";
    default   -> "h-[var(--lv-space-9)]";
  };}

<%-- Layout flex direction for the default variant. --%>
!{var layoutClass = "horizontal".equals(layout) ? "flex-row flex-wrap" : "flex-col";}

<%-- SAFE dynamic data-* fragment builder (pattern from badge.jte / switch.jte). --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<%-- Per-option data-* fragment (optionAttrs applied to every option element). --%>
!{var optionAttrs_ = new StringOutput();}
!{for (var e : optionAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      optionAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), optionAttrs_);
      optionAttrs_.writeContent("\"");
    }
  }}
!{var optionAttrsMarkup = optionAttrs_.toString();}

@if(!nativeInputs)
<%-- =========================================================================
     PATH A: custom variant (default | button | button-vertical)
     role="radiogroup" + role="radio" divs + radio-group.enhancer.ts
     ========================================================================= --%>

<%-- Find the first non-disabled option id for tabindex when nothing is checked. --%>
!{String firstEnabledId = null;}
!{for (int _fi = 0; _fi < optionIds.size(); _fi++) {
    if (firstEnabledId == null) {
      boolean _fd = disabled || (optionDisabled != null && _fi < optionDisabled.size() && Boolean.TRUE.equals(optionDisabled.get(_fi)));
      if (!_fd) { firstEnabledId = optionIds.get(_fi); }
    }
  }}
<%-- Fallback: all options disabled -> first option still gets tabindex=0 (structural reachability). --%>
!{if (firstEnabledId == null && !optionIds.isEmpty()) { firstEnabledId = optionIds.get(0); }}

<div
  role="radiogroup"
  id="rg-${name}"
  aria-labelledby="${compositeLabelledBy}"
  aria-describedby="${describedby}"
  aria-required="${required ? "true" : null}"
  aria-disabled="${disabled ? "true" : null}"
  data-slot="radio-group"
  data-variant="${variant}"
  data-size="${size}"
  data-layout="${layout}"
  data-lievit-enhancer="radio-group"
  class="${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>
  @if(groupLabel != null && !groupLabel.isBlank())
    <%-- Inline group label: referenced by aria-labelledby; aria-hidden because the radiogroup
         aria-labelledby already announces it to AT. --%>
    <span
      id="${effectiveLabelId}"
      data-slot="radio-group-label"
      aria-hidden="true"
      class="${textSizeClass} font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] mb-[var(--lv-space-2)] block"
    >${groupLabel}</span>
  @endif

  @if("button".equals(variant) || "button-vertical".equals(variant))
    <%-- BUTTON / BUTTON-VERTICAL variant: segmented button-bar, no indicator dots. --%>
    <div
      data-slot="radio-group-options"
      class="${"button-vertical".equals(variant) ? "flex flex-col" : "inline-flex flex-row"} rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] overflow-hidden"
    >
      @for(int _i = 0; _i < optionIds.size(); _i++)
        !{var _id = optionIds.get(_i);}
        !{var _label = (_i < optionLabels.size()) ? optionLabels.get(_i) : "";}
        !{boolean _checked = _id != null && _id.equals(value);}
        !{boolean _optDis = disabled || (optionDisabled != null && _i < optionDisabled.size() && Boolean.TRUE.equals(optionDisabled.get(_i)));}
        !{boolean _isTabStop = _checked || (!_checked && _id != null && _id.equals(firstEnabledId) && (value == null || optionIds.stream().noneMatch(oid -> oid != null && oid.equals(value))));}
        !{var _esc = new StringOutput();}
        !{Escape.htmlAttribute(_id == null ? "" : _id, _esc);}
        !{var _escId = _esc.toString();}
        <div
          role="radio"
          id="rg-${name}-${_escId}"
          aria-checked="${_checked ? "true" : "false"}"
          aria-disabled="${_optDis ? "true" : "false"}"
          tabindex="${_isTabStop ? "0" : "-1"}"
          data-slot="radio-option"
          data-value="${_escId}"
          class="${btnHeightClass} ${textSizeClass} flex items-center justify-center px-[var(--lv-space-3)] font-[var(--lv-font-medium)] cursor-pointer select-none transition-colors border-r border-[var(--lv-color-border)] last:border-r-0 outline-none focus-visible:shadow-[var(--lv-ring)] focus-visible:relative focus-visible:z-10 aria-checked:bg-[var(--lv-color-primary)] aria-checked:text-[var(--lv-color-primary-fg)] aria-[checked=false]:bg-[var(--lv-color-input)] aria-[checked=false]:text-[var(--lv-color-fg)] aria-[checked=false]:hover:bg-[var(--lv-color-accent)] aria-[checked=false]:hover:text-[var(--lv-color-accent-fg)] aria-disabled:cursor-not-allowed aria-disabled:opacity-[var(--lv-opacity-disabled)] ${optionCssClass}"
          $unsafe{optionAttrsMarkup}
        >${_label}</div>
      @endfor
    </div>

  @else
    <%-- DEFAULT variant: stacked or horizontal radio pills with custom indicator dot. --%>
    <div
      data-slot="radio-group-options"
      class="flex gap-[var(--lv-space-2)] ${layoutClass}"
    >
      @for(int _i = 0; _i < optionIds.size(); _i++)
        !{var _id = optionIds.get(_i);}
        !{var _label = (_i < optionLabels.size()) ? optionLabels.get(_i) : "";}
        !{var _desc = (optionDescriptions != null && _i < optionDescriptions.size()) ? optionDescriptions.get(_i) : null;}
        !{boolean _hasDesc = _desc != null && !_desc.isBlank();}
        !{boolean _checked = _id != null && _id.equals(value);}
        !{boolean _optDis = disabled || (optionDisabled != null && _i < optionDisabled.size() && Boolean.TRUE.equals(optionDisabled.get(_i)));}
        !{boolean _isTabStop = _checked || (!_checked && _id != null && _id.equals(firstEnabledId) && (value == null || optionIds.stream().noneMatch(oid -> oid != null && oid.equals(value))));}
        !{var _esc = new StringOutput();}
        !{Escape.htmlAttribute(_id == null ? "" : _id, _esc);}
        !{var _escId = _esc.toString();}
        !{var _descId = "rg-desc-" + name + "-" + _escId;}
        <div
          role="radio"
          id="rg-${name}-${_escId}"
          aria-checked="${_checked ? "true" : "false"}"
          aria-disabled="${_optDis ? "true" : "false"}"
          aria-describedby="${_hasDesc ? _descId : null}"
          tabindex="${_isTabStop ? "0" : "-1"}"
          data-slot="radio-option"
          data-value="${_escId}"
          class="${minHeightClass} flex items-start gap-[var(--lv-space-2)] cursor-pointer select-none outline-none focus-visible:shadow-[var(--lv-ring)] focus-visible:rounded-[var(--lv-radius-sm)] aria-disabled:cursor-not-allowed aria-disabled:opacity-[var(--lv-opacity-disabled)] ${optionCssClass}"
          $unsafe{optionAttrsMarkup}
        >
          <%-- Custom radio indicator: outer ring + inner dot. Aria-hidden: purely visual. --%>
          <span
            data-slot="radio-indicator"
            aria-hidden="true"
            class="mt-[2px] flex-shrink-0 flex items-center justify-center size-[1em] rounded-full border-2 transition-colors ${_checked ? "border-[var(--lv-color-primary)] bg-[var(--lv-color-primary)]" : "border-[var(--lv-color-border)] bg-[var(--lv-color-input)]"}"
          >
            <span
              data-slot="radio-indicator-dot"
              aria-hidden="true"
              class="rounded-full bg-[var(--lv-color-primary-fg)] transition-transform ${_checked ? "scale-[0.45]" : "scale-0"} size-full"
            ></span>
          </span>
          <%-- Label + optional description. --%>
          <span data-slot="radio-label-wrapper" class="flex flex-col gap-[0.125rem]">
            <span
              data-slot="radio-label"
              class="${textSizeClass} font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] leading-none"
            >${_label}</span>
            @if(_hasDesc)
              <span
                id="${_descId}"
                data-slot="radio-description"
                class="text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)] leading-tight"
              >${_desc}</span>
            @endif
          </span>
        </div>
      @endfor
    </div>
  @endif
</div>

@else
<%-- =========================================================================
     PATH B: native variant (nativeInputs=true)
     fieldset + legend + input[type=radio] + label.
     No enhancer: platform supplies roving arrow-key navigation.
     ========================================================================= --%>
<fieldset
  data-slot="radio-group"
  data-variant="native"
  data-size="${size}"
  data-layout="${layout}"
  class="m-0 min-w-0 border-0 p-0 ${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>
  @if(groupLabel != null && !groupLabel.isBlank())
    <legend
      data-slot="radio-group-label"
      class="${textSizeClass} font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] mb-[var(--lv-space-2)] p-0"
    >${groupLabel}</legend>
  @else
    <%-- Visually-hidden legend for AT when external labelledby is used instead. --%>
    <legend class="sr-only" aria-hidden="true"></legend>
  @endif

  <div
    data-slot="radio-group-options"
    class="flex gap-[var(--lv-space-2)] ${"horizontal".equals(layout) ? "flex-row flex-wrap" : "flex-col"}"
  >
    @for(int _i = 0; _i < optionIds.size(); _i++)
      !{var _id = optionIds.get(_i);}
      !{var _label = (_i < optionLabels.size()) ? optionLabels.get(_i) : "";}
      !{var _desc = (optionDescriptions != null && _i < optionDescriptions.size()) ? optionDescriptions.get(_i) : null;}
      !{boolean _hasDesc = _desc != null && !_desc.isBlank();}
      !{boolean _checked = _id != null && _id.equals(value);}
      !{boolean _optDis = disabled || (optionDisabled != null && _i < optionDisabled.size() && Boolean.TRUE.equals(optionDisabled.get(_i)));}
      !{boolean _isFirst = _i == 0;}
      !{var _esc = new StringOutput();}
      !{Escape.htmlAttribute(_id == null ? "" : _id, _esc);}
      !{var _escId = _esc.toString();}
      !{var _escName = new StringOutput();}
      !{Escape.htmlAttribute(name == null ? "" : name, _escName);}
      !{var _nativeDescId = "rg-desc-" + name + "-" + _escId;}
      !{var _inputId = "rg-" + name + "-" + _escId;}
      <div
        data-slot="radio-option"
        class="${minHeightClass} flex items-start gap-[var(--lv-space-2)] ${optionCssClass}"
        $unsafe{optionAttrsMarkup}
      >
        <input
          type="radio"
          id="${_inputId}"
          name="${name}"
          value="${_escId}"
          checked="${_checked}"
          disabled="${_optDis}"
          required="${required && _isFirst}"
          aria-describedby="${_hasDesc ? _nativeDescId : null}"
          class="mt-[3px] flex-shrink-0 size-[1em] accent-[var(--lv-color-primary)] focus-visible:shadow-[var(--lv-ring)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-[var(--lv-opacity-disabled)]"
        >
        <label
          for="${_inputId}"
          data-slot="radio-label"
          class="${textSizeClass} font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] cursor-pointer flex flex-col gap-[0.125rem]"
        >
          <span>${_label}</span>
          @if(_hasDesc)
            <span
              id="${_nativeDescId}"
              data-slot="radio-description"
              class="text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)] font-[var(--lv-font-normal)] leading-tight"
            >${_desc}</span>
          @endif
        </label>
      </div>
    @endfor
  </div>
</fieldset>
@endif
