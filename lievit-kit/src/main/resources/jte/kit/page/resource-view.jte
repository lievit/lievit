@import dev.lievit.kit.AdminViewView
@import dev.lievit.kit.GlobalSearchResults
@import dev.lievit.kit.page.KitInfolistView
@import dev.lievit.kit.page.KitPageView
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.page.resource-view - the Filament resource VIEW (detail) PAGE (ViewRecord): the
  panel SHELL (kit/page.jte) wrapping the canonical infolist chrome. The page is shell + body: this
  template owns only the shell wrapping; the detail body (heading + header actions + the resolved
  infolist) is composed from the dedicated infolist builder (kit/infolist.jte), which walks the
  AdminViewView's structured tree (sections / tabs / fieldset / grid / key-value / typed entries) and
  falls back to the flat label->value sections when the bundle carries no tree.

  HISTORY (the Phase-2 reconcile): this page used to render the sections INLINE (its own section +
  infolist-grid loop, via the now-removed kit/page/infolist-grid.jte) because it was built before the
  dedicated infolist builder existed. It now COMPOSES kit/infolist.jte so there is ONE place that
  renders a Filament detail view (the kit-render pattern, twin of resource-list -> kit/table). The
  infolist builder paints its own heading + header-action toolbar, so the page shell does NOT also
  pass headerActions (that would double the toolbar).

  Params:
    page    - the KitPageView panel-chrome bundle.
    view    - the AdminViewView (heading / sections / structured tree / headerActions).
    searchResults - server-prefetched grouped global-search hits for the topbar; null => GET-only.
--%>
@param KitPageView page
@param AdminViewView view
@param GlobalSearchResults searchResults = null
!{var infolistView = KitInfolistView.of(view);}
@template.kit.page(
  page = page,
  searchResults = searchResults,
  content = @`
    @template.kit.infolist(infolist = infolistView)
  `)
