@import java.util.List
@import java.util.Map
@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui :: app-shell (BLOCK -- a composition, not a primitive)

  The canonical authenticated-application shell: a full-page layout that docks the
  server-first SIDEBAR partial navigation against a main column with a sticky top header
  (sidebar toggle, breadcrumb, a spacer, a search input-group, and a user menu) and a
  `content` main region. This is the PATTERN behind shadcn's sidebar-* + dashboard-01
  blocks, expressed once as a JTE block (the planning two-tier model: BLOCKS are
  compositions of existing components, deduped to the distinct pattern -- not 16 clones).

  SERVER-FIRST (ADR-0012, Wave 4): the block COMPOSES the server-rendered partials, it
  no longer mounts Lit-island custom elements. Every former island tag is now a
  `@template.lievit.*` composition rendered on the server, data DOWN via typed @param:
    - @template.lievit.sidebar(+ .group + .item)  the navigation: a real <nav> landmark of
                               <a href> entries. The active item is a SERVER fact
                               (`activeNav`), not client state. Groups arrive as typed
                               nav data (`navGroups`), never hardcoded here.
    - @template.lievit.dropdown-menu  the user menu: a native-popover menu of real <a>/<button>
                               items (zero JS, CSP-clean). Items arrive as typed data
                               (`userMenu`), never hardcoded here.
    - @template.lievit.breadcrumb     the header trail: a real <nav aria-label="Breadcrumb"> of
                               <a href> + a current <span aria-current="page">.
    - @template.lievit.input-group    the header search field (a real <input> + a Lucide search addon).
    - @template.lievit.avatar         the user's avatar inside the user-menu trigger.
    - @template.lievit.icon           every glyph (Lucide raw SVG; the only icon source).

  TIER: this BLOCK is static composed markup (a JTE template). The sidebar collapse is the
  ONLY client behaviour, supplied by the sidebar partial's own CSP-clean typed-TS enhancer
  (localStorage-persisted); the block itself ships zero client behaviour and zero inline
  <script>. The header toggle is a real <button data-lv-sidebar-trigger> the same enhancer
  binds (no inline handler).

  DATA DOWN (no hardcoded menu data): the navigation groups arrive via `navGroups`, a typed
  List<Map<String,String>> the controller derives from real model data; this block iterates
  it into @template.lievit.sidebar.group / @template.lievit.sidebar.item entries. The user-menu items
  arrive via `userMenu`, a List<Map<String,String>> iterated into @template.lievit.dropdown-menu.item
  entries. The block NEVER inlines item labels/hrefs of its own. A group row carries
  `groupLabel`; an item row carries `label`, `href`/`formAction`, `icon`, `key`/`badge`,
  and `separator`="true" to emit a divider.

  A11y (WAI-ARIA landmark structure):
    - a skip-link (first focusable) jumps straight to the <main> content, bypassing the chrome.
    - the sidebar partial renders the page's <nav> landmark (one navigation region).
    - the header is a <header> landmark (banner) with role-correct controls.
    - the content region is a <main id> landmark carrying the page <h1> (visible or sr-only).

  Params:
    String appName                  product/app name shown in the sidebar header.
    String sidebarLabel = "Main"    accessible name for the sidebar <nav> landmark.
    String activeNav    = ""        key of the active nav item (server-set aria-current).
    List<Map<String,String>> navGroups   the sidebar data: each map is either a group
                                    header (key `groupLabel`) or a nav item (keys `key`,
                                    `label`, `href`, `icon`, `badge`). Derived by the
                                    controller; the block renders no menu items of its own.
    String userName                 the signed-in user's display name (avatar + menu trigger).
    String userAvatarSrc = null     the user's avatar image URL; null => initials/icon fallback.
    String userInitials  = null     avatar fallback initials when no image (e.g. "FB").
    List<Map<String,String>> userMenu    the user-menu items: each map keys `label`,
                                    `href` (a link item) OR `formAction` (a submit item),
                                    optional `icon`, optional `separator`="true" (a divider).
    String pageTitle                the page <h1> text (the main landmark's heading).
    boolean titleVisible = true     false => the <h1> is visually hidden (sr-only) but present.
    List<Map<String,String>> breadcrumb = null  the header breadcrumb trail, root-to-current;
                                    each map keys `label` (+ optional `href`). null => omitted.
    String searchName    = "q"      name of the header search input.
    String searchPlaceholder = "Search..."  placeholder for the header search field.
    String searchAction  = null     optional form action the search submits to; null => no form wrap.
    gg.jte.Content content          the page body rendered inside <main>.

  Usage (the controller derives the typed nav + menu data; nothing hardcoded here):
    @@template.lievit.blocks.app-shell(
      appName = "HouseTree", sidebarLabel = "Main", activeNav = "contatti",
      navGroups = java.util.List.of(
        java.util.Map.of("groupLabel", "Platform"),
        java.util.Map.of("key", "contatti", "label", "Contatti", "href", "/contatti", "icon", "users"),
        java.util.Map.of("key", "immobili", "label", "Immobili", "href", "/immobili", "icon", "house", "badge", "3")
      ),
      userName = "Francesco Bilotta", userInitials = "FB", userAvatarSrc = user.avatarUrl(),
      userMenu = java.util.List.of(
        java.util.Map.of("label", "Profilo", "href", "/profilo", "icon", "user"),
        java.util.Map.of("separator", "true"),
        java.util.Map.of("label", "Esci", "formAction", "/logout", "icon", "log-out")
      ),
      pageTitle = "Contatti",
      breadcrumb = java.util.List.of(
        java.util.Map.of("label", "Home", "href", "/"),
        java.util.Map.of("label", "Contatti")
      ),
      searchName = "q", searchPlaceholder = "Cerca contatti...", searchAction = "/cerca",
      content = @@`<p>...the page...</p>`
    )
--%>
@param String appName
@param String sidebarLabel = "Main"
@param String activeNav = ""
@param List<Map<String, String>> navGroups = java.util.List.of()
@param String userName
@param String userAvatarSrc = null
@param String userInitials = null
@param List<Map<String, String>> userMenu = java.util.List.of()
@param String pageTitle
@param boolean titleVisible = true
@param List<Map<String, String>> breadcrumb = null
@param String searchName = "q"
@param String searchPlaceholder = "Search..."
@param String searchAction = null
@param gg.jte.Content content

!{var mainId = "app-shell-main";}

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

  <%-- Navigation landmark: the sidebar partial renders the page's <nav>; nav data is iterated
       DOWN from the typed navGroups list into sidebar group/item compositions (no hardcoding). --%>
  <div data-slot="app-shell-sidebar" class="shrink-0">
    @template.lievit.sidebar(
      label = sidebarLabel,
      header = @`<span class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-semibold)]">${appName}</span>`,
      content = @`
        <%-- Segment navGroups into labelled groups. A groupLabel row opens a new group;
             the item rows that follow belong to it. Items before the first label form one
             leading unlabelled group. The start/end ranges + their labels are computed
             once in Java, so the markup just iterates the precomputed segments. --%>
        !{var labels = new java.util.ArrayList<String>();}
        !{var starts = new java.util.ArrayList<Integer>();}
        !{var ends = new java.util.ArrayList<Integer>();}
        !{
          int cursor = 0;
          if (cursor < navGroups.size() && !navGroups.get(cursor).containsKey("groupLabel")) {
            labels.add(""); starts.add(0);
            int e = 0; while (e < navGroups.size() && !navGroups.get(e).containsKey("groupLabel")) e++;
            ends.add(e); cursor = e;
          }
          while (cursor < navGroups.size()) {
            labels.add(navGroups.get(cursor).getOrDefault("groupLabel", ""));
            int s = cursor + 1; int e = s;
            while (e < navGroups.size() && !navGroups.get(e).containsKey("groupLabel")) e++;
            starts.add(s); ends.add(e); cursor = e;
          }
        }
        @for(var gi = 0; gi < labels.size(); gi++)
          !{var gStart = starts.get(gi);}
          !{var gEnd = ends.get(gi);}
          @template.lievit.sidebar.group(label = labels.get(gi), content = @`
            @for(var i = gStart; i < gEnd; i++)
              !{var item = navGroups.get(i);}
              !{var key = item.getOrDefault("key", item.getOrDefault("href", item.getOrDefault("label", "")));}
              @template.lievit.sidebar.item(
                key = key,
                label = item.getOrDefault("label", ""),
                href = item.getOrDefault("href", ""),
                icon = item.getOrDefault("icon", ""),
                badge = item.getOrDefault("badge", ""),
                active = key.equals(activeNav)
              )
            @endfor
          `)
        @endfor
      `
    )
  </div>

  <div data-slot="app-shell-body" class="flex min-w-0 flex-1 flex-col overflow-hidden">
    <header
      data-slot="app-shell-header"
      class="sticky top-0 z-[var(--lv-z-sticky)] flex h-[var(--lv-space-16)] shrink-0 items-center gap-[var(--lv-space-2)] border-b border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-4)]"
    >
      @if(breadcrumb != null)
        <div data-slot="app-shell-breadcrumb" class="hidden min-w-0 items-center md:flex">
          @template.lievit.breadcrumb(items = breadcrumb)
        </div>
      @endif

      <div data-slot="app-shell-spacer" class="flex-1"></div>

      @if(searchAction != null)<form role="search" action="${searchAction}" method="get" class="hidden min-w-0 sm:block">@endif
      <div data-slot="app-shell-search" class="hidden w-[var(--lv-app-shell-search-w,16rem)] min-w-0 sm:block">
        !{var _searchAttrs = "aria-label=\"" + searchPlaceholder + "\"";}
        @template.lievit.input-group(
          ariaLabel = searchPlaceholder,
          leadingAddon = @`@template.lievit.icon(name = "search")`,
          content = @`@template.lievit.input(name = searchName, type = "search", placeholder = searchPlaceholder, attrs = _searchAttrs)`
        )
      </div>
      @if(searchAction != null)</form>@endif

      <%-- User menu: the dropdown-menu partial owns the native-popover menu behaviour; the
           avatar + name compose its trigger; items iterated DOWN from the userMenu data. --%>
      <div data-slot="app-shell-user-menu" class="shrink-0">
        @template.lievit.dropdown-menu(
          id = "app-shell-user-menu",
          placement = "bottom",
          trigger = @`
            <span class="flex items-center gap-[var(--lv-space-2)]">
              @template.lievit.avatar(name = userName, src = userAvatarSrc, initials = userInitials, size = "sm")
              <span class="hidden text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] md:inline">${userName}</span>
              @template.lievit.icon(name = "chevron-down", cssClass = "text-[var(--lv-color-muted-fg)]")
            </span>
          `,
          content = @`
            @for(Map<String, String> mi : userMenu)
              @if("true".equals(mi.get("separator")))
                @template.lievit.dropdown-menu.separator()
              @else
                @template.lievit.dropdown-menu.item(
                  label = mi.getOrDefault("label", ""),
                  href = mi.getOrDefault("href", ""),
                  icon = mi.getOrDefault("icon", ""),
                  formAction = mi.getOrDefault("formAction", "")
                )
              @endif
            @endfor
          `
        )
      </div>
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
