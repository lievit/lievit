@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui navigation-menu partial -- a site navigation landmark with real <a href> links and
  optional rich dropdown panels, CSS-only (no JS, no client state). Server-first PARTIAL
  (ADR-0012, Wave 2): the Lit island is gone.

  TIER DECISION (why PARTIAL, not WIRE): a navigation menu is, by the ADR's driving rule, "pure
  display, no client state" once you accept the server-pure overlay. The links are real <a href>
  (the browser navigates, middle-click + open-in-new-tab work); which entry is current is a fact
  the SERVER already knows (the route being rendered), passed in as `activeKey` -- not client
  state. The only interactive bit, "reveal the panel", needs no server round-trip and no durable
  state, so it is pure CSS :hover / :focus-within (the same server-pure disclosure the hover-card
  partial uses). There is therefore nothing to hold server-side: no @Wire field, no action, no
  wire component. A WIRE conversion would round-trip the server just to flip a CSS-revealable
  panel -- strictly worse. Hence `registry:jte`, the simplest thing that works server-first.

  STRUCTURE (scientific decision rule): NOT a menu (no role="menu"); a navigation landmark, Radix
  NavigationMenu as the model the dropped island cited: <nav aria-label> wrapping a <ul> of items.
  An item is either a bare <a> link (navigation-menu/link) or a trigger that reveals a panel of
  real <a> links (navigation-menu/menu). The panel reveal is CSS group-hover / group-focus-within
  (Tailwind `group` + `group-hover` / `group-focus-within`), the canonical CSS-only disclosure --
  no @floating-ui/dom, no Anchor Positioning needed (the panel sits in normal flow under its
  trigger). The intent-delay open / leave-close nuance of the island is dropped deliberately (a
  delay needs a timer = client state); a small padding bridge keeps the trigger->panel gap
  crossable.

  A11y (Radix NavigationMenu model): <nav aria-label> landmark; the panel triggers are <button
  aria-expanded aria-controls> whose state CSS reflects; the links are ordinary anchors so
  navigation + focus order are the platform's. The active link carries aria-current="page".
  Keyboard: Tab moves through the triggers + links; :focus-within reveals a trigger's panel so a
  keyboard user reaches its links without a custom key handler.

  Params:
    gg.jte.Content content   the <li> items, composed from navigation-menu/link + navigation-menu/menu.
    String label = "Main"    aria-label for the <nav> landmark.
    String cssClass = ""     extra utility classes on the <nav>.

  Usage:
    @@template.navigation-menu(label = "Primary", content = @@`
      @@template.navigation-menu.menu(key = "products", label = "Products", open = false, content = @@`
        @@template.navigation-menu.link(href = "/analytics", label = "Analytics", description = "Track everything", icon = "eye", active = false, inPanel = true)
        @@template.navigation-menu.link(href = "/engagement", label = "Engagement", active = false, inPanel = true)
      `)
      @@template.navigation-menu.link(href = "/docs", label = "Docs", active = activeKey.equals("docs"))
    `)
--%>
@param gg.jte.Content content
@param String label = "Main"
@param String cssClass = ""
<nav aria-label="${label}" data-slot="navigation-menu" class="${cssClass}" style="font-family: var(--lv-font-sans); font-size: var(--lv-text-sm);">
    <ul data-slot="navigation-menu-list" class="flex items-center" style="gap: var(--lv-space-1); list-style: none; margin: 0; padding: 0;">
        ${content}
    </ul>
</nav>
