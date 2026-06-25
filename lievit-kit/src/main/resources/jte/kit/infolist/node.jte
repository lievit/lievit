@import java.util.List
@import java.util.Collections
@import dev.lievit.kit.schema.infolist.ResolvedNode
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.infolist.node - renders ONE resolved infolist node, recursing into its children,
  composing the real lievit-ui detail primitives (section / tabs / description-list / infolist-entry).
  The production counterpart of the test scaffold lievit/infolist-node.jte: same tree-walk over the
  sealed ResolvedNode permit set, but each branch REUSES a lievit-ui partial instead of raw markers,
  exactly as kit.table.rich-cell reuses the lievit-ui primitives.

  The closed set of node kinds maps 1:1 to a branch:
    SectionNode  -> lievit.section (titled, optional description/collapsible) wrapping the children
    TabsNode     -> lievit.tabs static strip + one lievit.tabs-panel per tab, wrapping each tab's
                    children (server-first, the active tab is a SERVER fact; no wire needed)
    FieldsetNode -> a <fieldset> legend group wrapping the children
    GridNode     -> a bare columns container wrapping the children
    KeyValue     -> a small two-column key-value table (the resolveMap output)
    Field        -> a single label->value pair, the value dispatched by kind via kit.infolist.entry

  CONTAINER LAYOUT (the <dl> validity rule): a <dl> may only hold <dt>/<dd> pairs, so a container's
  DIRECT leaf children (Field + KeyValue) are grouped into ONE description-list (the N-column grid),
  while nested CONTAINER children (Section/Tabs/Fieldset/Grid) render as their own blocks outside the
  list. kit.infolist.children does that split, so the dt/dd association stays native and nested layout
  stays valid. A container with only leaves degrades to a single description-list.

  JTE static-checker safe: every branch's ROOT delegates to a partial (lievit.section / lievit.tabs)
  or opens a constant root tag (<fieldset> / <div>) for the whole branch; no @if/@else opens a
  different root tag for the SAME logical element.

  Params:
    node - the resolved node to render.
--%>
@param ResolvedNode node
@if(node instanceof ResolvedNode.SectionNode s)
    @template.lievit.section(
        heading = s.hasHeading() ? s.heading() : null,
        headingId = "lv-section-" + (s.hasHeading() ? s.heading().hashCode() : 0),
        description = s.description() == null ? null : @`${s.description()}`,
        collapsible = s.collapsible(),
        collapsed = s.collapsed(),
        cssClass = "lv-infolist-section",
        content = @`@template.kit.infolist.children(children = s.children(), columns = s.columns())`)
@elseif(node instanceof ResolvedNode.TabsNode t)
    <%--
      v-next migration: tabs removed the content= Content slot and tabs.panel sub-template.
      Panels are now authored as sibling markup AFTER the @template.lievit.tabs() call.
      Panel ids are derived deterministically as "panel-{tabsId}-{tabId}".
      The tabsId must be unique per page; use the hashCode of the TabsNode as a stable suffix.
      hrefs= is no longer a param; tab activation is wire-based (selectAction) or server round-trip.
    --%>
    !{var tabIds = new java.util.ArrayList<String>();}
    !{var tabLabels = new java.util.ArrayList<String>();}
    !{String tabsId = "lv-infolist-tabs-" + Math.abs(t.hashCode());}
    @for(ResolvedNode.TabNode tab : t.tabs())
        !{tabIds.add(tab.id());}
        !{tabLabels.add(tab.label());}
    @endfor
    <div data-slot="lv-infolist-tabs-wrapper">
    @template.lievit.tabs(
        tabsId = tabsId,
        tabIds = tabIds,
        tabLabels = tabLabels,
        activeTab = t.activeTabId(),
        cssClass = "lv-infolist-tabs")
    <%-- Tab panels: rendered outside the tabs() call; ids must match panel-{tabsId}-{tabId}. --%>
    @for(ResolvedNode.TabNode tab : t.tabs())
        !{boolean _tabActive = tab.id().equals(t.activeTabId());}
        <div
            role="tabpanel"
            id="panel-${tabsId}-${tab.id()}"
            aria-labelledby="tab-${tabsId}-${tab.id()}"
            tabindex="0"
            hidden="${!_tabActive}"
            data-slot="tabs-panel"
        >
            @template.kit.infolist.children(children = tab.children(), columns = tab.columns())
        </div>
    @endfor
    </div>
@elseif(node instanceof ResolvedNode.FieldsetNode f)
    <fieldset
        data-slot="infolist-fieldset"
        style="grid-column: span ${f.columnSpan()}; margin: 0; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-lg); padding: var(--lv-space-4); font-family: var(--lv-font-sans);"
    >
        <legend data-slot="infolist-fieldset-legend" style="padding: 0 var(--lv-space-2); font-size: var(--lv-text-sm); font-weight: var(--lv-font-medium); color: var(--lv-color-muted-fg);">${f.label()}</legend>
        @template.kit.infolist.children(children = f.children(), columns = f.columns())
    </fieldset>
@elseif(node instanceof ResolvedNode.GridNode g)
    <div data-slot="infolist-grid" style="grid-column: span ${g.columnSpan()};">
        @template.kit.infolist.children(children = g.children(), columns = g.columns())
    </div>
@elseif(node instanceof ResolvedNode.KeyValue kv)
    @template.kit.infolist.keyvalue(kv = kv)
@elseif(node instanceof ResolvedNode.Field fld)
    @template.lievit.description-list(columns = 1, content = @`
        @template.lievit.description-list.item(term = fld.label(), columnSpan = fld.columnSpan(),
            content = @`@template.kit.infolist.entry(field = fld)`)
    `)
@endif
