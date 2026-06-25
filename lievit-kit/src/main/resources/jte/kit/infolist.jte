@import java.util.Map
@import dev.lievit.kit.AdminViewView
@import dev.lievit.kit.schema.infolist.ResolvedNode
@import dev.lievit.kit.page.KitInfolistView
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.infolist - the canonical Filament VIEW (detail) chrome, rendered from a
  KitInfolistView onto the lievit-ui section / tabs / description-list / infolist-entry partials. The
  read-only counterpart of kit.table: where the table renders a list of records, this renders ONE
  record's resolved infolist (the Filament ViewRecord, full-page mode). It follows the SAME pattern as
  kit.table.jte (the kit's reference render template): a typed render bundle, a header bar of actions,
  a body that composes lievit-ui primitives, strict-CSP clean (every control a real <a href>; no
  inline <script>/on*).

  The pieces, server-first:
    1  header heading + header-actions toolbar  -> button partial, real <a href> per HeaderAction
    2  the resolved infolist BODY               -> the ResolvedNode tree (sections / tabs / fieldset /
                                                   grid / key-value / typed-entry leaves), walked by
                                                   kit.infolist.node; or the flat sections fallback
                                                   (a description-list per AdminViewView.Section) when
                                                   the bundle carries no structured tree

  The view-model is AdminViewView (heading + recordId + sections + header actions + the structured
  tree); KitInfolistView wraps it with the render-time back href. The page prefers the structured
  tree() (nested layout + typed entries reached) and falls back to the flat sections() (a simple
  label->value list) so a host that built a view-model without a tree still renders.

  Params:
    infolist  - the KitInfolistView render bundle (the AdminViewView + render-time back href).
--%>
@param KitInfolistView infolist
!{AdminViewView view = infolist.view();}
<div data-slot="kit-infolist" data-admin-view class="w-full" style="display: flex; flex-direction: column; gap: var(--lv-space-6); font-family:var(--lv-font-sans);">

  <%-- 1. Header bar: heading + the resource-scoped header actions (Filament ViewRecord toolbar). --%>
  <div data-slot="kit-infolist-header" class="flex items-center justify-between gap-[var(--lv-space-2)]">
    <h1 data-admin-heading class="text-[length:var(--lv-text-xl)] font-[var(--lv-font-semibold)] text-[var(--lv-color-fg)]">${view.heading()}</h1>
    <div data-admin-toolbar class="flex items-center gap-[var(--lv-space-2)]">
      @for(AdminViewView.HeaderAction action : view.headerActions())
        @template.lievit.button(variant = action.variant(), size = "sm", href = action.url(),
          dataAttrs = java.util.Map.of("admin-view-action", action.label()),
          content = @`${action.label()}`)
      @endfor
      @if(!view.hasHeaderActions() && infolist.hasBackHref())
        @template.lievit.button(variant = "secondary", size = "sm", href = infolist.backHref(),
          dataAttrs = java.util.Map.of("admin-view-action", "Back"), content = @`Back`)
      @endif
    </div>
  </div>

  <%-- 2. The body: the structured resolved tree (preferred), else the flat sections fallback. --%>
  <div data-slot="kit-infolist-body" style="display: flex; flex-direction: column; gap: var(--lv-space-6);">
    @if(view.hasTree())
      @for(ResolvedNode node : view.tree())
        @template.kit.infolist.node(node = node)
      @endfor
    @else
      @for(AdminViewView.Section section : view.sections())
        @if(section.hasHeading())
          @template.lievit.section(heading = section.heading(),
            headingId = "lv-section-" + section.heading().hashCode(),
            content = @`
              @template.lievit.description-list(columns = section.columns(), content = @`
                @for(Map.Entry<String, String> entry : section.entries().entrySet())
                  @template.lievit.description-list.item(term = entry.getKey(), content = @`${entry.getValue()}`)
                @endfor
              `)
            `)
        @else
          @template.lievit.description-list(columns = section.columns(), content = @`
            @for(Map.Entry<String, String> entry : section.entries().entrySet())
              @template.lievit.description-list.item(term = entry.getKey(), content = @`${entry.getValue()}`)
            @endfor
          `)
        @endif
      @endfor
    @endif
  </div>
</div>
