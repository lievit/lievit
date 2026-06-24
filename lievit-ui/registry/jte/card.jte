@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui card partial -- a visual grouping surface with a structured header + body + footer.

  TIER: PARTIAL -- pure server-rendered presentation. No enhancer, no client state. The card is a
  structural container; interactivity belongs to the content composed inside it or to the wrapper
  the caller places around it.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA: no APG widget pattern applies (a card is a structural grouping, not an interactive
      widget). A11y contract follows WAI-ARIA landmark semantics + heading hierarchy:
      as="section" with a title -> region landmark (aria-labelledby); as="div" -> no landmark.
    - Inventory reference: Ant Design Card (sizes, bordered, extra slot, inner card / meta card).
      The collapsible variant is NOT in the card -- it is the `accordion` WIRE component composed
      inside the content slot (single-source rule: the accordion owns the open-state + APG Accordion
      keyboard contract).
    - Styling: ORIGINAL generation over --lv-* (OKLCH) tokens; look inspired by Tailwind UI (no
      code copied). Five variants map to the library's intent vocabulary (same token pairs as alert).

  A11y (WAI-ARIA structural, no APG widget):
    - as="section" + title set: aria-labelledby points at the heading (id=titleId); the region is
      announced by name in the AT landmark list. Required per APG: a <section> without a name is
      treated as generic and not listed.
    - as="section" + no title + no aria-labelledby in attrs: axe fires region-missing-accessible-name.
      The template comment documents this requirement; it is an ABUSE CASE, not a bug.
    - as="div": no landmark, no aria-labelledby (correct for decorative grouping).
    - as="article": native role="article" landmark; no additional role attr needed.
    - titleTag (h1..h6): the caller MUST choose the level consistent with the surrounding document
      outline. The card does not impose h3 everywhere; h3 is the default for a typical sub-section.
    - The card root is NOT focusable (no tabindex in the default template). Interactive descendants
      (buttons in trailing, form controls in content, footer buttons) handle their own keys.
    - Collapsible composition: the `accordion` WIRE component owns aria-expanded + aria-controls +
      Enter/Space on its native <button> trigger. The card partial is passive; those attributes MUST
      NOT appear on the card root (seeing them is a defect).

  Params:
    String as              = "div"     root element: "div" | "section" | "article".
    String variant         = "default" "default" | "outlined" | "elevated" | "ghost" | "destructive".
    String size            = "md"      "sm" | "md" | "lg" -- internal padding + header typography.
    String title           = null      card title text. When set, the header region renders.
                                       When null AND no header slot, the header is omitted.
    String titleTag        = "h3"      heading element: "h1".."h6". Ignored when header slot used.
    String titleId         = "lv-card-title"  id linking aria-labelledby to the heading element.
                                       Override per card in a list to avoid duplicate ids.
    String subtitle        = null      secondary text below the title.
    boolean bordered       = true      renders the border ring (--lv-color-border).
    boolean noPadding      = false     strips body padding (full-bleed content like a table/image).
    boolean fullHeight     = false     adds h-full so the card fills its grid cell.
    String cssClass        = ""        extra utility classes on the root element.
    String attrs           = ""        TRUSTED raw ($unsafe) -- STATIC author-typed strings only
                                       (aria-label="Revenue summary", tabindex, data-* analytics).
                                       NEVER interpolate a per-row DB value here.
    Map<String,String> dataAttrs = {}  SAFE escaped dynamic data-* (value via Escape.htmlAttribute).
    gg.jte.Content header  = null      SLOT -- replaces the title/subtitle/titleTag auto-header.
                                       When set, title + subtitle + titleTag are ignored.
    gg.jte.Content leading = null      SLOT -- icon or avatar placed before the title in the header.
    gg.jte.Content trailing = null     SLOT -- action area (buttons, dropdown-menu) at header end.
    gg.jte.Content footer  = null      SLOT -- padded footer bar below the body, separated by border.
    gg.jte.Content content             REQUIRED -- the card body (everything inside the body padding).

  Usage:
    @@template.lievit.card(content = @@`<p>Plain surface.</p>`)
    @@template.lievit.card(as = "section", title = "Revenue", titleId = "rev-card",
      content = @@`<p>Fiscal Q2 summary.</p>`)
    @@template.lievit.card(variant = "elevated", size = "lg",
      title = "Team plan", titleTag = "h2",
      subtitle = "Billed monthly",
      trailing = @@`<button type="button">Upgrade</button>`,
      content = @@`<p>2 of 5 seats used.</p>`,
      footer = @@`<small>Renews 1 Jul</small>`)
    @@template.lievit.card(variant = "destructive", noPadding = true,
      title = "Error", content = @@`<table>...</table>`)
    @@template.lievit.card(variant = "ghost", bordered = false,
      content = @@`<p>Content-only grouping.</p>`)
--%>
@param String as = "div"
@param String variant = "default"
@param String size = "md"
@param String title = null
@param String titleTag = "h3"
@param String titleId = "lv-card-title"
@param String subtitle = null
@param boolean bordered = true
@param boolean noPadding = false
@param boolean fullHeight = false
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param gg.jte.Content header = null
@param gg.jte.Content leading = null
@param gg.jte.Content trailing = null
@param gg.jte.Content footer = null
@param gg.jte.Content content

<%-- Derived: header presence --%>
!{var hasHeader = title != null || header != null;}

<%-- Variant -> bg + border + shadow.
     "elevated": shadow replaces border (bordered effectively false for elevated).
     "destructive": tinted bg (color-mix 10%) + destructive border. --%>
!{var variantBg = switch (variant) {
    case "outlined"    -> "transparent";
    case "elevated"    -> "var(--lv-color-popover)";
    case "ghost"       -> "transparent";
    case "destructive" -> "color-mix(in srgb, var(--lv-color-destructive) 10%, var(--lv-color-bg))";
    default            -> "var(--lv-color-card)";
  };}
!{var variantFg = "destructive".equals(variant) ? "var(--lv-color-fg)" : "var(--lv-color-card-fg)";}
!{var variantBorder = switch (variant) {
    case "ghost"       -> "none";
    case "elevated"    -> "none";
    case "destructive" -> "1px solid var(--lv-color-destructive)";
    default            -> bordered ? "1px solid var(--lv-color-border)" : "none";
  };}
<%-- elevated always gets shadow; ghost + outlined get none; default gets xs when no border; md for elevated. --%>
!{var variantShadow = switch (variant) {
    case "elevated" -> "var(--lv-shadow-md)";
    case "ghost"    -> "none";
    case "outlined" -> "none";
    default         -> bordered ? "var(--lv-shadow-xs)" : "none";
  };}

<%-- Size -> body padding + header title size + subtitle size.
     noPadding strips body padding independently; header retains its padding. --%>
!{var bodyPad = noPadding ? "0" : switch (size) {
    case "sm" -> "var(--lv-space-3)";
    case "lg" -> "var(--lv-space-6)";
    default   -> "var(--lv-space-4)";
  };}
!{var headerPad = switch (size) {
    case "sm" -> "var(--lv-space-3)";
    case "lg" -> "var(--lv-space-6) var(--lv-space-6) var(--lv-space-4)";
    default   -> "var(--lv-space-4)";
  };}
!{var footerPad = switch (size) {
    case "sm" -> "var(--lv-space-3)";
    case "lg" -> "var(--lv-space-4) var(--lv-space-6)";
    default   -> "var(--lv-space-3) var(--lv-space-4)";
  };}
!{var titleSize  = switch (size) {
    case "sm" -> "var(--lv-text-sm)";
    case "lg" -> "var(--lv-text-lg)";
    default   -> "var(--lv-text-base)";
  };}
!{var subtitleSize = "sm".equals(size) ? "var(--lv-text-xs)" : "var(--lv-text-sm)";}

<%-- aria-labelledby on the root when as="section" + title is set (auto-header path only). --%>
!{var ariaLabelledBy = "section".equals(as) && title != null ? titleId : null;}

<%-- h-full class when fullHeight=true --%>
!{var heightClass = fullHeight ? " h-full" : "";}

<%-- SAFE dynamic data-* attributes (mirrors badge.jte / alert.jte pattern).
     JTE forbids @for in attribute-NAME position; build the fragment here. --%>
!{var _da = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      _da.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), _da);
      _da.writeContent("\"");
    }
  }}
!{var _daMarkup = _da.toString();}
<%-- The root is always a <div> (JTE forbids an expression in a tag NAME). The `as` landmark
     intent is preserved via role: a titled section becomes a labelled region; an article keeps
     role=article. A plain div carries no role. This is JTE-safe (role is an attribute value). --%>
!{var _role = ("section".equals(as) && title != null) ? "region" : ("article".equals(as) ? "article" : null);}

<div
  data-slot="card"
  data-variant="${variant}"
  data-size="${size}"
  role="${_role}"
  aria-labelledby="${ariaLabelledBy}"
  class="flex flex-col overflow-hidden font-[var(--lv-font-sans)]${heightClass} ${cssClass}"
  style="background:${variantBg};color:${variantFg};border:${variantBorder};box-shadow:${variantShadow};border-radius:var(--lv-radius-lg);"
  $unsafe{_daMarkup}
  $unsafe{attrs}
>
  @if(hasHeader)
    <div data-slot="card-header"
      class="flex items-start gap-[var(--lv-space-2)]"
      style="padding:${headerPad};"
    >
      @if(leading != null)
        <div data-slot="card-leading" class="shrink-0 flex items-center">${leading}</div>
      @endif
      @if(header != null)
        <div data-slot="card-title-area" class="min-w-0 flex-1">${header}</div>
      @else
        <div data-slot="card-title-area" class="min-w-0 flex-1 grid gap-[var(--lv-space-1)]">
          <%-- JTE forbids an expression in a tag name, so the heading is a role=heading div with
               aria-level derived from titleTag (h1..h6); semantically equivalent to the native tag. --%>
          <div
            id="${titleId}"
            data-slot="card-title"
            role="heading"
            aria-level="${titleTag != null && titleTag.matches("h[1-6]") ? titleTag.substring(1) : "2"}"
            class="leading-[var(--lv-leading-none)]"
            style="font-size:${titleSize};font-weight:var(--lv-font-medium);margin:0;"
          >${title}</div>
          @if(subtitle != null)
            <p data-slot="card-subtitle"
              class="m-0 text-[var(--lv-color-muted-fg)]"
              style="font-size:${subtitleSize};font-weight:var(--lv-font-normal);"
            >${subtitle}</p>
          @endif
        </div>
      @endif
      @if(trailing != null)
        <div data-slot="card-trailing" class="ml-auto shrink-0 flex items-center gap-[var(--lv-space-2)]">${trailing}</div>
      @endif
    </div>
    <%-- visual separator between header and body (border-t, aria-hidden) --%>
    <div data-slot="card-separator" aria-hidden="true"
      style="height:1px;background:var(--lv-color-border);flex-shrink:0;"
    ></div>
  @endif
  <div data-slot="card-body" style="padding:${bodyPad};flex:1;">${content}</div>
  @if(footer != null)
    <div data-slot="card-separator-footer" aria-hidden="true"
      style="height:1px;background:var(--lv-color-border);flex-shrink:0;"
    ></div>
    <div data-slot="card-footer" class="flex items-center" style="padding:${footerPad};">${footer}</div>
  @endif
</div>
