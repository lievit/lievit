@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui sidebar/inset partial -- the <main> content area that sits beside the sidebar
  (shadcn Sidebar SidebarInset). It is the page body the sidebar docks next to; it is REQUIRED
  for the `inset` variant, where shadcn floats the main content as an inset card (margin +
  rounded corners + shadow) against the sidebar surface.

  TIER: STATIC presentational -> JTE partial. A plain <main> landmark wrapper; no state, no JS.
  The inset variant's visual treatment (the floating card) is applied by the enhancer's injected
  CSS keyed on the root's data-variant, so this partial stays pure markup. Pair it with the
  sidebar root rendered with variant = "inset" and lay them out side by side in a flex row, e.g.
    <div style="display:flex; min-height:100vh;">
      @@template.lievit.sidebar(variant = "inset", content = ...)
      @@template.lievit.sidebar.inset(content = ...)
    </div>

  STRUCTURE (shadcn SidebarInset): a <main data-slot="sidebar-inset"> that grows to fill the row
  (flex: 1) and carries the page background. The enhancer's `[data-variant="inset"] ~ ...` rule
  (a sibling selector off the sidebar root) gives the adjacent inset its margin / radius / shadow
  only under the inset variant; the default and floating variants leave the inset flush.

  A11y: a real <main> landmark, so AT users get a "main content" region distinct from the <nav>
  sidebar landmark.

  Params:
    gg.jte.Content content      the page body.
    String cssClass = ""        extra utility classes on the <main>.

  Usage:
    @@template.lievit.sidebar.inset(content = @@`<h1>Dashboard</h1>...`)
--%>
@param gg.jte.Content content
@param String cssClass = ""
<main
    data-slot="sidebar-inset"
    class="lv-sidebar-inset ${cssClass}"
    style="position: relative; display: flex; flex: 1; flex-direction: column; min-width: 0; background: var(--lv-color-bg);"
>
    ${content}
</main>
