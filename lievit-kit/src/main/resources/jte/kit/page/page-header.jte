@import dev.lievit.kit.page.KitPageView
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.page.page-header - the Filament page HEADER (fi-header), rendered from a
  KitPageView onto the lievit-ui breadcrumb partial + a heading + a header-actions cluster. The
  Filament components/header/index.blade: a breadcrumb trail, an <h1> heading, an optional muted
  subheading <p>, and a right-aligned header-actions cluster (the page's toolbar buttons).

  This is the in-content page header that sits at the top of every resource page body (list / create /
  edit / view), distinct from the app-shell TOPBAR (brand + global search + user menu + bell), which
  kit/page.jte owns. The Filament panel has BOTH: the sticky topbar chrome and a per-page header.

  Server-first / strict-CSP: the breadcrumb is the lievit-ui breadcrumb partial (real <a href> trail,
  the active crumb a non-link aria-current="page"); the header actions are the body's own real <a> /
  form buttons passed in via the `actions` slot. Nothing inline-scripts.

  WHY the breadcrumb + actions ride a constant <header> root: the JTE static-checker rejects an
  @if/@else opening a DIFFERENT root tag per branch, so the <header> is constant and the optional
  breadcrumb / subheading / actions switch only the INNER content.

  Params:
    page    - the KitPageView render bundle (read .breadcrumb() + .pageTitle() + .subheading()).
    actions - the header-actions cluster content (the body's toolbar buttons); null hides the cluster.
--%>
@param KitPageView page
@param gg.jte.Content actions = null
<header data-slot="kit-page-header" class="mb-[var(--lv-space-6)] flex flex-col gap-[var(--lv-space-3)]" style="font-family:var(--lv-font-sans);">
  @if(page.hasBreadcrumb())
    <div data-slot="kit-page-breadcrumb">
      @template.lievit.breadcrumb(items = page.breadcrumb())
    </div>
  @endif
  <div data-slot="kit-page-heading-row" class="flex flex-wrap items-start justify-between gap-[var(--lv-space-3)]">
    <div data-slot="kit-page-heading" class="min-w-0">
      <h1 class="text-[length:var(--lv-text-2xl)] font-[var(--lv-font-semibold)] tracking-tight text-[var(--lv-color-fg)]">${page.pageTitle()}</h1>
      @if(page.hasSubheading())
        <p data-slot="kit-page-subheading" class="mt-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">${page.subheading()}</p>
      @endif
    </div>
    @if(actions != null)
      <div data-slot="kit-page-actions" class="flex shrink-0 items-center gap-[var(--lv-space-2)]">
        ${actions}
      </div>
    @endif
  </div>
</header>
