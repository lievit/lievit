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
  padding and the same horizontal padding per region, no ruled header/footer.

  PADDING (the `pad` knob -- the de-opinionation decision). shadcn's card hardcodes the level-6
  spacing token for the gap, the vertical padding, and every region's horizontal padding. That
  is too opinionated for a tight content panel (the bug this fixes: adopters forked the partial
  to get a denser card). `pad` scales ALL of it off ONE token per level, so a theme-consistent
  card can be compact or roomy without a fork:
    none -> no gap, no vertical padding, no per-region horizontal padding (the caller owns spacing)
    sm   -> var(--lv-space-3)  (12px)  compact / tight content panel
    md   -> var(--lv-space-6)  (24px)  THE default, the shadcn level-6 baseline
    lg   -> var(--lv-space-8)  (32px)  roomy
  The gap, the surface py, and every region px all read the SAME chosen token, so the card stays
  internally consistent at any density.

  HEADER + DIVIDER (the `divided` knob). The header is already OPTIONAL: it renders only when a
  title / description / action is supplied, and a card with none is a bare surface (no forced
  header, no forced divider -- shadcn is borderless between sections). `divided=true` opts INTO a
  thin ruled separator under the header and above the footer (the --lv-color-border token), for
  the cards that want the ruled look; default false keeps the borderless shadcn card.

  Back-compat: the original `heading` String still renders a plain text title; when both
  `heading` and a rich `title` slot are given, the slot wins (content-over-scalar precedence,
  the same rule badge.jte / kbd.jte use). pad defaults to md (the old fixed level-6 spacing) and
  divided defaults to false (the old borderless card), so an existing call renders unchanged.

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
    String pad                 = "md"  "none" | "sm" | "md" | "lg" -- the spacing density (gap +
                                       surface py + per-region px), all off one token. md = shadcn.
    boolean divided            = false  opt into a ruled separator under the header / above the footer.
    String cssClass            = ""    extra utility classes on the card.

  Usage:
    @@template.lievit.card(content = @@`<p>Plain surface.</p>`)
    @@template.lievit.card(heading = "Listings", headingId = "listings-card", content = @@`<p>...</p>`)
    @@template.lievit.card(pad = "sm", content = @@`<p>A tight content panel.</p>`)
    @@template.lievit.card(
      title = @@`Team plan`,
      description = @@`Billed monthly`,
      action = @@`<button type="button">Upgrade</button>`,
      divided = true,
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
@param String pad = "md"
@param boolean divided = false
@param String cssClass = ""

!{var hasTitle = title != null || (heading != null && !heading.isBlank());}
!{var hasHeader = hasTitle || description != null || action != null;}

<%-- ONE spacing token drives gap + surface py + every region px, so the card stays internally
     consistent at any density; "none" lets the caller own all spacing. md is the shadcn level-6
     baseline (back-compat). Each level resolves to the FULL utility (the token sits inside var())
     so a theme reads the var, not a bare scale number. --%>
!{var gapClass = switch (pad) {
    case "none" -> "gap-0";
    case "sm"   -> "gap-[var(--lv-space-3)]";
    case "lg"   -> "gap-[var(--lv-space-8)]";
    default     -> "gap-[var(--lv-space-6)]";
  };}
!{var surfacePyCls = switch (pad) {
    case "none" -> "py-0";
    case "sm"   -> "py-[var(--lv-space-3)]";
    case "lg"   -> "py-[var(--lv-space-8)]";
    default     -> "py-[var(--lv-space-6)]";
  };}
!{var regionPxCls = switch (pad) {
    case "none" -> "px-0";
    case "sm"   -> "px-[var(--lv-space-3)]";
    case "lg"   -> "px-[var(--lv-space-8)]";
    default     -> "px-[var(--lv-space-6)]";
  };}
<%-- the ruled separator (divided=true) reads the border token, like separator.jte; pb/pt add a
     little breathing room under/over the rule when there is region padding. --%>
!{var headerDivCls = divided ? " border-b border-[var(--lv-color-border)] pb-[var(--lv-space-6)]" : "";}
!{var footerDivCls = divided ? " border-t border-[var(--lv-color-border)] pt-[var(--lv-space-6)]" : "";}

<div
  data-slot="card"
  role="${hasTitle ? "region" : null}"
  aria-labelledby="${hasTitle ? headingId : null}"
  class="flex flex-col ${gapClass} overflow-hidden rounded-[var(--lv-radius-xl)] border border-[var(--lv-color-border)] bg-[var(--lv-color-card)] ${surfacePyCls} text-[var(--lv-color-card-fg)] shadow-[var(--lv-shadow-sm)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(hasHeader)
    <div data-slot="card-header" class="grid items-start gap-[var(--lv-space-1)] ${regionPxCls}${headerDivCls}" style="grid-template-columns: 1fr auto;">
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
  <div data-slot="card-content" class="${regionPxCls} text-[length:var(--lv-text-base)]">
    ${content}
  </div>
  @if(footer != null)
    <div data-slot="card-footer" class="flex items-center ${regionPxCls}${footerDivCls} text-[length:var(--lv-text-sm)]">${footer}</div>
  @endif
</div>
