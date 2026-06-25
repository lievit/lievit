@import java.util.LinkedHashMap
@import dev.lievit.kit.GlobalSearchResults
@import dev.lievit.kit.page.KitPageView
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
    brandLogo     - URL of the brand logo image (Filament brand-logo slot, issue #492). Empty => falls
                    back to brandName text; non-empty => renders an <img> capped to the brand-bar height.
                    Default "". ADR sw-architecture-008 backflow.
    brandLogoAlt  - The alt attribute of the brand logo image. Falls back to page.brandName() when blank.
                    Default "". ADR sw-architecture-008 backflow.
    pageHeader    - false => suppresses the in-content page header (Filament headerless page, issue #492).
                    Useful for full-bleed dashboards or pages that render their own heading. Default true.
                    ADR sw-architecture-008 backflow.
--%>
@param KitPageView page
@param gg.jte.Content content
@param gg.jte.Content headerActions = null
@param GlobalSearchResults searchResults = null
@param gg.jte.Content notifications = null
<%-- brandLogo / brandLogoAlt: panel brand-logo slot (issue #492). Non-empty renders the adopter's
     logo <img> in the sidebar header; empty falls back to the brand-name text (Filament parity).
     ADR sw-architecture-008 backflow (generalised from gest dogfood). --%>
@param String brandLogo = ""
@param String brandLogoAlt = ""
<%-- pageHeader: false suppresses the in-content page header band (issue #492, Filament headerless
     page). A page that supplies its own heading (e.g. a full-bleed dashboard) passes false to avoid
     a double header. Default true preserves the existing behaviour for all existing callers.
     ADR sw-architecture-008 backflow. --%>
@param boolean pageHeader = true
!{var mainId = "kit-page-main";}
!{var widthClass = page.hasMaxContentWidth() ? "mx-auto w-full max-w-[var(--lv-container-" + page.maxContentWidth() + ",80rem)]" : "w-full";}
!{var hasBrandLogo = brandLogo != null && !brandLogo.isBlank();}
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
  <%-- Brand-logo slot (issue #492): render the configured logo <img> in the brand area the way
       Filament renders a panel brand logo; with no logo configured, fall back to the brand-name text
       (Filament's logo-if-set-else-name behaviour). The <img> height is capped to the brand band so
       it fits without distortion (width auto, contain). ADR sw-architecture-008 backflow. --%>
  <div data-slot="kit-page-sidebar" class="shrink-0">
    @template.lievit.sidebar(
      label = "Main",
      header = @`
        @if(hasBrandLogo)
          <img
            data-slot="kit-page-brand-logo"
            src="${brandLogo}"
            alt="${brandLogoAlt != null && !brandLogoAlt.isBlank() ? brandLogoAlt : page.brandName()}"
            class="block h-[var(--lv-space-8)] w-auto max-w-full object-contain"
          >
        @else
          <span class="text-[length:var(--lv-text-base)] font-[var(--lv-font-semibold)]">${page.brandName()}</span>
        @endif
      `,
      content = @`@template.kit.page.sidebar-nav(page = page)`,
      footer = @`@if(page.hasUser())@template.kit.page.user-menu(page = page, inFooter = true)@endif`
    )
    <%-- The footer slot above carries the user menu in the SIDEBAR FOOTER (issue #493): Filament
         panels place the user menu at the bottom of the sidebar, not the topbar. The footer slot
         persists in the collapsed icon rail, where the menu degrades to its avatar only (the name
         span is lv-sidebar-collapsible; the dropdown opens upward via inFooter=true on user-menu).
         ADR sw-architecture-008 backflow. --%>
  </div>

  <div data-slot="kit-page-body" class="flex min-w-0 flex-1 flex-col overflow-hidden">
    <%-- 3. Sticky topbar: brand spacer + global search + notification bell + user menu. The sidebar
         partial renders its own collapse trigger, so the topbar opens directly on the search. --%>
    <%-- The topbar shares the sidebar brand header's height + brand colour: both bars consume the
         single --lv-brand-bar-height + --lv-color-brand-bar tokens so they line up on one band and
         a rebrand is one edit. text-brand-bar-fg keeps the topbar controls AA-readable on the
         dark-green band. --%>
    <header
      data-slot="kit-page-topbar"
      class="sticky top-0 z-[var(--lv-z-sticky)] flex h-[var(--lv-space-16)] shrink-0 items-center gap-[var(--lv-space-2)] border-b border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-4)]"
    >
      <%-- Mobile sidebar-open hamburger (issue #493, Filament's topbar lg:hidden sidebar trigger):
           the in-sidebar collapse trigger rides INSIDE the off-canvas nav, which translateX(-100%)
           off-screen on mobile, so it cannot be the open affordance there. This button is the
           always-reachable mobile opener: hidden at/above the breakpoint by
           .lv-sidebar-mobile-open-trigger (sidebar.enhancer), wired via data-lv-sidebar-open which
           the enhancer points at the page's sidebar root.
           ADR sw-architecture-008 backflow. --%>
      <button
        type="button"
        data-lv-sidebar-open
        aria-label="Open navigation"
        aria-controls="lv-sidebar-nav"
        aria-expanded="false"
        class="lv-sidebar-mobile-open-trigger shrink-0 inline-flex items-center justify-center rounded-[var(--lv-radius-md)] p-[var(--lv-space-2)] hover:bg-[var(--lv-color-accent)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
      >
        <span aria-hidden="true" class="inline-flex">@template.lievit.icon(name = "menu", size = "1.25rem")</span>
      </button>

      <div data-slot="kit-page-topbar-spacer" class="flex-1"></div>

      @if(page.hasSearch())
        <%-- 4. Global search field (+ grouped-results popover when results are prefetched). --%>
        @template.kit.page.global-search(page = page, results = searchResults)
      @endif

      @if(page.hasNotifications())
        <%-- 5. Notification bell: the unread badge + the dropdown panel.
             v-next: notification-bell no longer accepts Content slots (header/notifications).
             It now takes items=List<Map<String,String>>; the adopter must provide a KitBellView
             and use kit/notification/bell.jte directly for full row rendering.
             page.jte receives notifications=Content for backwards compat but cannot thread it
             into the new flat-list API; render via kit/notification/bell.jte if a KitBellView
             is available at the call site. Here we render the bell chrome with the unread count
             and the notifications Content block below it as a fallback region.
             TODO: migrate page callers to pass KitBellView and use kit.notification.bell instead. --%>
        <div data-slot="kit-page-bell" class="shrink-0">
          @template.lievit.notification-bell(
            id = "kit-page-bell",
            unreadCount = (int) page.notificationCount(),
            items = java.util.List.of(),
            bellAriaLabel = "Notifications")
          @if(notifications != null)
            <div data-slot="kit-page-bell-content" hidden>${notifications}</div>
          @endif
        </div>
      @endif

      <%-- The user menu moved to the SIDEBAR FOOTER (issue #493): the topbar now carries only the
           search (+ optional bell), Filament-style. See the sidebar footer slot above. --%>
    </header>

    <main
      id="${mainId}"
      data-slot="kit-page-main"
      tabindex="-1"
      class="min-w-0 flex-1 overflow-y-auto p-[var(--lv-space-6)] focus-visible:outline-none"
    >
      <div data-slot="kit-page-content" class="${widthClass}">
        <%-- 7. Page header (breadcrumbs + h1 + subheading + header actions). A page can opt OUT of it
             (issue #492, Filament pages may render without a header): pageHeader=false suppresses it,
             so a page that renders its own heading (e.g. a full-bleed dashboard) is not double-headed.
             ADR sw-architecture-008 backflow. --%>
        @if(pageHeader)
          @template.kit.page.page-header(page = page, actions = headerActions)
        @endif
        <%-- 8. The page body (the resource wrapper / auth body). --%>
        ${content}
      </div>
    </main>
  </div>
</div>
