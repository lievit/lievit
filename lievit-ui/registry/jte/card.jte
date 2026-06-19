@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui card partial -- a surface container with an optional labelled header.

  TIER: STATIC presentational -> JTE partial. The former <lv-card> island generated a header
  id at runtime only to wire aria-labelledby; the server can mint that id deterministically
  from the caller's `headingId`, so no client is needed.

  STRUCTURE (scientific decision rule): shadcn's Card (elevated surface + optional header +
  body) maps cleanly to a div with a header region and a content slot. The elevation reads the
  --lv-shadow-sm token; border + radius read tokens too, so a theme retints the whole surface.
  When a heading is present the card becomes a labelled landmark (role="region" +
  aria-labelledby) per WAI-ARIA, so assistive tech announces the section by its title; with no
  heading the card is presentational only.

  A11y (WAI-ARIA region): heading present => role="region" + aria-labelledby pointing at the
  header id; no heading => no landmark (a bare surface).

  Params:
    String heading         = null      optional card title; renders a header region when set.
    String headingId       = "lv-card-heading"  id linking aria-labelledby to the header.
    gg.jte.Content content             the card body.
    String cssClass        = ""        extra utility classes on the card.

  Usage:
    @@template.card(content = @@`<p>Plain surface.</p>`)
    @@template.card(heading = "Listings", headingId = "listings-card", content = @@`<p>...</p>`)
--%>
@param String heading = null
@param String headingId = "lv-card-heading"
@param gg.jte.Content content
@param String cssClass = ""

!{var hasHeading = heading != null && !heading.isBlank();}

<div
  data-slot="card"
  role="${hasHeading ? "region" : null}"
  aria-labelledby="${hasHeading ? headingId : null}"
  class="block overflow-hidden rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-sm)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(hasHeading)
    <div data-slot="card-header" id="${headingId}" class="border-b border-[var(--lv-color-border)] p-[var(--lv-space-4)] text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)]">${heading}</div>
  @endif
  <div data-slot="card-body" class="p-[var(--lv-space-4)] text-[length:var(--lv-text-base)]">
    ${content}
  </div>
</div>
