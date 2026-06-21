@import io.lievit.kit.GlobalSearchResults
@import io.lievit.kit.page.KitPageView
@import io.lievit.kit.page.KitTableView
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.page.resource-list - the Filament resource LIST page (ListRecords): the panel
  shell (kit/page.jte) wrapping the canonical table chrome (kit/table.jte). It is the binding that
  drops the table BODY into the panel chrome so an adopter gets the whole Filament list page from two
  view-models, instead of hand-assembling the shell + the table.

  The page-header's create button (Filament's CreateAction header action) is rendered here as the
  header-actions cluster, and the SAME createUrl is passed to the table (which also renders a create
  button in its own header bar only when no page-header is present; here the page-header owns it, so
  pass "" to the table's createUrl if you do not want it twice -- see the createUrl param).

  Server-first / strict-CSP: inherits the kit/page + kit/table guarantees (real <a href> / <form> /
  native popovers; no inline script). Nothing new is introduced here, it only composes the two.

  Params:
    page          - the KitPageView panel-chrome bundle.
    table         - the KitTableView table render bundle (heading / rows / pagination / controls).
    createUrl     - the "New" create href shown in the page-header actions; "" hides it.
    tableCreateUrl - the createUrl passed to the table's own header bar; default "" (the page-header
                     owns the create button, so the table does not duplicate it).
    columnManager - the table's column-visibility items slot; null hides the column manager.
    searchResults - server-prefetched grouped global-search hits for the topbar; null => GET-only.
--%>
@param KitPageView page
@param KitTableView table
@param String createUrl = ""
@param String tableCreateUrl = ""
@param gg.jte.Content columnManager = null
@param GlobalSearchResults searchResults = null
@template.kit.page(
  page = page,
  searchResults = searchResults,
  headerActions = (createUrl != null && !createUrl.isBlank()) ? @`
    @template.lievit.button(variant = "primary", size = "sm", href = createUrl,
      dataAttrs = java.util.Map.of("admin-create", "true"), content = @`New`)
  ` : null,
  content = @`
    @template.kit.table(table = table, createUrl = tableCreateUrl, columnManager = columnManager)
  `)
