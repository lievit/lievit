@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui progress partial -- determinate / indeterminate progress in four visual forms.

  TIER: PARTIAL presentational -> JTE partial (ADR-0012 server-first pivot). Progress holds
  no client state: the fill width, SVG arc offset, and ARIA attributes are pure functions of
  the typed value + max, so the server renders them and the browser paints. The former island
  computed the same math client-side and streamed it back; that round-trip is not needed here.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA APG Progressbar (WAI-ARIA 1.2 sec 5.3.22 + MDN ARIA progressbar_role):
      role="progressbar", aria-valuemin="0", aria-valuemax, aria-valuenow (OMITTED for
      indeterminate per spec), aria-valuetext. All inner children are presentational.
      The native <progress> element is preferred where custom styling is not required; for
      cross-browser token-driven theming a div+role pattern is standard (shadcn / Ant Design
      Progress reference). The native element's fill pseudo-elements vary by engine and cannot
      be reliably themed with --lv-* custom properties.
    - Inventory reference: Ant Design Progress (line / circle / dashboard / steps variants;
      striped + animated stripes; status intents; step segments). Feature-complete mapping to
      the lievit API surface.
    - Styling: ORIGINAL generation over --lv-* (OKLCH) tokens; visual look inspired by
      Tailwind UI (NO code copied).

  A11y (WAI-ARIA 1.2 progressbar role):
    - role="progressbar" on the root <div> -- always present.
    - aria-valuemin="0" -- always emitted (explicit for portability).
    - aria-valuemax="${max}" -- always emitted.
    - aria-valuenow -- emitted only when value != null (determinate); OMITTED for indeterminate:
      WAI-ARIA 1.2 specifies that the ABSENCE of aria-valuenow signals indeterminate to AT.
    - aria-valuetext="${valueText}" -- emitted only when valueText is non-null; overrides the
      AT percentage announcement (e.g. "15 of 30 files").
    - aria-labelledby -- takes precedence when non-null; aria-label used otherwise.
    - All inner children (SVG, segments, stripe overlay, showValue text) are aria-hidden="true":
      WAI-ARIA 1.2 states that all children of progressbar are treated as presentational.
    - The component is NOT focusable (no tabindex); no keyboard interaction; no focus trap.
    - NOT a live region: screen readers do not re-announce a progressbar on every valuenow
      change. For AT completion announcement, the consuming template owns a nearby role="status".
    - Accessible name MUST be provided (aria-label or aria-labelledby). When both are null the
      template emits a JTE comment so authors are not surprised; the component still renders.
    - No aria-busy on the progress bar itself: aria-busy belongs on the region being loaded.

  LIVE-REGION NOTE: progressbar is NOT in the WAI-ARIA live-region set (alert, log, marquee,
  status, timer). Periodic valuenow updates are NOT automatically announced. This is by design:
  continuous announcements would be disruptive for a file-upload counter. When the consumer
  needs AT to announce completion, the correct pattern is: set aria-busy="true" on the region
  being loaded (not on the progressbar), add aria-describedby on the region referencing the
  progressbar id, then set aria-busy="false" on completion and update a nearby role="status".

  STRIPED ANIMATION: requires `striped=true`; animated=true without striped=true is a no-op
  (a JTE comment nags). The animation CSS class references @keyframes lv-progress-stripe-move
  defined in lievit-tokens.css (CSP-clean, no inline style).

  Params:
    Integer value              = null      0..max determinate; null = indeterminate.
    int max                    = 100       aria-valuemax; minimum is always 0.
    String valueText           = null      aria-valuetext; overrides AT percentage announcement.
    String label               = null      aria-label (when labelledBy is null and label is set).
    String labelledBy          = null      aria-labelledby; takes precedence over label.
    String variant             = "default" INTENT: default | info | success | warning | destructive.
    String size                = "md"      sm | md | lg -- track height / stroke width.
    String form                = "line"    line | circle | dashboard | steps.
    boolean striped            = false     diagonal stripe pattern over the fill (line only).
    boolean animated           = false     animates the stripes; requires striped=true.
    boolean showValue          = false     renders a visible percentage label.
    int steps                  = 0         number of discrete segments (steps form only).
    int strokeWidth            = 0         SVG stroke override in px; 0 = size-driven default.
    String cssClass            = ""        extra utility classes on the root element.
    String attrs               = ""        TRUSTED raw ($unsafe) -- STATIC author-typed strings only.
    Map<String,String> dataAttrs = {}      SAFE escaped dynamic data-* (key w/o "data-"; each value
                                           via Escape.htmlAttribute).
    gg.jte.Content trailing    = null      slot after the bar (line form): status text, action.
    gg.jte.Content footer      = null      slot below the component (all forms): status text, note.

  ESCAPING (XSS decision rule):
    attrs     = TRUSTED raw ($unsafe) -- STATIC author-typed strings only (e.g. id="upload-progress").
                NEVER interpolate a per-row DB-derived value into attrs.
    dataAttrs = SAFE escaped Map<String,String>: each key validated as a simple identifier
                ([A-Za-z][A-Za-z0-9-]*), each value escaped via Escape.htmlAttribute.
    Per-row DB-derived values (e.g. a row id for a per-file upload) go through dataAttrs, never attrs.

  Usage:
    @@template.lievit.progress(value = 60, max = 100, label = "Uploading")
    @@template.lievit.progress(label = "Processing")
    @@template.lievit.progress(value = 75, form = "circle", size = "lg", showValue = true,
        variant = "success", label = "Sync complete")
    @@template.lievit.progress(value = 3, form = "steps", steps = 5, max = 5,
        label = "Step 3 of 5")
    @@template.lievit.progress(value = 40, striped = true, animated = true,
        variant = "info", label = "Uploading", labelledBy = "upload-heading")
--%>
@param Integer value = null
@param int max = 100
@param String valueText = null
@param String label = null
@param String labelledBy = null
@param String variant = "default"
@param String size = "md"
@param String form = "line"
@param boolean striped = false
@param boolean animated = false
@param boolean showValue = false
@param int steps = 0
@param int strokeWidth = 0
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param gg.jte.Content trailing = null
@param gg.jte.Content footer = null

<%-- ---- state derivation ---- --%>
!{boolean _indeterminate = (value == null);}
!{boolean _complete = !_indeterminate && value != null && value >= max;}
!{String _state = _indeterminate ? "indeterminate" : (_complete ? "complete" : "determinate");}

<%-- ---- percentage (clamped 0..100) ---- --%>
!{double _pct = _indeterminate ? 0.0 : Math.min(100.0, Math.max(0.0, (value.doubleValue() / max) * 100.0));}
!{String _pctStr = String.format("%.4f", _pct) + "%";}

<%-- ---- aria-valuenow: null when indeterminate so JTE omits the attribute entirely ---- --%>
!{String _valuenow = _indeterminate ? null : String.valueOf(value);}

<%-- ---- accessible name resolution ---- --%>
!{String _ariaLabelledBy = (labelledBy != null && !labelledBy.isBlank()) ? labelledBy : null;}
!{String _ariaLabel = (_ariaLabelledBy == null && label != null && !label.isBlank()) ? label : null;}

<%-- ---- variant -> fill token ---- --%>
!{String _fillToken = switch (variant) {
    case "info"        -> "var(--lv-color-info)";
    case "success"     -> "var(--lv-color-success)";
    case "warning"     -> "var(--lv-color-warning)";
    case "destructive" -> "var(--lv-color-destructive)";
    default            -> "var(--lv-color-primary)";
  };}

<%-- ---- size -> track height token (line/steps) and stroke width (circle/dashboard) ---- --%>
!{String _heightToken = switch (size) {
    case "sm" -> "var(--lv-space-1)";
    case "lg" -> "var(--lv-space-3)";
    default   -> "var(--lv-space-2)";
  };}
!{int _strokePx = (strokeWidth > 0) ? strokeWidth : switch (size) {
    case "sm" -> 4;
    case "lg" -> 12;
    default   -> 8;
  };}

<%-- ---- fill class: indeterminate animation vs determinate stripe vs plain ---- --%>
!{boolean _doAnimate = animated && striped && !_indeterminate;}
!{String _fillClass = _indeterminate
    ? "lv-progress-fill lv-progress-fill--indeterminate animate-[lv-progress-slide_var(--lv-motion-duration-slow)_var(--lv-motion-easing-in-out)_infinite] motion-reduce:animate-none"
    : (striped
        ? (_doAnimate
            ? "lv-progress-fill lv-progress-fill--striped lv-progress-fill--animated animate-[lv-progress-stripe-move_1s_linear_infinite] motion-reduce:animate-none"
            : "lv-progress-fill lv-progress-fill--striped")
        : "lv-progress-fill");}

<%-- ---- showValue text for line / steps forms (rendered after the bar, aria-hidden) ---- --%>
!{String _showValueText = String.format("%.0f%%", _pct);}

<%-- ---- SVG arc math for circle / dashboard forms (server-side computation) ---- --%>
<%-- circle: full 360deg ring.  dashboard: 270deg arc from 135deg to 405deg (speedometer). --%>
<%-- Outer viewBox is 120x120; track circle + fill circle centred at (60,60) with r=54. --%>
!{int _svgSize = 120;}
!{int _cx = 60;}
!{int _cy = 60;}
!{int _r = 60 - (_strokePx / 2) - 2;}
!{double _circumference = 2.0 * Math.PI * _r;}

<%-- circle: offset = circumference * (1 - pct/100) so full clockwise from top ---- --%>
!{double _fillPct = _indeterminate ? 0.0 : _pct / 100.0;}
!{double _circleOffset = _circumference * (1.0 - _fillPct);}
!{String _circleOffsetStr = String.format("%.4f", _circleOffset);}
!{String _circumferenceStr = String.format("%.4f", _circumference);}

<%-- dashboard: 270deg arc. Starting angle = 135deg (bottom-left), sweep = 270deg.
     Rotation of the track + fill circles: -135deg so 0% starts at bottom-left.
     Offset for dashboard = circumference * (1 - fillPct) + (circumference * 0.25)
     because the track itself is only 270deg of the full circumference (25% is hidden). ---- --%>
!{double _dashCircumference = _circumference * 0.75;}
!{double _dashOffset = _circumference * (1.0 - _fillPct) + (_circumference * 0.25);}
!{String _dashOffsetStr = String.format("%.4f", _dashOffset);}

<%-- ---- SAFE dynamic data-* fragment (mirrors alert.jte exactly) ---- --%>
!{var _dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      _dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), _dataAttrs_);
      _dataAttrs_.writeContent("\"");
    }
  }}
!{var _dataAttrsMarkup = _dataAttrs_.toString();}

<%-- ---- accessible name nag (both null -> axe-core aria-progressbar-name fires) ---- --%>
@if(_ariaLabel == null && _ariaLabelledBy == null)
<%-- A11y nag: progress bar has no accessible name. Provide `label` or `labelledBy`. The axe-core
     aria-progressbar-name rule will flag this. The component renders anyway because the consuming
     template owns the labelling decision (e.g. a nearby visible heading may serve as the label). --%>
@endif

<%-- ======================================================================== --%>
<%-- ROOT: role=progressbar + full ARIA contract                              --%>
<%-- ======================================================================== --%>
<div
  data-slot="progress"
  data-variant="${variant}"
  data-size="${size}"
  data-state="${_state}"
  data-form="${form}"
  role="progressbar"
  aria-valuemin="0"
  aria-valuemax="${max}"
  aria-valuenow="${_valuenow}"
  aria-valuetext="${valueText}"
  aria-label="${_ariaLabel}"
  aria-labelledby="${_ariaLabelledBy}"
  $unsafe{_dataAttrsMarkup}
  class="${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{attrs}
>

  @if("circle".equals(form) || "dashboard".equals(form))
    <%-- ================================================================== --%>
    <%-- CIRCLE / DASHBOARD forms: inline SVG (aria-hidden, purely presentational) --%>
    <%-- ================================================================== --%>
    !{boolean _isDashboard = "dashboard".equals(form);}
    !{String _svgTransform = _isDashboard ? "rotate(135 60 60)" : "rotate(-90 60 60)";}
    !{double _visibleCircumference = _isDashboard ? _dashCircumference : _circumference;}
    !{String _fillOffset = _isDashboard ? _dashOffsetStr : _circleOffsetStr;}
    <div data-slot="progress-svg-wrap" class="relative inline-flex items-center justify-center" style="width:${_svgSize}px;height:${_svgSize}px;">
      <svg
        aria-hidden="true"
        viewBox="0 0 ${_svgSize} ${_svgSize}"
        fill="none"
        style="width:${_svgSize}px;height:${_svgSize}px;"
      >
        <%-- Track (unfilled rail) --%>
        <circle
          cx="${_cx}"
          cy="${_cy}"
          r="${_r}"
          stroke="var(--lv-color-muted-bg)"
          stroke-width="${_strokePx}"
          fill="none"
          transform="${_svgTransform}"
          stroke-dasharray="${_circumferenceStr} ${_circumferenceStr}"
          stroke-dashoffset="${_isDashboard ? String.format("%.4f", _circumference * 0.25) : "0"}"
          stroke-linecap="round"
        />
        <%-- Fill arc --%>
        @if(!_indeterminate)
          <circle
            data-slot="progress-fill"
            cx="${_cx}"
            cy="${_cy}"
            r="${_r}"
            stroke="${_fillToken}"
            stroke-width="${_strokePx}"
            fill="none"
            transform="${_svgTransform}"
            stroke-dasharray="${_circumferenceStr} ${_circumferenceStr}"
            stroke-dashoffset="${_fillOffset}"
            stroke-linecap="round"
            style="transition:stroke-dashoffset var(--lv-duration) var(--lv-ease);"
          />
        @else
          <%-- Indeterminate: a short arc that rotates (pure CSS animation on the wrapping div) --%>
          <circle
            data-slot="progress-fill"
            class="animate-[lv-progress-arc-spin_1.4s_var(--lv-motion-easing-in-out)_infinite] motion-reduce:animate-none"
            cx="${_cx}"
            cy="${_cy}"
            r="${_r}"
            stroke="${_fillToken}"
            stroke-width="${_strokePx}"
            fill="none"
            transform="${_svgTransform}"
            stroke-dasharray="${String.format("%.4f", _circumference * 0.25)} ${_circumferenceStr}"
            stroke-dashoffset="0"
            stroke-linecap="round"
          />
        @endif
        <%-- showValue: percentage text centred in the SVG (aria-hidden: already in aria-valuenow) --%>
        @if(showValue)
          <text
            aria-hidden="true"
            data-slot="progress-value-text"
            x="${_cx}"
            y="${_cy}"
            dominant-baseline="central"
            text-anchor="middle"
            style="font-family:var(--lv-font-sans);font-size:var(--lv-text-sm);font-weight:var(--lv-font-medium);fill:var(--lv-color-fg);"
          >${_showValueText}</text>
        @endif
      </svg>
    </div>
  @elseif("steps".equals(form) && steps > 0)
    <%-- ================================================================== --%>
    <%-- STEPS form: discrete filled/empty segment spans                    --%>
    <%-- ================================================================== --%>
    !{int _filledCount = _indeterminate ? 0 : (int) Math.round((_pct / 100.0) * steps);}
    <div
      data-slot="progress-steps"
      class="flex w-full gap-[var(--lv-space-1)]"
    >
      @for(int _si = 0; _si < steps; _si++)
        <span
          aria-hidden="true"
          data-slot="${_si < _filledCount ? "progress-step-filled" : "progress-step-empty"}"
          class="flex-1 rounded-[var(--lv-radius-full)] transition-colors"
          style="height:${_heightToken};background:${_si < _filledCount ? _fillToken : "var(--lv-color-muted-bg)"};"
        ></span>
      @endfor
    </div>
    @if(showValue)
      <span
        aria-hidden="true"
        data-slot="progress-value-text"
        class="ml-[var(--lv-space-2)] shrink-0 tabular-nums"
        style="font-size:var(--lv-text-sm);color:var(--lv-color-fg);font-family:var(--lv-font-sans);"
      >${_showValueText}</span>
    @endif
    @if(trailing != null)
      <div data-slot="progress-trailing" class="mt-[var(--lv-space-1)]">${trailing}</div>
    @endif
  @else
    <%-- ================================================================== --%>
    <%-- LINE form (default): horizontal bar track + fill                   --%>
    <%-- ================================================================== --%>
    <div class="flex w-full items-center gap-[var(--lv-space-2)]">
      <div
        data-slot="progress-track"
        class="relative flex-1 overflow-hidden rounded-[var(--lv-radius-full)]"
        style="height:${_heightToken};background:var(--lv-color-muted-bg);"
      >
        @if(_indeterminate)
          <div
            data-slot="progress-fill"
            aria-hidden="true"
            class="${_fillClass} absolute inset-y-0 left-0 rounded-[var(--lv-radius-full)]"
            style="width:40%;background:${_fillToken};"
          ></div>
        @else
          <div
            data-slot="progress-fill"
            aria-hidden="true"
            class="${_fillClass} absolute inset-y-0 left-0 rounded-[var(--lv-radius-full)] transition-[width]"
            style="width:${_pctStr};background:${_fillToken};${striped ? "background-image:repeating-linear-gradient(-45deg,color-mix(in oklch,"+_fillToken+" 70%,transparent) 0,color-mix(in oklch,"+_fillToken+" 70%,transparent) 6px,transparent 6px,transparent 12px);" : ""}"
          ></div>
        @endif
      </div>
      @if(showValue)
        <span
          aria-hidden="true"
          data-slot="progress-value-text"
          class="shrink-0 tabular-nums"
          style="font-size:${size.equals("sm") ? "var(--lv-text-xs)" : "var(--lv-text-sm)"};color:var(--lv-color-fg);font-family:var(--lv-font-sans);"
        >${_showValueText}</span>
      @endif
    </div>
    @if(trailing != null)
      <div data-slot="progress-trailing" class="mt-[var(--lv-space-1)]">${trailing}</div>
    @endif
  @endif

  <%-- ---- footer slot (all forms) ---- --%>
  @if(footer != null)
    <div data-slot="progress-footer" class="mt-[var(--lv-space-2)]">${footer}</div>
  @endif
</div>
