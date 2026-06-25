@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui slider partial -- APG Slider on a platform native input[type=range].
  Single-thumb default; dual-thumb range mode (rangeMode=true); horizontal or vertical.
  Marks, value tooltip, disabled, aria-invalid. The lv-slider Stimulus controller handles the
  cases the native element does not cover: range clamp, --slider-pct sync, tooltip text update.

  TIER: PARTIAL + CONTROLLER (data-controller="lv-slider",
  runtime/stimulus/controllers/lv-slider-controller.ts). The native range input carries
  role=slider, aria-valuemin/max/now, and the full APG keyboard map (Arrow/Home/End/PageUp-Down)
  for free; no JS keyboard handler is needed. The controller's job is purely the irreducible
  client bits, all declared as data-action on the native inputs (CSP-clean, morph-safe): real-time
  --slider-pct updates on drag/key, range-mode clamp + ARIA constraint sync, tooltip visibility
  toggling. UNCONTROLLED: a slider never round-trips the wire on a drag tick.

  STRUCTURE (scientific decision rule): APG Slider (https://www.w3.org/WAI/ARIA/apg/
  patterns/slider/) for single-thumb; APG Slider (Multi-Thumb) (https://www.w3.org/WAI/
  ARIA/apg/patterns/slider-multithumb/) for range mode. Both URLs verified 2026-06-24.
  The native input[type=range] is the ACCESSIBLE SPINE -- do not replace it with a
  div[role=slider]. The styled overlay (track rail + fill + thumb overlay + tooltip +
  marks) is aria-hidden="true" throughout. The initial fill percentage (--slider-pct)
  is computed server-side and set as an inline CSS custom property on the root; the
  lv-slider controller keeps it in sync on every interaction without a round-trip.
  Inventory reference: Ant Design Slider (range mode, marks, tooltip, vertical,
  disabled) -- no code copied, original generation.

  A11y (WAI-ARIA APG Slider + APG Slider Multi-Thumb):
    Roles: role="slider" is implicit on every native input[type=range].
    ARIA -- single-thumb:
      aria-valuemin/aria-valuemax/aria-valuenow: native (from min/max/value attributes).
      aria-label: set from ariaLabel param when no visible label exists.
      aria-valuetext: set from ariaValuetext param for human-readable override.
      aria-orientation="vertical": emitted when orientation="vertical" (horizontal is default).
    ARIA -- range mode (two thumbs, APG multithumb rule):
      lower thumb: aria-valuemin="${min}" aria-valuemax="${valueHigh}" (upper value is its cap).
      upper thumb: aria-valuemin="${valueLow}" aria-valuemax="${max}" (lower value is its floor).
      Each thumb carries aria-label from ariaLabelLow/ariaLabelHigh.
      aria-valuetext per thumb from ariaValuetextLow/ariaValuetextHigh.
    Keyboard: Arrow/Home/End/PageUp-Down supplied by the platform for all thumbs.
      Enhancer only adds: range clamp on input event + aria-valuemin/max attribute sync.
    Focus: platform Tab focus on each native input. No trap. No roving tabindex.
      Tab order low-thumb -> high-thumb is constant; controller never re-sorts DOM.
    Styled overlay: aria-hidden="true" on every visual-only element (thumb div, track
      fill, tooltip, mark row). The overlay carries no role and no interactive ARIA.
    Disabled: native `disabled` on input[type=range]; overlay gets pointer-events-none.
    aria-invalid: the field partial sets it on a parent; CSS [aria-invalid] selectors
      on the track fill + thumb overlay recolour to --lv-color-destructive. The slider
      partial itself does NOT emit aria-invalid (it is inherited from the field wrapper).

  Params:
    String name                      form field name (plain form POST, not l:model).
    double value             = 0     current value (single-thumb).
    double min               = 0     minimum (aria-valuemin).
    double max               = 100   maximum (aria-valuemax).
    double step              = 1     keyboard/snap increment; 0 = continuous.
    boolean rangeMode        = false dual-thumb range selection.
    double valueLow          = 0     range-mode: lower thumb value.
    double valueHigh         = 100   range-mode: upper thumb value.
    String orientation       = "horizontal"  "horizontal" | "vertical".
    boolean disabled         = false dims + blocks activation; native disabled.
    java.util.List<java.util.Map<String,String>> marks = null  tick marks: each map
      has "value" (numeric string) and "label" (may be blank for unlabelled tick).
    String showTooltip       = "hover"  "always" | "hover" | "never".
    String tooltipFormatter  = null  server-formatted label for current value; null = raw.
    String tooltipFormatterLow  = null  range-mode: label for valueLow.
    String tooltipFormatterHigh = null  range-mode: label for valueHigh.
    String ariaLabel         = null  aria-label for single thumb.
    String ariaLabelLow      = null  range-mode: aria-label for lower thumb.
    String ariaLabelHigh     = null  range-mode: aria-label for upper thumb.
    String ariaValuetext     = null  aria-valuetext for single thumb.
    String ariaValuetextLow  = null  range-mode: aria-valuetext for lower thumb.
    String ariaValuetextHigh = null  range-mode: aria-valuetext for upper thumb.
    String size              = "md"  "sm" | "md" | "lg".
    String cssClass          = ""    extra utility classes on the root wrapper.
    String attrs             = ""    TRUSTED raw ($unsafe) STATIC strings only
      (wire directives, data-testid static). NEVER feed per-row DB-derived values here.
    java.util.Map<String,String> dataAttrs = {}  SAFE escaped dynamic data-* on root
      (each value through Escape.htmlAttribute).

  Usage:
    @@template.lievit.slider(name = "prezzo", min = 0, max = 1000, step = 50, value = 250,
        ariaLabel = "Prezzo")
    @@template.lievit.slider(name = "fascia", rangeMode = true, min = 0, max = 1000,
        valueLow = 200, valueHigh = 800, ariaLabelLow = "Minimo", ariaLabelHigh = "Massimo")
    @@template.lievit.slider(name = "volume", orientation = "vertical", value = 60,
        ariaLabel = "Volume", showTooltip = "always")
--%>
@param String name = null
@param double value = 0
@param double min = 0
@param double max = 100
@param double step = 1
@param boolean rangeMode = false
@param double valueLow = 0
@param double valueHigh = 100
@param String orientation = "horizontal"
@param boolean disabled = false
@param java.util.List<java.util.Map<String, String>> marks = null
@param String showTooltip = "hover"
@param String tooltipFormatter = null
@param String tooltipFormatterLow = null
@param String tooltipFormatterHigh = null
@param String ariaLabel = null
@param String ariaLabelLow = null
@param String ariaLabelHigh = null
@param String ariaValuetext = null
@param String ariaValuetextLow = null
@param String ariaValuetextHigh = null
@param String size = "md"
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

<%-- Derived booleans + orientation flag. --%>
!{var isVertical = "vertical".equals(orientation);}
!{var hasTicks = marks != null && !marks.isEmpty();}

<%-- Fill percentage for the server-rendered initial state.
     Single-thumb: ((value - min) / (max - min)) * 100.
     Range mode: fill from valueLow to valueHigh.
     Guard against division by zero when min == max. --%>
!{var range_ = (max - min) != 0 ? (max - min) : 1.0;}
!{var pct = (int) Math.round(((value - min) / range_) * 100);}
!{var pctLow = (int) Math.round(((valueLow - min) / range_) * 100);}
!{var pctHigh = (int) Math.round(((valueHigh - min) / range_) * 100);}

<%-- Tooltip visibility class: always=opacity-100, hover=opacity-0 (controller shows on hover),
     never=opacity-0 sr-only (hidden from layout; still in DOM for a11y backup). --%>
!{var tooltipVisClass = "always".equals(showTooltip) ? "opacity-100" : "opacity-0";}
!{var tooltipSrClass = "never".equals(showTooltip) ? " pointer-events-none select-none" : "";}

<%-- Tooltip label displayed at server render time. --%>
!{var tooltipLabel = tooltipFormatter != null ? tooltipFormatter : String.valueOf((int) value);}
!{var tooltipLabelLow = tooltipFormatterLow != null ? tooltipFormatterLow : String.valueOf((int) valueLow);}
!{var tooltipLabelHigh = tooltipFormatterHigh != null ? tooltipFormatterHigh : String.valueOf((int) valueHigh);}

<%-- Size-specific token classes for thumb diameter and track thickness.
     All class strings are COMPLETE + static so the Tailwind scanner picks them up. --%>
!{var thumbSize = switch (size) {
    case "sm" -> "var(--lv-space-3-5)";
    case "lg" -> "var(--lv-space-5-5)";
    default   -> "var(--lv-space-4-5)";
  };}
!{var trackThickness = switch (size) {
    case "sm" -> "var(--lv-space-1)";
    case "lg" -> "var(--lv-space-2)";
    default   -> "var(--lv-space-1-5)";
  };}

<%-- Root layout: horizontal = flex-row, vertical = flex-col. --%>
!{var rootLayout = isVertical
    ? "flex flex-col items-center"
    : "flex flex-row items-center";}

<%-- SAFE dynamic data-* fragment: build once, emit with $unsafe.
     JTE forbids @for in attribute-NAME position; this sidesteps it correctly. --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<%-- Root wrapper: data-slot, data-size, data-orientation, data-range, --slider-pct.
     data-controller="lv-slider" connects the Stimulus controller; data-tooltip carries the
     hover/always/never policy the controller reads before toggling tooltip visibility.
     --slider-pct drives the fill width/height and the thumb translate via CSS.
     data-tooltip-formatter / data-tooltip-formatter-low / data-tooltip-formatter-high
     carry the formatter template (raw strings -- author-controlled, never DB-derived
     without explicit sanitization by the calling template). --%>
<div
  data-slot="slider"
  data-size="${size}"
  data-orientation="${orientation}"
  data-range="${rangeMode ? "true" : "false"}"
  data-controller="lv-slider"
  data-tooltip="${showTooltip}"
  data-tooltip-formatter="${tooltipFormatter}"
  data-tooltip-formatter-low="${tooltipFormatterLow}"
  data-tooltip-formatter-high="${tooltipFormatterHigh}"
  style="--slider-pct:${rangeMode ? pctLow : pct}%;--slider-pct-high:${pctHigh}%;--slider-thumb-size:${thumbSize};--slider-track-thickness:${trackThickness};"
  class="lv-slider relative inline-flex ${rootLayout} gap-[var(--lv-space-3)] ${cssClass}"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>
  <%-- TRACK LAYER (aria-hidden; purely visual rail + fill) --%>
  <div
    data-slot="slider-track"
    aria-hidden="true"
    class="pointer-events-none relative flex-1 rounded-[var(--lv-radius-full)] bg-[var(--lv-color-border)]"
    style="${isVertical ? "width:var(--slider-track-thickness);height:100%;" : "height:var(--slider-track-thickness);width:100%;"}"
  >
    <%-- Track fill: coloured region between min and thumb (single) or between the two thumbs
         (range). Width/height driven by CSS --slider-pct; updated by the controller on drag. --%>
    <div
      data-slot="slider-fill"
      aria-hidden="true"
      class="absolute rounded-[var(--lv-radius-full)] bg-[var(--lv-color-primary)]"
      style="${rangeMode
          ? (isVertical
              ? "bottom:calc(var(--slider-pct) * 1%);top:calc((100% - var(--slider-pct-high) * 1%));left:0;right:0;"
              : "left:calc(var(--slider-pct) * 1%);right:calc((100% - var(--slider-pct-high) * 1%));top:0;bottom:0;")
          : (isVertical
              ? "bottom:0;top:calc((100% - var(--slider-pct) * 1%));left:0;right:0;"
              : "left:0;width:calc(var(--slider-pct) * 1%);top:0;bottom:0;")}"
    ></div>
  </div>

  <%-- NATIVE INPUT LAYER: the real accessible spine.
       Single-thumb: one input. Range mode: two inputs (low then high, constant DOM order
       per APG multithumb rule -- the tab order must not change when thumbs cross). --%>
  @if(rangeMode)
    <%-- LOW THUMB --%>
    <input
      data-slot="slider-input-low"
      data-lv-slider-target="inputLow"
      data-lv-slider-thumb-param="low"
      data-action="input->lv-slider#onInputLow mouseover->lv-slider#showTip mouseout->lv-slider#hideTip focusin->lv-slider#showTip focusout->lv-slider#hideTip"
      type="range"
      name="${name != null ? name + "Low" : null}"
      value="${valueLow}"
      min="${min}"
      max="${valueHigh}"
      step="${step}"
      disabled="${disabled}"
      aria-label="${ariaLabelLow}"
      aria-valuetext="${ariaValuetextLow}"
      aria-orientation="${isVertical ? "vertical" : null}"
      class="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
      style="z-index:1;"
    >
    <%-- HIGH THUMB --%>
    <input
      data-slot="slider-input-high"
      data-lv-slider-target="inputHigh"
      data-lv-slider-thumb-param="high"
      data-action="input->lv-slider#onInputHigh mouseover->lv-slider#showTip mouseout->lv-slider#hideTip focusin->lv-slider#showTip focusout->lv-slider#hideTip"
      type="range"
      name="${name != null ? name + "High" : null}"
      value="${valueHigh}"
      min="${valueLow}"
      max="${max}"
      step="${step}"
      disabled="${disabled}"
      aria-label="${ariaLabelHigh}"
      aria-valuetext="${ariaValuetextHigh}"
      aria-orientation="${isVertical ? "vertical" : null}"
      class="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
      style="z-index:1;"
    >
  @else
    <input
      data-slot="slider-input"
      data-lv-slider-target="input"
      data-action="input->lv-slider#onInput change->lv-slider#onChange mouseover->lv-slider#showTip mouseout->lv-slider#hideTip focusin->lv-slider#showTip focusout->lv-slider#hideTip"
      type="range"
      name="${name}"
      value="${value}"
      min="${min}"
      max="${max}"
      step="${step}"
      disabled="${disabled}"
      aria-label="${ariaLabel}"
      aria-valuetext="${ariaValuetext}"
      aria-orientation="${isVertical ? "vertical" : null}"
      class="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
      style="z-index:1;"
    >
  @endif

  <%-- STYLED THUMB OVERLAY (aria-hidden; visual only; the real interaction is on the native input).
       Single thumb: position driven by --slider-pct.
       Range mode: low thumb at --slider-pct, high thumb at --slider-pct-high.
       The overlay is pointer-events-none so clicks pass through to the native input above. --%>
  @if(rangeMode)
    <%-- Low thumb overlay --%>
    <div
      data-slot="slider-thumb"
      data-thumb="low"
      aria-hidden="true"
      class="pointer-events-none absolute z-[2] flex items-center justify-center rounded-[var(--lv-radius-full)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] shadow-[var(--lv-shadow-sm)] transition-shadow hover:shadow-[var(--lv-shadow-md)]"
      style="${isVertical
          ? "width:var(--slider-thumb-size);height:var(--slider-thumb-size);bottom:calc(var(--slider-pct) * 1% - var(--slider-thumb-size) / 2);left:50%;transform:translateX(-50%);"
          : "width:var(--slider-thumb-size);height:var(--slider-thumb-size);left:calc(var(--slider-pct) * 1% - var(--slider-thumb-size) / 2);top:50%;transform:translateY(-50%);"}"
    ></div>
    <%-- High thumb overlay --%>
    <div
      data-slot="slider-thumb"
      data-thumb="high"
      aria-hidden="true"
      class="pointer-events-none absolute z-[2] flex items-center justify-center rounded-[var(--lv-radius-full)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] shadow-[var(--lv-shadow-sm)] transition-shadow hover:shadow-[var(--lv-shadow-md)]"
      style="${isVertical
          ? "width:var(--slider-thumb-size);height:var(--slider-thumb-size);bottom:calc(var(--slider-pct-high) * 1% - var(--slider-thumb-size) / 2);left:50%;transform:translateX(-50%);"
          : "width:var(--slider-thumb-size);height:var(--slider-thumb-size);left:calc(var(--slider-pct-high) * 1% - var(--slider-thumb-size) / 2);top:50%;transform:translateY(-50%);"}"
    ></div>
    <%-- Tooltips: range mode (low + high). Always in DOM; CSS visibility controlled by showTooltip.
         aria-hidden: the a11y value is on the native input via aria-valuenow/aria-valuetext. --%>
    <div
      data-slot="slider-tooltip"
      data-thumb="low"
      data-lv-slider-target="tooltipLow"
      aria-hidden="true"
      class="pointer-events-none absolute z-[3] rounded-[var(--lv-radius-full)] bg-[var(--lv-color-popover)] px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-sm)] transition-opacity duration-[var(--lv-duration-fast)] ${tooltipVisClass}${tooltipSrClass}"
      style="font-family:var(--lv-font-sans);${isVertical
          ? "right:calc(100% + var(--lv-space-2));bottom:calc(var(--slider-pct) * 1%);"
          : "bottom:calc(100% + var(--lv-space-2));left:calc(var(--slider-pct) * 1%);transform:translateX(-50%);"}"
    >${tooltipLabelLow}</div>
    <div
      data-slot="slider-tooltip"
      data-thumb="high"
      data-lv-slider-target="tooltipHigh"
      aria-hidden="true"
      class="pointer-events-none absolute z-[3] rounded-[var(--lv-radius-full)] bg-[var(--lv-color-popover)] px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-sm)] transition-opacity duration-[var(--lv-duration-fast)] ${tooltipVisClass}${tooltipSrClass}"
      style="font-family:var(--lv-font-sans);${isVertical
          ? "right:calc(100% + var(--lv-space-2));bottom:calc(var(--slider-pct-high) * 1%);"
          : "bottom:calc(100% + var(--lv-space-2));left:calc(var(--slider-pct-high) * 1%);transform:translateX(-50%);"}"
    >${tooltipLabelHigh}</div>
  @else
    <%-- Single thumb overlay --%>
    <div
      data-slot="slider-thumb"
      aria-hidden="true"
      class="pointer-events-none absolute z-[2] flex items-center justify-center rounded-[var(--lv-radius-full)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] shadow-[var(--lv-shadow-sm)] transition-shadow hover:shadow-[var(--lv-shadow-md)]"
      style="${isVertical
          ? "width:var(--slider-thumb-size);height:var(--slider-thumb-size);bottom:calc(var(--slider-pct) * 1% - var(--slider-thumb-size) / 2);left:50%;transform:translateX(-50%);"
          : "width:var(--slider-thumb-size);height:var(--slider-thumb-size);left:calc(var(--slider-pct) * 1% - var(--slider-thumb-size) / 2);top:50%;transform:translateY(-50%);"}"
    ></div>
    <%-- Single tooltip. Always in DOM regardless of showTooltip; CSS opacity controls visibility. --%>
    <div
      data-slot="slider-tooltip"
      data-lv-slider-target="tooltip"
      aria-hidden="true"
      class="pointer-events-none absolute z-[3] rounded-[var(--lv-radius-full)] bg-[var(--lv-color-popover)] px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-sm)] transition-opacity duration-[var(--lv-duration-fast)] ${tooltipVisClass}${tooltipSrClass}"
      style="font-family:var(--lv-font-sans);${isVertical
          ? "right:calc(100% + var(--lv-space-2));bottom:calc(var(--slider-pct) * 1%);"
          : "bottom:calc(100% + var(--lv-space-2));left:calc(var(--slider-pct) * 1%);transform:translateX(-50%);"}"
    >${tooltipLabel}</div>
  @endif

  <%-- MARKS ROW (aria-hidden; visual decoration only; a11y value travels via aria-valuetext). --%>
  @if(hasTicks)
    <div
      data-slot="slider-marks"
      aria-hidden="true"
      class="pointer-events-none absolute ${isVertical ? "top-0 bottom-0 left-full ml-[var(--lv-space-2)]" : "left-0 right-0 top-full mt-[var(--lv-space-2)]"}"
    >
      @for(java.util.Map<String, String> mark : marks)
        !{var markVal = mark.get("value");}
        !{var markLabel = mark.get("label");}
        !{var markPct = markVal != null ? (int) Math.round(((Double.parseDouble(markVal) - min) / range_) * 100) : 0;}
        <div
          data-slot="slider-mark"
          class="absolute flex flex-col items-center gap-[var(--lv-space-1)]"
          style="${isVertical
              ? "bottom:calc(" + markPct + "% - 3px);left:0;"
              : "left:calc(" + markPct + "% - 3px);top:0;"}"
        >
          <%-- Tick dot --%>
          <span
            aria-hidden="true"
            class="inline-block rounded-[var(--lv-radius-full)] bg-[var(--lv-color-border)]"
            style="width:6px;height:6px;flex-shrink:0;"
          ></span>
          <%-- Tick label: only when non-blank --%>
          @if(markLabel != null && !markLabel.isBlank())
            <span
              data-slot="slider-mark-label"
              aria-hidden="true"
              class="text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)] whitespace-nowrap select-none"
              style="font-family:var(--lv-font-sans);"
            >${markLabel}</span>
          @endif
        </div>
      @endfor
    </div>
  @endif
</div>
