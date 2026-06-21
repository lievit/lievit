@import java.util.Map
@import io.lievit.kit.AdminViewView
@import io.lievit.kit.GlobalSearchResults
@import io.lievit.kit.page.KitPageView
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.page.resource-view - the Filament resource VIEW (detail) page (ViewRecord): the
  panel shell (kit/page.jte) wrapping a server-rendered infolist that binds an AdminViewView. The
  resolved sections (each an ordered label->value grid in N columns) render onto the lievit-ui section
  + infolist-entry partials; the View page's header actions (Edit / back) render in the page-header.

  Each AdminViewView.Section is an optional heading + an ordered label->display map + a column count
  (the placeholder already applied to empties by the view-model). A section with a heading renders as
  a lievit-ui section; an unnamed (flat) section renders the bare grid. The entry value is the
  resolved STRING (the view-model paints already-projected strings; the silent-slot lesson), rendered
  through the infolist-entry text type.

  Server-first / strict-CSP: pure server-rendered markup (real <a href> header actions, no script).

  KNOWN MODEL GAP (backflow): AdminViewView.Section is a flat label->String map; the schema/infolist
  package models richer entries (Badge / Color / Icon / Image / KeyValue / Code). When the view-model
  projects an entry TYPE per cell, this template's infolist-entry call switches on it; today every
  entry is text.

  Params:
    page    - the KitPageView panel-chrome bundle.
    view    - the AdminViewView (heading / sections / headerActions).
    searchResults - server-prefetched grouped global-search hits for the topbar; null => GET-only.
--%>
@param KitPageView page
@param AdminViewView view
@param GlobalSearchResults searchResults = null
@template.kit.page(
  page = page,
  searchResults = searchResults,
  headerActions = view.hasHeaderActions() ? @`
    @for(AdminViewView.HeaderAction action : view.headerActions())
      @template.lievit.button(variant = "primary".equals(action.variant()) ? "primary" : "secondary",
        size = "sm", href = action.url(), content = @`${action.label()}`)
    @endfor
  ` : null,
  content = @`
    <div data-slot="kit-resource-view" class="flex flex-col gap-[var(--lv-space-6)]" style="font-family:var(--lv-font-sans);">
      @for(AdminViewView.Section section : view.sections())
        @if(section.hasHeading())
          @template.lievit.section(heading = section.heading(), content = @`
            @template.kit.page.infolist-grid(entries = section.entries(), columns = section.columns())
          `)
        @else
          <div data-slot="kit-resource-view-flat">
            @template.kit.page.infolist-grid(entries = section.entries(), columns = section.columns())
          </div>
        @endif
      @endfor
    </div>
  `)
