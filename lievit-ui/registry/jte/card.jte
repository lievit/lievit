@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui card partial -- a surface container with the full shadcn slot set.

  TIER: STATIC presentational -> JTE partial. The former <lv-card> island generated a header
  id at runtime only to wire aria-labelledby; the server can mint that id deterministically
  from the caller's `headingId`, so no client is needed.

  STRUCTURE (scientific decision rule): shadcn's Card is a composition of distinct slots --
  Card / CardHeader / CardTitle / CardDescription / CardAction / CardContent / CardFooter. In
  JTE that maps to ONE partial with a Content slot per region (the server-first equivalent of
  the named sub-components): `title` + `description` + `action` compose the header, `content`
  is the body, `footer` is the optional bottom region. The header region renders when any of
  title / description / action is supplied; the footer when `footer` is supplied. The elevation
  reads --lv-shadow-sm; border + radius read tokens too, so a theme retints the whole surface.

  TOKEN FIDELITY (shadcn): the surface reads --lv-color-card / --lv-color-card-fg (NOT the page
  bg/fg) so a card tints distinctly from the page; radius is --lv-radius-xl (shadcn rounded-xl).
  shadcn's card is BORDERLESS between sections: one flex column with a uniform gap + vertical
  padding (the level-6 spacing token) and the same horizontal padding per region, no ruled
  header/footer.

  Back-compat: the original `heading` String still renders a plain text title; when both
  `heading` and a rich `title` slot are given, the slot wins (content-over-scalar precedence,
  the same rule badge.jte / kbd.jte use).

  A11y (WAI-ARIA region): a title (slot or heading) present => role="region" + aria-labelledby
  pointing at the title id, so assistive tech announces the section by its title; no title =>
  no landmark (a bare surface). The CardAction sits in the header beside the title (shadcn pins
  it to the header's end), so the section's primary control is announced within the labelled region.

  Params:
    gg.jte.Content title       = null  rich card title; wins over `heading` when both are set.
    String heading             = null  plain-text title (back-compat); renders a header when set.
    String headingId           = "lv-card-heading"  id linking aria-labelledby to the title.
    gg.jte.Content description = null  a muted subtitle under the title (CardDescription).
    gg.jte.Content action      = null  a control pinned to the header end (CardAction).
    gg.jte.Content content             the card body (CardContent).
    gg.jte.Content footer      = null  an optional bottom region (CardFooter).
    String cssClass            = ""    extra utility classes on the card.

  Usage:
    @@template.lievit.card(content = @@`<p>Plain surface.</p>`)
    @@template.lievit.card(heading = "Listings", headingId = "listings-card", content = @@`<p>...</p>`)
    @@template.lievit.card(
      title = @@`Team plan`,
      description = @@`Billed monthly`,
      action = @@`<button type="button">Upgrade</button>`,
      content = @@`<p>2 of 5 seats used.</p>`,
      footer = @@`<small>Renews 1 Jul</small>`)
--%>
@param gg.jte.Content title = null
@param String heading = null
@param String headingId = "lv-card-heading"
@param gg.jte.Content description = null
@param gg.jte.Content action = null
@param gg.jte.Content content
@param gg.jte.Content footer = null
@param String cssClass = ""

!{var hasTitle = title != null || (heading != null && !heading.isBlank());}
!{var hasHeader = hasTitle || description != null || action != null;}

<div
  data-slot="card"
  role="${hasTitle ? "region" : null}"
  aria-labelledby="${hasTitle ? headingId : null}"
  class="flex flex-col gap-[var(--lv-space-6)] overflow-hidden rounded-[var(--lv-radius-xl)] border border-[var(--lv-color-border)] bg-[var(--lv-color-card)] py-[var(--lv-space-6)] text-[var(--lv-color-card-fg)] shadow-[var(--lv-shadow-sm)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(hasHeader)
    <div data-slot="card-header" class="grid items-start gap-[var(--lv-space-1)] px-[var(--lv-space-6)]" style="grid-template-columns: 1fr auto;">
      <div class="grid gap-[var(--lv-space-1)]" style="grid-column: 1;">
        @if(hasTitle)
          <div data-slot="card-title" id="${headingId}" class="text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)] leading-none">@if(title != null)${title}@else${heading}@endif</div>
        @endif
        @if(description != null)
          <div data-slot="card-description" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">${description}</div>
        @endif
      </div>
      @if(action != null)
        <div data-slot="card-action" class="self-start justify-self-end" style="grid-column: 2; grid-row: 1;">${action}</div>
      @endif
    </div>
  @endif
  <div data-slot="card-content" class="px-[var(--lv-space-6)] text-[length:var(--lv-text-base)]">
    ${content}
  </div>
  @if(footer != null)
    <div data-slot="card-footer" class="flex items-center px-[var(--lv-space-6)] text-[length:var(--lv-text-sm)]">${footer}</div>
  @endif
</div>
