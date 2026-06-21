@import io.lievit.kit.GlobalSearchResults
@import io.lievit.kit.page.KitPageView
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.page - the canonical Filament PANEL SHELL, rendered from a KitPageView onto the
  lievit-ui shell primitives (sidebar / sidebar.group / sidebar.item, breadcrumb, dropdown-menu,
  avatar, theme-switcher, notification-bell, input-group, popover, icon). It is the kit's REFERENCE
  panel render: the body templates (kit/page/resource-*.jte, kit/page/auth.jte) drop a page body into
  this shell, mirroring how kit/table.jte renders the table chrome.

  The Filament panel chrome (Filament layout/base.blade + index.blade + livewire/{sidebar,topbar}.blade
  + components/{header,user-menu}.blade), server-first (every control a real <a href> / <form> / native
  popover; strict CSP -> no inline <script>/on*):
    1  app-shell layout: skip-link (first focusable) + sidebar column + main column.       -> skip-link
    2  sidebar navigation: groups + items + badges + active aria-current.                    -> kit.page.sidebar-nav
    3  sticky topbar: brand spacer + global search + notification bell + user menu.          -> the <header> below
    4  global search field (+ grouped-results popover).                                      -> kit.page.global-search
    5  notification bell (unread badge + dropdown panel).                                    -> lievit.notification-bell
    6  user menu (avatar dropdown + profile + theme switch + items + logout).                -> kit.page.user-menu
    7  page header (breadcrumbs + h1 + subheading + header actions).                         -> kit.page.page-header
    8  <main> content region capped at a max-content-width.                                  -> the <main> below

  WHY this composes the lievit-ui primitives directly (and not blocks/app-shell): blocks/app-shell is
  the bare composition (sidebar + breadcrumb + search + user menu), but the FILAMENT panel adds a
  notification-bell slot in the topbar and a theme-switcher inside the user menu, which the bare block
  does not expose. The kit shell is the Filament-faithful superset; an adopter who wants only the bare
  shell still has blocks/app-shell.

  Params:
    page          - the KitPageView render bundle (brand / nav / user / theme / search / bell facts).
    content       - the page body rendered inside <main> (a resource page wrapper or an auth body).
    headerActions - the page-header toolbar buttons cluster; null hides it.
    searchResults - server-prefetched grouped global-search hits; null => the search field is GET-only.
    notifications - the notification-bell dropdown panel body (header + rows); null => the default
                    "no notifications" panel renders when the bell is shown.
    titleVisible  - false => the page <h1> moves into the page-header only (the topbar carries no title).
--%>
@param KitPageView page
@param gg.jte.Content content
@param gg.jte.Content headerActions = null
@param GlobalSearchResults searchResults = null
@param gg.jte.Content notifications = null
!{var mainId = "kit-page-main";}
!{var widthClass = page.hasMaxContentWidth() ? "mx-auto w-full max-w-[var(--lv-container-" + page.maxContentWidth() + ",80rem)]" : "w-full";}
<div
  data-slot="kit-page"
  class="flex h-[var(--lv-space-screen,100dvh)] w-full overflow-hidden bg-[var(--lv-color-bg)] text-[var(--lv-color-fg)]"
  style="font-family:var(--lv-font-sans);"
>
  <%-- 1. Skip-link (first focusable): jumps straight to the <main> content, bypassing the chrome. --%>
  <a
    href="#${mainId}"
    data-slot="kit-page-skip-link"
    class="sr-only focus:not-sr-only focus:absolute focus:left-[var(--lv-space-2)] focus:top-[var(--lv-space-2)] focus:z-[var(--lv-z-toast)] focus:inline-flex focus:items-center focus:rounded-[var(--lv-radius-md)] focus:border focus:border-[var(--lv-color-border)] focus:bg-[var(--lv-color-bg)] focus:px-[var(--lv-space-3)] focus:py-[var(--lv-space-2)] focus:text-[length:var(--lv-text-sm)] focus:font-[var(--lv-font-medium)] focus:shadow-[var(--lv-ring)] focus:outline-none"
  >Skip to main content</a>

  <%-- 2. Sidebar navigation: the lievit-ui sidebar partial owns the <nav> landmark + the collapse
       trigger (CSP-clean enhancer); the brand fills its header; the nav tree is the kit sub-part. --%>
  <div data-slot="kit-page-sidebar" class="shrink-0">
    @template.lievit.sidebar(
      label = "Main",
      header = @`<span class="text-[length:var(--lv-text-base)] font-[var(--lv-font-semibold)]">${page.brandName()}</span>`,
      content = @`@template.kit.page.sidebar-nav(page = page)`
    )
  </div>

  <div data-slot="kit-page-body" class="flex min-w-0 flex-1 flex-col overflow-hidden">
    <%-- 3. Sticky topbar: brand spacer + global search + notification bell + user menu. The sidebar
         partial renders its own collapse trigger, so the topbar opens directly on the search. --%>
    <header
      data-slot="kit-page-topbar"
      class="sticky top-0 z-[var(--lv-z-sticky)] flex h-[var(--lv-space-16)] shrink-0 items-center gap-[var(--lv-space-2)] border-b border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-4)]"
    >
      <div data-slot="kit-page-topbar-spacer" class="flex-1"></div>

      @if(page.hasSearch())
        <%-- 4. Global search field (+ grouped-results popover when results are prefetched). --%>
        @template.kit.page.global-search(page = page, results = searchResults)
      @endif

      @if(page.hasNotifications())
        <%-- 5. Notification bell: the unread badge + the dropdown panel (host fills the rows). --%>
        <div data-slot="kit-page-bell" class="shrink-0">
          @template.lievit.notification-bell(
            id = "kit-page-bell",
            unreadCount = page.notificationCount(),
            header = @`@template.lievit.notification-bell.header()`,
            notifications = notifications)
        </div>
      @endif

      @if(page.hasUser())
        <%-- 6. User menu: avatar dropdown + profile + theme switch + items + logout. --%>
        @template.kit.page.user-menu(page = page)
      @endif
    </header>

    <main
      id="${mainId}"
      data-slot="kit-page-main"
      tabindex="-1"
      class="min-w-0 flex-1 overflow-y-auto p-[var(--lv-space-6)] focus-visible:outline-none"
    >
      <div data-slot="kit-page-content" class="${widthClass}">
        <%-- 7. Page header (breadcrumbs + h1 + subheading + header actions). --%>
        @template.kit.page.page-header(page = page, actions = headerActions)
        <%-- 8. The page body (the resource wrapper / auth body). --%>
        ${content}
      </div>
    </main>
  </div>
</div>
