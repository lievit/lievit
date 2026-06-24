@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui theme-switcher partial -- a three-state (light / dark / system) theme-preference
  control that persists the user's choice to localStorage and reflects it as data-theme on the
  configured root element, which is the single repoint mechanism the lievit token system uses.

  TIER: PARTIAL + ENH (theme-switcher.enhancer.ts, colocated).
  The control structure + initial state are server-rendered (CSP-clean, zero inline script).
  The irreducibly-client behaviour -- reading prefers-color-scheme, writing localStorage,
  toggling data-theme on the root, keeping aria-pressed in sync -- lives entirely in the
  colocated typed-TS enhancer that binds off data-lievit-enhancer="theme-switcher". No server
  round-trip; the theme preference is a client-side display fact, not a domain value the server owns.

  STRUCTURE (scientific decision rule): three variants ship under one `variant` param.
    "icon" (default): three icon-only button elements in a role="toolbar" wrapper; each button is
      square; each carries an aria-label from the label param. Pattern: WAI-ARIA APG Toolbar
      (https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) containing APG Toggle Buttons
      (https://www.w3.org/WAI/ARIA/apg/patterns/button/) with aria-pressed.
    "labeled": three buttons with icon + visible text label side by side; same toolbar grouping.
    "icon-labeled": a single button that cycles through states on click; its label + icon update
      to reflect the currently-active theme; behaves as a three-state cycling toggle.
  When showSystemOption=false the group shrinks to two options (light / dark).

  A11y (WAI-ARIA APG Toolbar + APG Button / Toggle Button):
    icon / labeled variants: root div has role="toolbar" + aria-label="Theme" (or adopter value);
      each option is a real <button aria-pressed>; aria-pressed="true" marks the active option;
      icon-only buttons carry aria-label for their accessible name; icons are decorative (auto
      aria-hidden="true" because label=null on the icon call).
    icon-labeled variant: root is a single <button aria-pressed>; visible <span aria-live="polite">
      carries the current mode label so AT announces the state change on press.
    Arrow/Home/End roving tabindex for the toolbar is handled by the colocated enhancer (not a
    shared collection-nav, since the toolbar uses data-theme-option selectors, not data-lievit-item).
    The component renders all buttons initially with aria-pressed="false" and hides the root via
    inline display:none; the enhancer corrects pressed states + shows the root synchronously on
    mount, before first paint.

  DISPLAY:NONE GUARD: the root carries inline style="display:none" which the enhancer removes
  synchronously in mount(), preventing a flash of incorrectly-pressed buttons. This is correct:
  the preference is a client fact (localStorage); the server cannot know it.

  PERSISTENCE: data-storage-key names the localStorage key the enhancer reads/writes (default
  "lievit-theme"). data-root-selector names the element that receives data-theme="light|dark"
  (default "html"). data-default-theme is the fallback when no stored preference exists.

  EXTRA ATTRIBUTES -- two channels, by trust (the XSS decision rule, from button.jte):
    attrs     (TRUSTED raw, $unsafe) -- STATIC author-typed strings only (e.g. id="theme-switcher"
              when wiring an external aria-labelledby). NEVER a per-row DB value.
    dataAttrs (SAFE escaped) -- Map of String to String of dynamic data-* attributes; each value
              goes through Escape.htmlAttribute. Per-row values go here and ONLY here.

  Params:
    String variant            = "icon"         "icon" | "labeled" | "icon-labeled"
    String size               = "md"           sm | md | lg -- height-based, toolbar-aligned
    String storageKey         = "lievit-theme" localStorage key the enhancer reads/writes
    String rootSelector       = "html"         CSS selector for the element that gets data-theme
    String defaultTheme       = "system"       "light" | "dark" | "system" -- fallback preference
    String labelLight         = "Light"        accessible label (+ visible label in "labeled" variant)
    String labelDark          = "Dark"         accessible label (+ visible label in "labeled" variant)
    String labelSystem        = "System"       accessible label (+ visible label in "labeled" variant)
    boolean showSystemOption  = true           false = only light/dark (two-state toggle)
    String cssClass           = ""             extra utility classes on the root element
    String attrs              = ""             TRUSTED raw ($unsafe) -- STATIC strings only
    Map of String to String dataAttrs = {}     SAFE escaped dynamic data-* (value via Escape.htmlAttribute)

  Usage:
    @@template.lievit.theme-switcher()
    @@template.lievit.theme-switcher(variant = "labeled", size = "sm")
    @@template.lievit.theme-switcher(variant = "icon-labeled", storageKey = "ht-theme",
        defaultTheme = "dark", showSystemOption = false)
    @@template.lievit.theme-switcher(variant = "icon", labelLight = "Chiaro",
        labelDark = "Scuro", labelSystem = "Sistema",
        attrs = "id=\"theme-switcher\"")
--%>
@param String variant = "icon"
@param String size = "md"
@param String storageKey = "lievit-theme"
@param String rootSelector = "html"
@param String defaultTheme = "system"
@param String labelLight = "Light"
@param String labelDark = "Dark"
@param String labelSystem = "System"
@param boolean showSystemOption = true
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

<%-- Height tokens for each size (toolbar-aligned, architecture contract §5.b).
     sm -> --lv-space-8 (32px); md -> --lv-space-9 (36px); lg -> --lv-space-10 (40px) --%>
!{var _h = switch (size) {
    case "sm" -> "var(--lv-space-8)";
    case "lg" -> "var(--lv-space-10)";
    default   -> "var(--lv-space-9)";
  };}

<%-- Text size: sm/md use --lv-text-sm; lg uses --lv-text-base --%>
!{var _textSize = "lg".equals(size) ? "var(--lv-text-base)" : "var(--lv-text-sm)";}

<%-- Horizontal padding for labeled buttons: scales with height (same scale as button.jte). --%>
!{var _hPad = switch (size) {
    case "sm" -> "var(--lv-space-2)";
    case "lg" -> "var(--lv-space-3)";
    default   -> "var(--lv-space-2)";
  };}

<%-- SAFE dynamic data-* attribute fragment (mirrors badge.jte exactly). Built once; emitted $unsafe
     because every VALUE is already escaped through Escape.htmlAttribute.
     JTE forbids a raw @for in attribute-NAME position, so we build outside the HTML context. --%>
!{var _dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      _dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), _dataAttrs_);
      _dataAttrs_.writeContent("\"");
    }
  }}
!{var _dataAttrsMarkup = _dataAttrs_.toString();}

<%-- Shared root data-* attributes: the enhancer reads all of these on mount.
     Emitted as a string so they can be shared across the two structural branches. --%>
!{var _commonDataAttrs = " data-slot=\"theme-switcher\""
    + " data-lievit-enhancer=\"theme-switcher\""
    + " data-variant=\"" + variant + "\""
    + " data-size=\"" + size + "\""
    + " data-storage-key=\"" + storageKey + "\""
    + " data-root-selector=\"" + rootSelector + "\""
    + " data-default-theme=\"" + defaultTheme + "\""
    + " data-show-system=\"" + showSystemOption + "\"";}

<%-- Shared button base style for icon-only and labeled option buttons.
     aria-pressed="true" drives the active segment look via an attribute selector --
     no extra class needed: the CSS attr selector [aria-pressed=true] is the styling discriminant.
     focus-visible:shadow-[var(--lv-ring)] provides the shared focus ring (architecture contract §5.c).
     transition on background + color gives the cross-fade on state shift (--lv-motion-fast). --%>
!{var _btnBase = "inline-flex items-center justify-center outline-none"
    + " text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)]"
    + " text-[var(--lv-color-muted)] transition-colors"
    + " hover:bg-[color-mix(in_srgb,var(--lv-color-accent)_10%,transparent)]"
    + " hover:text-[var(--lv-color-fg)]"
    + " focus-visible:shadow-[var(--lv-ring)] focus-visible:relative focus-visible:z-10"
    + " aria-[pressed=true]:bg-[var(--lv-color-accent)]"
    + " aria-[pressed=true]:text-[var(--lv-color-accent-fg)]"
    + " border-[var(--lv-color-border)] bg-transparent"
    + " disabled:pointer-events-none disabled:opacity-[var(--lv-opacity-disabled)]";}

<%-- Icon-only button: square (width = height), rounded per the individual button spec.
     border-l-0 + no left-radius on non-first, no right-radius on non-last = collapsed group. --%>
!{var _iconBtnClass = _btnBase
    + " border rounded-[var(--lv-radius-sm)]"
    + " [&:not(:first-child)]:rounded-l-none [&:not(:first-child)]:border-l-0"
    + " [&:not(:last-child)]:rounded-r-none";}

<%-- Labeled button: icon + text side by side with gap + horizontal padding. --%>
!{var _labeledBtnClass = _btnBase
    + " gap-[var(--lv-space-1)] border rounded-[var(--lv-radius-sm)]"
    + " [&:not(:first-child)]:rounded-l-none [&:not(:first-child)]:border-l-0"
    + " [&:not(:last-child)]:rounded-r-none";}

<%-- "icon-labeled" single button: stands alone, not in a group; has its own rounded-full and size. --%>
!{var _singleBtnClass = _btnBase
    + " gap-[var(--lv-space-1)] border rounded-[var(--lv-radius-md)] px-[var(--lv-space-2)]";}

<%-- Determine the initial label for the single-button variant from defaultTheme. --%>
!{var _initialLabel = "dark".equals(defaultTheme) ? labelDark
    : "light".equals(defaultTheme) ? labelLight
    : labelSystem;}

@if("icon-labeled".equals(variant))
<%-- SINGLE-BUTTON "icon-labeled" VARIANT --
     One button cycles through states on click. The enhancer updates icon + label + aria-label.
     aria-live="polite" on the <span> label so AT announces the state change without requiring
     re-focus (spec §4 screen-reader note).
     The root IS the button: data-lievit-enhancer on the button directly. --%>
<button
  type="button"
  $unsafe{_commonDataAttrs}
  aria-pressed="false"
  aria-label="${_initialLabel}"
  class="${_singleBtnClass} ${cssClass}"
  style="height:${_h};font-family:var(--lv-font-sans);font-size:${_textSize};display:none;"
  $unsafe{_dataAttrsMarkup}
  $unsafe{attrs}
>@template.lievit.icon(name = "sun", size = "1em", cssClass = "shrink-0")
  <span data-slot="theme-switcher-label" aria-live="polite" style="white-space:nowrap;">${_initialLabel}</span>
</button>
@else
<%-- THREE-BUTTON TOOLBAR VARIANTS ("icon" and "labeled") --
     A role="toolbar" div groups three aria-pressed toggle buttons (APG Toolbar pattern).
     The toolbar itself is a single tab stop; the enhancer manages roving tabindex within it so
     only the active button has tabindex="0" (APG Toolbar + APG Toggle Button §keyboard).
     All three buttons start with aria-pressed="false" and tabindex="-1"; the enhancer corrects
     both on mount, synchronously, before un-hiding the root (display:none guard). --%>
<div
  role="toolbar"
  aria-label="Theme"
  $unsafe{_commonDataAttrs}
  class="inline-flex items-stretch rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] shadow-[var(--lv-shadow-xs)] ${cssClass}"
  style="height:${_h};font-family:var(--lv-font-sans);font-size:${_textSize};display:none;"
  $unsafe{_dataAttrsMarkup}
  $unsafe{attrs}
>
  <%-- Light option button --%>
  <button
    type="button"
    data-theme-option="light"
    aria-label="${labelLight}"
    aria-pressed="false"
    tabindex="-1"
    class="${"labeled".equals(variant) ? _labeledBtnClass : _iconBtnClass}"
    style="${"labeled".equals(variant) ? "padding-left:" + _hPad + ";padding-right:" + _hPad + ";" : "width:" + _h + ";"}"
  >@template.lievit.icon(name = "sun", size = "1em", cssClass = "shrink-0")
    @if("labeled".equals(variant))<span data-slot="theme-switcher-label">${labelLight}</span>@endif
  </button>
  <%-- Dark option button --%>
  <button
    type="button"
    data-theme-option="dark"
    aria-label="${labelDark}"
    aria-pressed="false"
    tabindex="-1"
    class="${"labeled".equals(variant) ? _labeledBtnClass : _iconBtnClass}"
    style="${"labeled".equals(variant) ? "padding-left:" + _hPad + ";padding-right:" + _hPad + ";" : "width:" + _h + ";"}"
  >@template.lievit.icon(name = "moon", size = "1em", cssClass = "shrink-0")
    @if("labeled".equals(variant))<span data-slot="theme-switcher-label">${labelDark}</span>@endif
  </button>
  @if(showSystemOption)
  <%-- System option button (conditional on showSystemOption) --%>
  <button
    type="button"
    data-theme-option="system"
    aria-label="${labelSystem}"
    aria-pressed="false"
    tabindex="-1"
    class="${"labeled".equals(variant) ? _labeledBtnClass : _iconBtnClass}"
    style="${"labeled".equals(variant) ? "padding-left:" + _hPad + ";padding-right:" + _hPad + ";" : "width:" + _h + ";"}"
  >@template.lievit.icon(name = "monitor", size = "1em", cssClass = "shrink-0")
    @if("labeled".equals(variant))<span data-slot="theme-switcher-label">${labelSystem}</span>@endif
  </button>
  @endif
</div>
@endif
