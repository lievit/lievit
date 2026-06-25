<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui sidebar/rail partial -- the thin clickable edge that toggles the sidebar collapse
  (shadcn Sidebar SidebarRail). Server-first PARTIAL; the click behaviour is wired in code by
  sidebar.enhancer.ts (the strict CSP refuses inline on* handlers), exactly like the header
  trigger -- the rail is a second, edge-docked affordance for the SAME collapse toggle.

  TIER: STATIC presentational -> JTE partial. The rail has no state of its own: it is a
  <button> the enhancer binds to the root's collapse toggle (data-sidebar="rail" is the
  enhancer's hook, mirroring the data-sidebar="rail" attribute shadcn uses). It lives INSIDE
  the sidebar <nav> (place it after the content), absolutely positioned to the docked edge by
  the enhancer's injected CSS, so its position follows data-side without per-call styling.

  STRUCTURE (shadcn SidebarRail): a real <button aria-label> docked to the inner edge of the
  rail; tabindex=-1 (it duplicates the header trigger, which stays in the tab order), so it is
  a mouse affordance, not a redundant tab stop. Hidden on mobile (the off-canvas overlay has
  the backdrop + trigger instead) via the enhancer's media query.

  A11y: a real <button aria-label> the platform exposes; tabindex=-1 keeps it out of the tab
  order (the header trigger is the keyboard path). title mirrors the label for a hover hint.

  Params:
    String label = "Toggle sidebar"  accessible name + hover title for the rail button.
    String cssClass = ""             extra utility classes on the rail.

  Usage (place inside the sidebar content tree, typically last):
    @@template.lievit.sidebar.rail()
--%>
@param String label = "Toggle sidebar"
@param String cssClass = ""
<button
    type="button"
    data-slot="sidebar-rail"
    data-sidebar="rail"
    data-action="click->lv-sidebar#toggle"
    aria-label="${label}"
    title="${label}"
    tabindex="-1"
    class="lv-sidebar-rail ${cssClass}"
    style="position: absolute; inset-block: 0; z-index: 20; width: var(--lv-space-4); border: 0; padding: 0; background: transparent; cursor: pointer;"
></button>
