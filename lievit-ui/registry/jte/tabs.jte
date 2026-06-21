@import gg.jte.Content
@import java.util.List
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui tabs partial -- a role="tablist" strip + its panels, the server-first, zero-JS
  counterpart of shadcn's Tabs (Radix Tabs a11y) and Filament's Tabs / schema Tabs (the layout
  container the kit's Tabs + InfolistTabs render through).

  TIER (planning two-tier model): STATIC presentational -> JTE partial. The active tab is a SERVER
  fact: each tab is a real <a href> (the canonical server-first switch, the same URL-driven pattern
  data-table.jte uses for re-sort links), so changing tab is a GET that re-requests the page with the
  new active id -- it works fully JS-off, ZERO inline <script>, ZERO inline on* handler (strict CSP
  refuses those), NO <style> block. The active tab gets aria-selected + tabindex="0"; the others
  aria-selected="false" + tabindex="-1" (the WAI-ARIA roving-tabindex). The active panel shows; the
  inactive panels carry the boolean `hidden` (removed from view + a11y tree). No client state, no
  lifecycle => no Lit island, no wire component. (The INTERACTIVE tabs whose active id is live server
  state lives in registry/wire/tabs as a wire component; this is the layout primitive.)

  STRUCTURE (scientific decision rule -- shadcn Tabs + Radix, WAI-ARIA APG Tabs): the parent is
  data-slot="tabs"; the strip is <div role="tablist" data-slot="tabs-list"> of <a role="tab"
  data-slot="tabs-trigger" aria-selected aria-controls> links; each panel is rendered by the
  tabs-panel sub-part (<div role="tabpanel" data-slot="tabs-content" aria-labelledby hidden?>). The
  triggers come from the parallel `tabIds` / `labels` / `hrefs` lists; the panels are a Content slot
  the CALLER composes (one @template.lievit.tabs-panel per tab). Native <a> links + hidden panels
  beat a JS measure: cannot fail to project, CSP-clean.

  variant: "default" (a bottom-border underline strip, Filament's contained-less tabs) the only
  shipped variant; the trigger reads aria-selected for its active tint, so a retheme retints it.

  A11y (WAI-ARIA APG Tabs): tablist > tab[aria-selected][aria-controls] + tabpanel[aria-labelledby];
  inactive panels `hidden`; roving tabindex on the tabs (active = 0, others = -1). Arrow-key roving
  between tabs was a client nicety; the <a> links are Tab-reachable and each is a real navigation,
  so the keyboard reaches every tab without a handler.

  Params (parent):
    List<String> tabIds           tab ids in render order; each pairs a tabs-panel by id.
    List<String> labels           tab labels, index-aligned with tabIds.
    List<String> hrefs            tab hrefs, index-aligned (the GET that activates each tab).
    String active                 the active tab id (server-owned).
    gg.jte.Content content        the panels (compose with @template.lievit.tabs-panel).
    String cssClass = ""          extra utility classes on the parent.

  Usage:
    @@template.lievit.tabs(
      tabIds = java.util.List.of("info", "docs"),
      labels = java.util.List.of("Anagrafica", "Documenti"),
      hrefs  = java.util.List.of("?tab=info", "?tab=docs"),
      active = "info",
      content = @@`
        @@template.lievit.tabs-panel(id = "info", active = "info", content = @@`<p>...</p>`)
        @@template.lievit.tabs-panel(id = "docs", active = "info", content = @@`<p>...</p>`)
      `)
--%>
@param List<String> tabIds
@param List<String> labels
@param List<String> hrefs
@param String active
@param gg.jte.Content content
@param String cssClass = ""

<div data-slot="tabs" class="${cssClass}" style="display: flex; flex-direction: column; gap: var(--lv-space-4); font-family: var(--lv-font-sans);">
  <div role="tablist" data-slot="tabs-list" style="display: flex; gap: var(--lv-space-1); overflow-x: auto; border-bottom: 1px solid var(--lv-color-border);">
    @for(int i = 0; i < tabIds.size(); i++)
      !{var id = tabIds.get(i);}
      !{var label = i < labels.size() ? labels.get(i) : id;}
      !{var href = i < hrefs.size() ? hrefs.get(i) : "#";}
      !{var isActive = id.equals(active);}
      <a
        role="tab"
        data-slot="tabs-trigger"
        href="${href}"
        id="lv-tab-${id}"
        aria-selected="${isActive ? "true" : "false"}"
        aria-controls="lv-tabpanel-${id}"
        tabindex="${isActive ? "0" : "-1"}"
        style="display: inline-flex; align-items: center; gap: var(--lv-space-2); padding: var(--lv-space-2) var(--lv-space-3); font-size: var(--lv-text-sm); font-weight: var(--lv-font-medium); text-decoration: none; white-space: nowrap; cursor: pointer; color: ${isActive ? "var(--lv-color-fg)" : "var(--lv-color-muted-fg)"}; border-bottom: 2px solid ${isActive ? "var(--lv-color-primary)" : "transparent"}; margin-bottom: -1px;"
      >${label}</a>
    @endfor
  </div>
  ${content}
</div>
