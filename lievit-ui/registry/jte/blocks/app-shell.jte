@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui :: app-shell (BLOCK -- a composition, not a primitive)

  The canonical authenticated-application shell: a full-page layout that docks the
  `<lv-sidebar>` navigation island against a main column with a sticky top header
  (sidebar toggle, breadcrumb, a spacer, a search input-group, and a user menu) and a
  `content` main region. This is the PATTERN behind shadcn's sidebar-* + dashboard-01
  blocks, expressed once as a JTE block (the planning two-tier model: BLOCKS are
  compositions of existing components, deduped to the distinct pattern -- not 16 clones).

  COMPOSITION (no rebuild -- this block only ARRANGES existing lievit-ui pieces):
    - `<lv-sidebar>`            the navigation island (its own <nav> landmark, collapse,
                               Ctrl/Cmd+B shortcut, mobile off-canvas). Data DOWN via its
                               `groups` JS property -- never hardcoded here; see `navGroups`.
    - `breadcrumb`             the trail in the header: the `breadcrumb` Content slot the
                               caller fills (e.g. with the `<lv-breadcrumb>` island or a
                               server-rendered <nav aria-label="Breadcrumb">).
    - @template.input-group    the header search field (a real <input> + a Lucide search addon).
    - `<lv-dropdown-menu>`     the user menu trigger + items (keyboard-navigable APG menu-button).
    - @template.avatar         the user's avatar inside the user-menu trigger.
    - @template.icon           every glyph (Lucide raw SVG; the only icon source).

  TIER: this BLOCK is static composed markup (a JTE template). All interactivity is supplied
  by the islands it composes (sidebar collapse, dropdown menu); the block itself ships zero
  client behaviour and zero inline <script>.

  DATA DOWN (no hardcoded menu data): the navigation groups arrive via `navGroups`, a Content
  slot the caller fills with a `<script type="application/json" data-lv-sidebar-groups>` JSON
  payload derived from real model data. A `<script type="application/json">` is an inert DATA
  block (NOT executable JS), so it is CSP-clean; the copy-in sidebar hydration module reads it
  and assigns `lvSidebar.groups`. The block NEVER inlines item labels/hrefs of its own.

  ISLAND WIRING (no inline handlers -- the strict CSP refuses them): the header sidebar-toggle
  is a real <button data-lv-sidebar-toggle> carrying a data- hook only; the adopter's
  `main.ts` binds its click to `document.querySelector('lv-sidebar').toggle()` (same copy-in
  pattern as alert-dialog's `data-lv-dialog-close`). The toggle's pressed state mirrors the
  sidebar via `aria-expanded`, kept in sync by the same module on `lv-state-change`.

  A11y (WAI-ARIA landmark structure):
    - a skip-link (first focusable) jumps straight to the <main> content, bypassing the chrome.
    - the sidebar island renders the page's <nav> landmark (one navigation region).
    - the header is a <header> landmark (banner) with role-correct controls.
    - the content region is a <main id> landmark carrying the page <h1> (visible or sr-only).
    - the toggle button names the sidebar via aria-controls + aria-expanded.

  Params:
    String appName                  product/app name shown in the sidebar header.
    String sidebarLabel = "Main"    accessible name for the sidebar <nav> landmark + island.
    String activeNav    = ""        key of the active nav item (the island sets aria-current).
    String sidebarId    = "app-sidebar"  id on the <lv-sidebar> (aria-controls target of the toggle).
    gg.jte.Content navGroups        the sidebar data payload: a <script type="application/json"
                                    data-lv-sidebar-groups> block the caller derives from the model.
                                    Required; the block renders no menu items of its own.
    String userName                 the signed-in user's display name (avatar + menu trigger).
    String userAvatarSrc = null     the user's avatar image URL; null => initials/icon fallback.
    String userInitials  = null     avatar fallback initials when no image (e.g. "FB").
    gg.jte.Content userMenu         the `<lv-dropdown-menu>` items payload for the user menu
                                    (caller derives from the model: profile, settings, sign out).
    String pageTitle                the page <h1> text (the main landmark's heading).
    boolean titleVisible = true     false => the <h1> is visually hidden (sr-only) but present.
    gg.jte.Content breadcrumb = null the header breadcrumb trail (e.g. <lv-breadcrumb> or a
                                    server-rendered <nav aria-label="Breadcrumb">). null => omitted.
    String searchName    = "q"      name of the header search input.
    String searchPlaceholder = "Search..."  placeholder for the header search field.
    String searchAction  = null     optional <form action> the search submits to; null => no form wrap.
    gg.jte.Content content          the page body rendered inside <main>.

  Usage:
    @@template.blocks.app-shell(
      appName = "HouseTree", sidebarLabel = "Main", activeNav = "contatti",
      navGroups = @@`<script type="application/json" data-lv-sidebar-groups>${navGroupsJson}</script>`,
      userName = "Francesco Bilotta", userInitials = "FB", userAvatarSrc = user.avatarUrl(),
      userMenu = @@`<script type="application/json" data-lv-dropdown-items>${userMenuJson}</script>`,
      pageTitle = "Contatti",
      breadcrumb = @@`<lv-breadcrumb separator="/"></lv-breadcrumb>`,
      searchName = "q", searchPlaceholder = "Cerca contatti...", searchAction = "/cerca",
      content = @@`<p>...the page...</p>`
    )

    The controller serializes the nav + menu data to JSON (e.g. Jackson) and the copy-in
    `app-shell.ts` module hydrates `lvSidebar.groups` / `lvDropdownMenu.items` from the
    inert <script type="application/json"> payloads and wires the toggle.
--%>
@param String appName
@param String sidebarLabel = "Main"
@param String activeNav = ""
@param String sidebarId = "app-sidebar"
@param gg.jte.Content navGroups
@param String userName
@param String userAvatarSrc = null
@param String userInitials = null
@param gg.jte.Content userMenu
@param String pageTitle
@param boolean titleVisible = true
@param gg.jte.Content breadcrumb = null
@param String searchName = "q"
@param String searchPlaceholder = "Search..."
@param String searchAction = null
@param gg.jte.Content content

!{var mainId = "app-shell-main";}
!{var toggleId = "app-shell-sidebar-toggle";}

<div
  data-slot="app-shell"
  class="flex h-[var(--lv-space-screen,100dvh)] w-full overflow-hidden bg-[var(--lv-color-bg)] text-[var(--lv-color-fg)]"
  style="font-family:var(--lv-font-sans);"
>
  <a
    href="#${mainId}"
    data-slot="app-shell-skip-link"
    class="sr-only focus:not-sr-only focus:absolute focus:left-[var(--lv-space-2)] focus:top-[var(--lv-space-2)] focus:z-[var(--lv-z-toast)] focus:inline-flex focus:items-center focus:rounded-[var(--lv-radius-md)] focus:border focus:border-[var(--lv-color-border)] focus:bg-[var(--lv-color-bg)] focus:px-[var(--lv-space-3)] focus:py-[var(--lv-space-2)] focus:text-[length:var(--lv-text-sm)] focus:font-[var(--lv-font-medium)] focus:shadow-[var(--lv-ring)] focus:outline-none"
  >Skip to main content</a>

  <%-- Navigation landmark: provided ENTIRELY by the sidebar island; data hydrated from navGroups. --%>
  <lv-sidebar
    id="${sidebarId}"
    label="${sidebarLabel}"
    heading="${appName}"
    active="${activeNav}"
    collapsible="icon"
    data-slot="app-shell-sidebar"
  >
    ${navGroups}
  </lv-sidebar>

  <div data-slot="app-shell-body" class="flex min-w-0 flex-1 flex-col overflow-hidden">
    <header
      data-slot="app-shell-header"
      class="sticky top-0 z-[var(--lv-z-sticky)] flex h-[var(--lv-space-16)] shrink-0 items-center gap-[var(--lv-space-2)] border-b border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-4)]"
    >
      <button
        id="${toggleId}"
        type="button"
        data-lv-sidebar-toggle
        aria-controls="${sidebarId}"
        aria-expanded="true"
        aria-label="Toggle navigation sidebar"
        class="inline-flex shrink-0 items-center justify-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] p-[var(--lv-space-2)] text-[var(--lv-color-fg)] transition-colors hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] focus-visible:shadow-[var(--lv-ring)] focus-visible:outline-none"
      >@template.icon(name = "menu", size = "1.25rem")</button>

      @if(breadcrumb != null)
        <div data-slot="app-shell-breadcrumb" aria-hidden="false" class="hidden min-w-0 items-center md:flex">
          <span aria-hidden="true" class="mr-[var(--lv-space-2)] h-[var(--lv-space-4)] w-px shrink-0 bg-[var(--lv-color-border)]"></span>
          ${breadcrumb}
        </div>
      @endif

      <div data-slot="app-shell-spacer" class="flex-1"></div>

      @if(searchAction != null)<form role="search" action="${searchAction}" method="get" class="hidden min-w-0 sm:block">@endif
      <div data-slot="app-shell-search" class="hidden w-[var(--lv-app-shell-search-w,16rem)] min-w-0 sm:block">
        @template.input-group(
          name = searchName,
          type = "search",
          placeholder = searchPlaceholder,
          ariaLabel = searchPlaceholder,
          leading = @`@template.icon(name = "search")`
        )
      </div>
      @if(searchAction != null)</form>@endif

      <%-- User menu: the dropdown island owns the keyboard/ARIA menu behaviour; the avatar +
           name compose its trigger; items hydrated from the userMenu data payload. --%>
      <lv-dropdown-menu
        data-slot="app-shell-user-menu"
        label="${userName}"
        placement="bottom-end"
        class="shrink-0"
      >
        <span slot="trigger" class="flex items-center gap-[var(--lv-space-2)]">
          @template.avatar(name = userName, src = userAvatarSrc, initials = userInitials, size = "sm")
          <span class="hidden text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] md:inline">${userName}</span>
          @template.icon(name = "chevron-down", cssClass = "text-[var(--lv-color-muted-fg)]")
        </span>
        ${userMenu}
      </lv-dropdown-menu>
    </header>

    <main
      id="${mainId}"
      data-slot="app-shell-main"
      tabindex="-1"
      class="min-w-0 flex-1 overflow-y-auto p-[var(--lv-space-6)] focus-visible:outline-none"
    >
      <h1
        data-slot="app-shell-title"
        class="${titleVisible
          ? "mb-[var(--lv-space-4)] text-[length:var(--lv-text-2xl,1.5rem)] font-[var(--lv-font-semibold)] tracking-tight text-[var(--lv-color-fg)]"
          : "sr-only"}"
      >${pageTitle}</h1>
      ${content}
    </main>
  </div>
</div>
