@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui section partial -- a titled, optionally collapsible container that groups fields /
  entries under a heading (Filament Section; the schema + infolist layout container).

  TIER: PARTIAL -- pure server-rendered presentation. No enhancer, no client state.

  STRUCTURE (scientific decision rule):
    - Collapsible variant: native <details>/<summary> (zero JS, CSP-clean). The platform exposes
      aria-expanded on <details> and handles Enter/Space on <summary> natively. Initial open/closed
      state is a SERVER fact (the `collapsed` flag rendered as the `open` attribute). No Lit island,
      no wire component, no JS.
    - Non-collapsible: a plain <section> + heading (no disclosure affordance). Degrades to the
      simplest structural thing that works.
    - Aside layout: a CSS grid that puts the header in a side rail beside the content. Only
      meaningful as non-collapsible (a <details>/<summary> does not compose with a grid rail), so
      aside implies non-collapsible.
    - Surface: same token set as card.jte (--lv-color-card / -card-fg / -border / -radius-lg /
      -shadow-xs) so a single retheme retints both surfaces consistently.

  A11y (WAI-ARIA structural, no APG widget):
    - A heading present: the root carries aria-labelledby pointing at the title id, giving the
      <section> an accessible name so screen readers list it in the regions landmark list (required
      per APG landmark rules for <section>).
    - Collapsible summary: <summary> is a real disclosure widget; Enter/Space toggle it via the
      platform. No hand-rolled keyboard logic.
    - The chevron rotate-on-open is opt-in via ONE adopter stylesheet rule keyed off the platform
      [open] state (the strict CSP forbids an inline <style> block):
          [data-slot="section"][open] .lv-section-chevron { transform: rotate(180deg); }
      Without it the section still opens + closes; only the glyph stays put.
    - The section root is NOT focusable (no tabindex in the default template). The <summary> is the
      only native interactive element; it is keyboard-reachable via Tab.

  Params:
    String heading             = null   the section title (renders a header when set).
    String headingId           = "lv-section-heading"  id linking aria-labelledby to the title.
                                        Override per section in a list to avoid duplicate ids.
    gg.jte.Content description = null   a muted subtitle under the title.
    gg.jte.Content content              REQUIRED -- the section body.
    gg.jte.Content aside       = null   header-rail slot (Filament aside); implies non-collapsible.
    boolean collapsible        = false  render the disclosure affordance (<details>/<summary>).
    boolean collapsed          = false  start collapsed (implies collapsible); else start open.
    boolean compact            = false  tighter internal padding (--lv-space-3 instead of --lv-space-4).
    boolean divided            = false  a ruled border-top between the header and the body.
    String variant             = "default"  "default" | "outlined" | "elevated" | "ghost".
    String cssClass            = ""     extra utility classes on the root.
    String attrs               = ""     TRUSTED raw ($unsafe) -- STATIC author-typed strings only.
    Map<String,String> dataAttrs = {}   SAFE escaped dynamic data-* (value via Escape.htmlAttribute).

  Usage:
    @@template.lievit.section(heading = "Anagrafica", content = @@`<p>...</p>`)
    @@template.lievit.section(heading = "Note", collapsible = true, collapsed = true,
      description = @@`Optional`, content = @@`<p>...</p>`)
    @@template.lievit.section(heading = "Riepilogo", divided = true, compact = true,
      content = @@`<dl>...</dl>`)
    @@template.lievit.section(heading = "Dettagli", aside = @@`<p>Sidebar content</p>`,
      content = @@`<p>Main content</p>`)
    @@template.lievit.section(variant = "elevated", heading = "Highlights",
      content = @@`<p>Elevated surface.</p>`)
--%>
@param String heading = null
@param String headingId = "lv-section-heading"
@param gg.jte.Content description = null
@param gg.jte.Content content
@param gg.jte.Content aside = null
@param boolean collapsible = false
@param boolean collapsed = false
@param boolean compact = false
@param boolean divided = false
@param String variant = "default"
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

!{var hasTitle = heading != null && !heading.isBlank();}
!{var pad = compact ? "var(--lv-space-3)" : "var(--lv-space-4)";}
!{var asExpander = collapsible && aside == null;}
!{var startOpen = !collapsed;}

<%-- Variant -> bg + border + shadow (same intent vocabulary as card.jte). --%>
!{var variantBg = switch (variant) {
    case "outlined" -> "transparent";
    case "elevated" -> "var(--lv-color-popover)";
    case "ghost"    -> "transparent";
    default         -> "var(--lv-color-card)";
  };}
!{var variantBorder = switch (variant) {
    case "ghost"    -> "none";
    case "elevated" -> "none";
    case "outlined" -> "1px solid var(--lv-color-border)";
    default         -> "1px solid var(--lv-color-border)";
  };}
!{var variantShadow = switch (variant) {
    case "elevated" -> "var(--lv-shadow-md)";
    case "ghost"    -> "none";
    default         -> "var(--lv-shadow-xs)";
  };}

<%-- Shared surface style string (used on both <details> and <section> roots). --%>
!{var surfaceStyle = "background:" + variantBg + ";color:var(--lv-color-card-fg);border:" + variantBorder + ";box-shadow:" + variantShadow + ";border-radius:var(--lv-radius-lg);overflow:hidden;font-family:var(--lv-font-sans);";}
!{var headerStyle = "display:flex;align-items:flex-start;justify-content:space-between;gap:var(--lv-space-3);padding:" + pad + ";";}
!{var contentBorderTop = divided ? "border-top:1px solid var(--lv-color-border);" : "";}
!{var contentStyle = "padding:" + pad + ";" + contentBorderTop;}

<%-- SAFE dynamic data-* attributes (mirrors card.jte / badge.jte pattern). --%>
!{var _da = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      _da.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), _da);
      _da.writeContent("\"");
    }
  }}
!{var _daMarkup = _da.toString();}

@if(asExpander)
  <details
    data-slot="section"
    data-variant="${variant}"
    open="${startOpen}"
    aria-labelledby="${hasTitle ? headingId : null}"
    class="${cssClass}"
    style="${surfaceStyle}"
    $unsafe{_daMarkup}
    $unsafe{attrs}
  >
    <summary
      data-slot="section-header"
      class="lv-section-summary"
      style="${headerStyle}list-style:none;cursor:pointer;"
    >
      <span style="display:grid;gap:var(--lv-space-1);">
        @if(hasTitle)
          <span data-slot="section-title" id="${headingId}"
            style="font-size:var(--lv-text-lg);font-weight:var(--lv-font-medium);line-height:var(--lv-leading-none);"
          >${heading}</span>
        @endif
        @if(description != null)
          <span data-slot="section-description"
            style="font-size:var(--lv-text-sm);color:var(--lv-color-muted-fg);"
          >${description}</span>
        @endif
      </span>
      <span aria-hidden="true" class="lv-section-chevron"
        style="flex-shrink:0;display:inline-flex;color:var(--lv-color-muted-fg);transition:transform var(--lv-duration-fast) var(--lv-ease);"
      >@template.lievit.icon(name = "chevron-down", size = "1rem")</span>
    </summary>
    <div data-slot="section-content" style="${contentStyle}">${content}</div>
  </details>
@else
  <section
    data-slot="section"
    data-variant="${variant}"
    aria-labelledby="${hasTitle ? headingId : null}"
    class="${cssClass}"
    style="${surfaceStyle}${aside != null ? "display:grid;grid-template-columns:minmax(12rem,1fr) 2fr;" : ""}"
    $unsafe{_daMarkup}
    $unsafe{attrs}
  >
    @if(hasTitle || description != null || aside != null)
      <div data-slot="section-header" style="${headerStyle}">
        <span style="display:grid;gap:var(--lv-space-1);">
          @if(hasTitle)
            <span data-slot="section-title" id="${headingId}"
              style="font-size:var(--lv-text-lg);font-weight:var(--lv-font-medium);line-height:var(--lv-leading-none);"
            >${heading}</span>
          @endif
          @if(description != null)
            <span data-slot="section-description"
              style="font-size:var(--lv-text-sm);color:var(--lv-color-muted-fg);"
            >${description}</span>
          @endif
          @if(aside != null)${aside}@endif
        </span>
      </div>
    @endif
    <div data-slot="section-content" style="${contentStyle}">${content}</div>
  </section>
@endif
