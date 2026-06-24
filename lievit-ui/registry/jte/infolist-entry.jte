@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui infolist-entry partial -- a single labelled key-value row inside a description list
  (<dl>), rendering one piece of read-only structured data with a label and a value region.
  The canonical use is the infolist / descriptions pattern: a grid of labelled facts about a
  record (name, status, address, date) as part of a detail view or a form read-only summary.

  TIER: PARTIAL -- pure server-rendered presentation (architecture contract §1: "pure display ->
  PARTIAL"). The component holds no interaction state: the server knows the label and the value
  and renders them once. Zero enhancer, zero WIRE round-trip, CSP-clean.

  STRUCTURE (scientific decision rule):
    - Inventory reference: Ant Design Descriptions (sizes, variants, bordered/plain, colon toggle,
      icon leading, colspan) + Filament InfolistEntry field family as kit-usage reference.
    - a11y: native HTML <dl>/<dt>/<dd> description list -- the correct native structure for
      key-value pairs, understood by all screen readers; no WAI-ARIA APG interactive pattern
      applies (static display). WHATWG HTML Living Standard 4.4.9 and WAI-ARIA APG both defer
      to native <dl> semantics for static description lists; no role override is needed.
    - The colon after the label is a CSS <dt>::after { content: ": " } driven by data-colon on
      the root (toggled off when colon=false) -- NOT a literal ":" in the DOM (avoids a screen
      reader reading the colon as punctuation between term and definition).
    - Copyable button: a real native <button> using the native Clipboard API via a
      data-lievit-action="copy" directive (runtime-wired, no inline JS). CSP-clean.
    - Variant ink: applied to the <dd> value region only; <dt> label stays muted in all variants.
    - Colspan: rendered as data-colspan on the root for the parent CSS grid to consume via
      grid-column: span N -- the partial does not set grid-column itself (the parent grid owns
      the layout rule).
    - Orientation: vertical (stacked) vs horizontal (label column left) driven by data-orientation
      + CSS. The horizontal label column width defaults via --lv-infolist-label-w (component-scoped
      layout custom property, overridable by the adopter at :root or on a parent element).

  A11y (no WAI-ARIA APG pattern -- static display):
    Root <div>: data-slot="infolist-entry", data-variant, data-size, data-orientation;
      aria-busy="true" when loading=true.
    <dt>: native term role (implicit); optional leading slot then label text; colon via CSS ::after,
      not in the DOM; leading icon is aria-hidden="true" (decorative -- label text is the name).
    <dd>: native definition role (implicit); value slot or empty fallback string.
    Skeleton <span>: role="status" aria-label="Loading" when loading=true.
    Copy <button>: aria-label="Copy <label>" at rest; aria-label="Copied" during 1500ms feedback;
      focus-visible ring via --lv-ring. Platform handles Tab/Enter/Space (native button).
    Empty fallback: the empty string is the <dd> text; screen readers read it, no silent gaps.

  Params:
    String label           (required) the human-readable field label; rendered in <dt>;
                                      the accessible name for the entry; MUST NOT be blank.
    String variant       = "default"  default | highlight | destructive | success | warning.
    String size          = "md"       sm | md | lg -- label font, value font, block padding-y.
    String orientation   = "vertical" vertical (label above value) | horizontal (label left).
    boolean bordered     = false      wraps the entry in a --lv-color-border cell ring.
    boolean colon        = true       appends a colon after label text via CSS ::after.
    int colspan          = 1          grid columns this entry spans (data-colspan on root).
    String empty         = "—"        fallback text in <dd> when value slot is absent.
    boolean copyable     = false      renders a copy-to-clipboard <button> trailing the value.
    boolean loading      = false      replaces value region with a skeleton pulse (aria-busy).
    String cssClass      = ""         extra utility classes appended to the root element.
    String attrs         = ""         TRUSTED raw ($unsafe) -- STATIC author-typed strings only
                                      (data-testid, id). NEVER feed a per-row DB value here.
    Map of String to String dataAttrs = {} SAFE escaped dynamic data-* (Escape.htmlAttribute per value).
    gg.jte.Content leading = null     optional icon or avatar before the label text in <dt>.
    gg.jte.Content value   = null     the value markup projected into <dd>; empty -> empty fallback.

  Usage:
    @@template.lievit.infolist-entry(label = "Stato", value = @@`Attivo`)
    @@template.lievit.infolist-entry(label = "ID", variant = "highlight", copyable = true,
        value = @@`<code>ABC-1234</code>`)
    @@template.lievit.infolist-entry(label = "Scadenza", variant = "destructive", colspan = 2,
        value = @@`31/12/2024`, orientation = "horizontal")
    @@template.lievit.infolist-entry(label = "Note", loading = true)
    @@template.lievit.infolist-entry(label = "Categoria", empty = "n/a")
--%>
@param String label
@param String variant = "default"
@param String size = "md"
@param String orientation = "vertical"
@param boolean bordered = false
@param boolean colon = true
@param int colspan = 1
@param String empty = "—"
@param boolean copyable = false
@param boolean loading = false
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param gg.jte.Content leading = null
@param gg.jte.Content value = null

<%-- Derived: value-region ink token per variant (applied to <dd>).
     The <dt> label stays muted in all variants (it is structural, not the emphasis surface). --%>
!{var _valueColor = switch (variant) {
    case "highlight"   -> "var(--lv-color-primary)";
    case "destructive" -> "var(--lv-color-destructive)";
    case "success"     -> "var(--lv-color-success)";
    case "warning"     -> "var(--lv-color-warning)";
    default            -> "var(--lv-color-fg)";
  };}

<%-- Derived: tinted background for non-default variants (the intent bg at reduced opacity via
     color-mix, same approach as alert.jte -- no baked hex, pure token arithmetic). --%>
!{var _hasTint = !"default".equals(variant);}
!{var _valueBg = _hasTint
    ? "color-mix(in srgb," + _valueColor + " 8%,transparent)"
    : "transparent";}

<%-- Derived: size-driven label font, value font, and block padding-y. --%>
!{var _labelFont = "sm".equals(size)
    ? "var(--lv-text-xs)"
    : "var(--lv-text-sm)";}
!{var _valueFont = switch (size) {
    case "sm" -> "var(--lv-text-sm)";
    case "lg" -> "var(--lv-text-lg)";
    default   -> "var(--lv-text-base)";
  };}
!{var _paddingY = switch (size) {
    case "sm" -> "var(--lv-space-1)";
    case "lg" -> "var(--lv-space-3)";
    default   -> "var(--lv-space-2)";
  };}

<%-- Derived: orientation layout style.
     Vertical: flex-direction column (dt stacked above dd, full cell width).
     Horizontal: flex-direction row; <dt> has a fixed label column width via --lv-infolist-label-w
     (a layout custom property defined on the root; the adopter overrides it at :root or on a parent
     element -- not a colour token, so it lives as a direct style property here, not in tokens.css). --%>
!{var _isHorizontal = "horizontal".equals(orientation);}
!{var _rootDisplay = _isHorizontal ? "flex" : "flex";}
!{var _rootFlexDir = _isHorizontal ? "row" : "column";}
!{var _dtWidth = _isHorizontal ? "var(--lv-infolist-label-w, 8rem)" : "auto";}
!{var _dtShrink = _isHorizontal ? "0" : "1";}

<%-- Derived: bordered ring style. --%>
!{var _borderStyle = bordered
    ? "border:1px solid var(--lv-color-border);border-radius:var(--lv-radius-sm);padding:var(--lv-space-2);"
    : "";}

<%-- Derived: accessible label for the copy button. --%>
!{var _copyLabel = "Copy " + label;}

<%-- SAFE dynamic data-* attributes (verbatim pattern from badge.jte + alert.jte).
     JTE's HTML parser forbids a raw @for in attribute-NAME position; build the fragment once
     here and emit it with $unsafe -- every dynamic VALUE is escaped via Escape.htmlAttribute. --%>
!{var _dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      _dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), _dataAttrs_);
      _dataAttrs_.writeContent("\"");
    }
  }}
!{var _dataAttrsMarkup = _dataAttrs_.toString();}

<div
  data-slot="infolist-entry"
  data-variant="${variant}"
  data-size="${size}"
  data-orientation="${orientation}"
  data-colspan="${colspan}"
  data-colon="${colon ? "true" : "false"}"
  aria-busy="${loading ? "true" : null}"
  class="${cssClass}"
  style="font-family:var(--lv-font-sans);display:${_rootDisplay};flex-direction:${_rootFlexDir};gap:var(--lv-space-2);${_borderStyle}"
  $unsafe{_dataAttrsMarkup}
  $unsafe{attrs}
>
  <%-- Term (<dt>): muted label, optional leading slot, colon appended via CSS (data-colon on root). --%>
  <dt
    data-slot="infolist-entry-label"
    style="margin:0;padding-block:${_paddingY};font-size:${_labelFont};font-weight:var(--lv-font-medium);color:var(--lv-color-muted);line-height:var(--lv-leading);display:inline-flex;align-items:center;gap:var(--lv-space-2);flex-shrink:${_dtShrink};width:${_dtWidth};white-space:${_isHorizontal ? "nowrap" : "normal"};"
  >
    @if(leading != null)
      <span aria-hidden="true" style="display:inline-flex;align-items:center;flex-shrink:0;">${leading}</span>
    @endif
    <span>${label}</span>
  </dt>

  <%-- Definition (<dd>): value region; ink + optional tint background per variant.
       When loading: skeleton pulse. When value slot absent: empty fallback string.
       When copyable: copy <button> trailing the value (native Clipboard API via runtime directive). --%>
  <dd
    data-slot="infolist-entry-value"
    style="margin:0;padding-block:${_paddingY};font-size:${_valueFont};color:${_valueColor};background:${_valueBg};line-height:var(--lv-leading);display:inline-flex;align-items:center;gap:var(--lv-space-2);flex:1;min-width:0;"
  >
    @if(loading)
      <%-- Skeleton pulse: fills a representative width; pure CSS animation via lv-skeleton-shimmer.
           role="status" + aria-label announces the loading state to screen readers. --%>
      <span
        data-slot="infolist-entry-skeleton"
        role="status"
        aria-label="Loading"
        style="display:block;height:var(--lv-text-base);width:60%;border-radius:var(--lv-radius-sm);background:linear-gradient(90deg,var(--lv-skeleton-bg) 25%,var(--lv-skeleton-shimmer) 50%,var(--lv-skeleton-bg) 75%);background-size:400% 100%;animation:lv-skeleton-shimmer var(--lv-duration-fast) var(--lv-motion-easing-linear) infinite;"
      ></span>
    @elseif(value != null)
      <span data-slot="infolist-entry-value-content" style="min-width:0;flex:1;">${value}</span>
      @if(copyable)
        <%-- Copy button: native <button>, no inline JS. The lievit runtime binds the copy
             behavior via data-lievit-action="copy"; the <dd> sibling text is the copy source.
             aria-label shifts to "Copied" for 1500ms via the runtime callback (CSP-clean). --%>
        <button
          type="button"
          data-slot="infolist-entry-copy"
          data-lievit-action="copy"
          aria-label="${_copyLabel}"
          style="display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:var(--lv-space-5);height:var(--lv-space-5);padding:0;border:0;background:transparent;cursor:pointer;border-radius:var(--lv-radius-sm);color:var(--lv-color-muted);outline:none;transition:color var(--lv-duration-fast) var(--lv-ease),box-shadow var(--lv-duration-fast) var(--lv-ease);"
          class="focus-visible:shadow-[var(--lv-ring)] hover:text-[var(--lv-color-fg)]"
        >@template.lievit.icon(name = "copy", size = "0.875rem")</button>
      @endif
    @else
      <span data-slot="infolist-entry-empty" style="color:var(--lv-color-muted);">${empty}</span>
    @endif
  </dd>
</div>
