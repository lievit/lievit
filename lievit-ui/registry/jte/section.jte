@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui section partial -- a titled, optionally collapsible container that groups fields /
  entries under a heading. The server-first equivalent of shadcn's Card-with-Collapsible and
  Filament's Section (the schema + infolist layout container the kit's SectionView renders).

  TIER (planning two-tier model): STATIC presentational -> JTE partial. Collapse is pure platform:
  a native <details>/<summary> opens + closes itself with ZERO JS, ZERO inline <script>, ZERO
  inline on* handler (strict CSP refuses those) and NO <style> block (kept consistent with the rest
  of the kit). The initial open/closed state is a SERVER fact (the `collapsed` flag the SectionView
  carries), rendered as the <details open> attribute; no client state, no lifecycle => no Lit
  island, no wire component. A NON-collapsible section is a plain <section> + heading (no disclosure
  affordance at all), so the markup degrades to the simplest thing that works.

  STRUCTURE (scientific decision rule -- shadcn Card + Radix Collapsible, Filament Section as the
  feature source):
    - collapsible  => <details data-slot="section"> with a <summary data-slot="section-header">
      carrying the title + description + a trailing chevron; the body is <div data-slot="section-content">.
      The platform exposes aria-expanded on the <summary> for free; Enter/Space toggle it natively.
    - not collapsible => <section data-slot="section"> with a <div data-slot="section-header"> (a
      plain header, no <summary>, no chevron) and the same body.
  The title links the section for assistive tech: the header gets a deterministic id and the
  container an aria-labelledby pointing at it (the same a11y rule card.jte uses).

  Filament Section traits, each a server-pure variant:
    - collapsible / collapsed : the disclosure + its initial state (above).
    - compact                 : tighter padding (the level-4 spacing token instead of level-6).
    - divided                 : a ruled line between the header and the body (border-top on content).
    - aside                   : a two-column layout where the header sits in a side rail beside the
                                content (Filament's `aside()`), via a grid; only meaningful when not
                                collapsed-into-a-summary, so `aside` implies non-collapsible.

  Chevron rotate-on-open: the strict CSP forbids a <style> block, so the open-state chevron rotation
  is opt-in via ONE adopter stylesheet rule keyed off the platform [open] state (the same opt-in
  pattern scroll-area uses for :hover):
      [data-slot="section"][open] .lv-section-chevron { transform: rotate(180deg); }
  Without it the section still opens + closes (the behaviour is intact); only the glyph stays put.

  TOKEN FIDELITY (shadcn card): the surface reads --lv-color-card / --lv-color-card-fg, the border
  --lv-color-border, the radius --lv-radius-xl; a retheme retints the whole surface.

  A11y: a title present => the container is aria-labelledby its header id; the collapsible summary is
  a real disclosure control (aria-expanded native). The description is rendered muted under the title.

  Params:
    String heading             = null   the section title (renders a header when set).
    String headingId           = "lv-section-heading"  id linking aria-labelledby to the title.
    gg.jte.Content description  = null   a muted subtitle under the title.
    gg.jte.Content content              the section body.
    gg.jte.Content aside       = null   a header-rail slot (Filament aside); implies non-collapsible.
    boolean collapsible        = false  render the disclosure affordance (a <details>/<summary>).
    boolean collapsed          = false  start collapsed (implies collapsible); else start open.
    boolean compact            = false  tighter padding.
    boolean divided            = false  a ruled line between header and body.
    String cssClass            = ""     extra utility classes on the section.

  Usage:
    @@template.lievit.section(heading = "Anagrafica", content = @@`<p>...</p>`)
    @@template.lievit.section(heading = "Note", collapsible = true, collapsed = true,
      description = @@`Optional`, content = @@`<p>...</p>`)
    @@template.lievit.section(heading = "Riepilogo", divided = true, compact = true,
      content = @@`<dl>...</dl>`)
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
@param String cssClass = ""

!{var hasTitle = heading != null && !heading.isBlank();}
!{var pad = compact ? "var(--lv-space-4)" : "var(--lv-space-6)";}
!{var asExpander = collapsible && aside == null;}
!{var startOpen = !collapsed;}
!{var surface = "overflow: hidden; border-radius: var(--lv-radius-xl); border: 1px solid var(--lv-color-border); background: var(--lv-color-card); color: var(--lv-color-card-fg); box-shadow: var(--lv-shadow-sm); font-family: var(--lv-font-sans);";}
!{var headerStyle = "display: flex; align-items: flex-start; justify-content: space-between; gap: var(--lv-space-3); padding: " + pad + ";";}
!{var contentStyle = "padding: " + pad + ";" + (divided ? " border-top: 1px solid var(--lv-color-border);" : "") + (hasTitle ? " padding-top: " + (divided ? pad : "var(--lv-space-2)") + ";" : "");}

@if(asExpander)
  <details
    data-slot="section"
    open="${startOpen}"
    aria-labelledby="${hasTitle ? headingId : null}"
    class="${cssClass}"
    style="${surface}"
  >
    <summary
      data-slot="section-header"
      class="lv-section-summary"
      style="${headerStyle} list-style: none; cursor: pointer;"
    >
      <span style="display: grid; gap: var(--lv-space-1);">
        @if(hasTitle)
          <span data-slot="section-title" id="${headingId}" style="font-size: var(--lv-text-lg); font-weight: var(--lv-font-semibold); line-height: var(--lv-leading-none);">${heading}</span>
        @endif
        @if(description != null)
          <span data-slot="section-description" style="font-size: var(--lv-text-sm); color: var(--lv-color-muted-fg);">${description}</span>
        @endif
      </span>
      <span aria-hidden="true" class="lv-section-chevron" style="flex-shrink: 0; display: inline-flex; color: var(--lv-color-muted-fg); transition: transform 0.2s ease;">
        @template.lievit.icon(name = "chevron-down", size = "1rem")
      </span>
    </summary>
    <div data-slot="section-content" style="${contentStyle}">${content}</div>
  </details>
@else
  <section
    data-slot="section"
    aria-labelledby="${hasTitle ? headingId : null}"
    class="${cssClass}"
    style="${surface}${aside != null ? " display: grid; grid-template-columns: minmax(12rem, 1fr) 2fr;" : ""}"
  >
    @if(hasTitle || description != null || aside != null)
      <div data-slot="section-header" style="${headerStyle}">
        <span style="display: grid; gap: var(--lv-space-1);">
          @if(hasTitle)
            <span data-slot="section-title" id="${headingId}" style="font-size: var(--lv-text-lg); font-weight: var(--lv-font-semibold); line-height: var(--lv-leading-none);">${heading}</span>
          @endif
          @if(description != null)
            <span data-slot="section-description" style="font-size: var(--lv-text-sm); color: var(--lv-color-muted-fg);">${description}</span>
          @endif
          @if(aside != null)${aside}@endif
        </span>
      </div>
    @endif
    <div data-slot="section-content" style="${contentStyle}">${content}</div>
  </section>
@endif
