@import java.util.List
@import java.util.Map
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui breadcrumb partial -- secondary navigation trail showing the user's
  current location in a page hierarchy (e.g. Home / Customers / Acme Corp / Edit).

  TIER: PARTIAL presentational (ADR-0012 server-first pivot). The breadcrumb is STATIC:
  the server already knows the route being rendered, so it emits the full <nav> in one
  pass. Zero client state, no enhancer. The former <lv-breadcrumb> Lit island is gone.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Breadcrumb (nav of links)
    https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/
    https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/examples/breadcrumb/
  A <nav aria-label> landmark wraps an ordered <ol>; the ordinal communicates
  root-to-current sequence to assistive technology. Each non-current item is a real
  <a href> (the browser navigates; middle-click + open-in-new-tab work; no JS).
  The current (last) item is <a aria-current="page"> when it has an href, or
  <span aria-current="page"> when href is null (correctly removed from tab order).
  Separators are dedicated <li aria-hidden="true"> nodes so screen readers count
  ONLY the crumb items. The collapsed ellipsis is a <button> (keyboard-reachable);
  expansion is a server-side controller decision -- the PARTIAL is stateless.

  ITEMS DATA SHAPE: items arrive as List<Map<String,String>>, root-to-current, each
  map keyed:
    label  (required) -- the visible text for the crumb
    href   (optional) -- navigation target; null/absent => non-link span
    attrs  (optional, TRUSTED raw) -- STATIC author-typed extras only (target, rel,
           data-turbo="false"); never a DB-derived runtime value
  The per-item icon slot (gg.jte.Content per-item) is deferred: a Map<String,String>
  cannot carry a gg.jte.Content value and the JTE-compile gate classpath does not
  include a custom BreadcrumbItem record type. Icon support at the item level requires
  a typed Java record that ships with the library's Java layer; this partial covers
  the full spec sans per-item icon.

  COLLAPSE VARIANT: when collapsed=true and items.size() > maxVisible + 2, only the
  first item, one ellipsis <button> and the last item are rendered. The controller
  decides whether to pass collapsed=true; the PARTIAL never owns toggle state. If a
  wire action is wired on the ellipsis button (l:click="expandBreadcrumb"), the button
  re-renders with collapsed=false; standalone (no wire) the button is inert but still
  keyboard-reachable.

  HREF SCHEME GUARD: the href value is emitted via $unsafe{} ONLY after an explicit
  allowlist check. Only /, #, http://, and https:// prefixes are trusted. An href
  that fails the check causes the item to render as a <span> (no link), preventing
  javascript: or data: URL injection even when the Map value arrives from untrusted data.

  A11y (WAI-ARIA APG Breadcrumb, nav of links):
    - <nav aria-label="${navLabel}">        -- navigation landmark; override for i18n
    - <ol>                                  -- ordered list; one <li> per crumb item
    - <li aria-hidden="true">              -- separator items: invisible to AT
    - <a aria-current="page">              -- current item with href (still a link)
    - <span aria-current="page">           -- current item without href (off tab order)
    - separator <li>: aria-hidden="true"   -- decorative; AT announces nothing
    - ellipsis <button>: keyboard-reachable; aria-label="Show full path"
    - Keyboard: Tab/Shift+Tab/Enter -- fully platform-native; APG says "not applicable"
      for custom keyboard interaction; no arrow-key roving, no focus trap, no enhancer.

  SIZE (type-scaling, NOT toolbar-height; breadcrumbs sit inline in a layout):
    sm  -- --lv-text-xs text, --lv-space-1 inline gap
    md  -- --lv-text-sm text, --lv-space-2 inline gap (default)
    lg  -- --lv-text-base text, --lv-space-3 inline gap

  Params:
    List<Map<String,String>> items  REQUIRED. Ordered crumb list, root-to-current.
                                    Each map: label (required), href (optional),
                                    attrs (optional, TRUSTED raw).
    String navLabel    = "Breadcrumb"  aria-label on the <nav> landmark; override for
                                       i18n or when the page has multiple <nav> regions.
    String separator   = "/"       visual separator rendered between crumb items as
                                   an aria-hidden <li>; use any renderable character.
    boolean collapsed  = false     when true AND items.size() > maxVisible + 2, hides
                                   the middle items behind an ellipsis <button>.
    int maxVisible     = 3         max intermediate crumbs visible before collapsing;
                                   only meaningful when collapsed=true.
    String size        = "md"      "sm" | "md" | "lg" -- scales type, not height.
    String cssClass    = ""        extra utility classes on the root <nav>.

  Usage:
    @@template.lievit.breadcrumb(items = java.util.List.of(
        java.util.Map.of("label", "Home", "href", "/"),
        java.util.Map.of("label", "Properties", "href", "/properties"),
        java.util.Map.of("label", "Via Roma 12")))
    @@template.lievit.breadcrumb(items = trail, collapsed = true, maxVisible = 2)
    @@template.lievit.breadcrumb(items = trail, navLabel = "Navigazione",
        separator = "›", size = "lg")
--%>
@param List<Map<String, String>> items = java.util.List.of()
@param String navLabel = "Breadcrumb"
@param String separator = "/"
@param boolean collapsed = false
@param int maxVisible = 3
@param String size = "md"
@param String cssClass = ""

<%-- Derive size classes (text + inter-item gap). Breadcrumbs are inline display elements,
     NOT toolbar-height-based form controls (architecture contract §5.b). --%>
!{var _textCls = switch (size) {
    case "sm" -> "text-[length:var(--lv-text-xs)]";
    case "lg" -> "text-[length:var(--lv-text-base)]";
    default   -> "text-[length:var(--lv-text-sm)]";
  };}
!{var _gapVar = switch (size) {
    case "sm" -> "var(--lv-space-1)";
    case "lg" -> "var(--lv-space-3)";
    default   -> "var(--lv-space-2)";
  };}

<%-- Determine the effective collapse: only fires when collapsed=true AND the trail is
     long enough that hiding the middle actually helps (first + last always visible,
     middle > maxVisible items). --%>
!{var _n = items.size();}
!{var _doCollapse = collapsed && _n > maxVisible + 2;}

<%-- href scheme allowlist: only /, #, http://, https:// are safe to emit as href.
     A value that fails returns null so the item renders as a non-link span. --%>
<%-- (allowHref is a helper expression used inline per-item below.) --%>

<nav
  data-slot="breadcrumb"
  data-size="${size}"
  aria-label="${navLabel}"
  class="lv-breadcrumb block ${_textCls} ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  <ol
    data-slot="breadcrumb-list"
    class="lv-breadcrumb__list m-0 flex list-none flex-wrap items-center p-0"
    style="gap:${_gapVar};"
  >
    @if(_doCollapse)
      <%-- Collapsed: root + ellipsis + last item only. --%>
      !{var _first = items.get(0);}
      !{var _firstHref = _first.get("href");}
      !{var _firstAllowedHref = (_firstHref != null && (_firstHref.startsWith("/") || _firstHref.startsWith("#") || _firstHref.startsWith("http://") || _firstHref.startsWith("https://"))) ? _firstHref : null;}
      !{var _firstAttrs = _first.getOrDefault("attrs", "");}
      <li data-slot="breadcrumb-item" class="lv-breadcrumb__item inline-flex items-center">
        @if(_firstAllowedHref != null)
          <a
            data-slot="breadcrumb-link"
            class="lv-breadcrumb__link rounded-[var(--lv-radius-sm)] no-underline transition-colors hover:underline focus-visible:shadow-[var(--lv-ring)] focus-visible:outline-none"
            style="color:var(--lv-color-muted-fg);"
            href="${_firstAllowedHref}"
            $unsafe{_firstAttrs}
          >${_first.getOrDefault("label", "")}</a>
        @else
          <span
            data-slot="breadcrumb-link"
            class="lv-breadcrumb__link"
            style="color:var(--lv-color-muted-fg);"
          >${_first.getOrDefault("label", "")}</span>
        @endif
      </li>
      <%-- Separator before ellipsis --%>
      <li aria-hidden="true" class="lv-breadcrumb__separator select-none" style="color:var(--lv-color-muted-fg);">${separator}</li>
      <%-- Ellipsis expander: a <button> so it is keyboard-reachable (APG + spec §8).
           In a standalone PARTIAL context this button is inert (no JS). A consuming
           WIRE template wires l:click="expandBreadcrumb" on it via attrs; that action
           re-renders with collapsed=false. The PARTIAL never owns the toggle state. --%>
      <li data-slot="breadcrumb-item" class="lv-breadcrumb__item inline-flex items-center">
        <button
          type="button"
          data-slot="breadcrumb-ellipsis"
          aria-label="Show full path"
          aria-expanded="false"
          class="lv-breadcrumb__ellipsis inline-flex cursor-pointer items-center rounded-[var(--lv-radius-sm)] border-0 bg-transparent px-[var(--lv-space-1)] focus-visible:shadow-[var(--lv-ring)] focus-visible:outline-none"
          style="color:var(--lv-color-muted-fg);"
        >…</button>
      </li>
      <%-- Separator before last --%>
      <li aria-hidden="true" class="lv-breadcrumb__separator select-none" style="color:var(--lv-color-muted-fg);">${separator}</li>
      <%-- Last (current) item --%>
      !{var _last = items.get(_n - 1);}
      !{var _lastHref = _last.get("href");}
      !{var _lastAllowedHref = (_lastHref != null && (_lastHref.startsWith("/") || _lastHref.startsWith("#") || _lastHref.startsWith("http://") || _lastHref.startsWith("https://"))) ? _lastHref : null;}
      <li data-slot="breadcrumb-item" data-current class="lv-breadcrumb__item inline-flex items-center">
        @if(_lastAllowedHref != null)
          <a
            data-slot="breadcrumb-page"
            class="lv-breadcrumb__current no-underline"
            style="color:var(--lv-color-fg);font-weight:var(--lv-font-medium);"
            href="${_lastAllowedHref}"
            aria-current="page"
          >${_last.getOrDefault("label", "")}</a>
        @else
          <span
            data-slot="breadcrumb-page"
            class="lv-breadcrumb__current"
            style="color:var(--lv-color-fg);font-weight:var(--lv-font-medium);"
            aria-current="page"
          >${_last.getOrDefault("label", "")}</span>
        @endif
      </li>
    @else
      <%-- Full trail: render every item with separators between them. --%>
      @for(int _i = 0; _i < _n; _i++)
        !{var _item = items.get(_i);}
        !{var _isCurrent = _i == _n - 1;}
        !{var _rawHref = _item.get("href");}
        !{var _safeHref = (_rawHref != null && (_rawHref.startsWith("/") || _rawHref.startsWith("#") || _rawHref.startsWith("http://") || _rawHref.startsWith("https://"))) ? _rawHref : null;}
        !{var _itemAttrs = _item.getOrDefault("attrs", "");}
        <%-- Separator before every item except the first --%>
        @if(_i > 0)
          <li aria-hidden="true" class="lv-breadcrumb__separator select-none" style="color:var(--lv-color-muted-fg);">${separator}</li>
        @endif
        @if(_isCurrent)
          <li data-slot="breadcrumb-item" data-current class="lv-breadcrumb__item inline-flex items-center">
            @if(_safeHref != null)
              <%-- Current item has an href: still an <a> (the adopter may link the current
                   page to itself for reload); aria-current="page" marks it per APG. --%>
              <a
                data-slot="breadcrumb-page"
                class="lv-breadcrumb__current no-underline"
                style="color:var(--lv-color-fg);font-weight:var(--lv-font-medium);"
                href="${_safeHref}"
                aria-current="page"
                $unsafe{_itemAttrs}
              >${_item.getOrDefault("label", "")}</a>
            @else
              <%-- Current item without href: a <span aria-current="page">.
                   NOT in tab order (correct; the user is already here). --%>
              <span
                data-slot="breadcrumb-page"
                class="lv-breadcrumb__current"
                style="color:var(--lv-color-fg);font-weight:var(--lv-font-medium);"
                aria-current="page"
              >${_item.getOrDefault("label", "")}</span>
            @endif
          </li>
        @else
          <li data-slot="breadcrumb-item" class="lv-breadcrumb__item inline-flex items-center">
            @if(_safeHref != null)
              <a
                data-slot="breadcrumb-link"
                class="lv-breadcrumb__link rounded-[var(--lv-radius-sm)] no-underline transition-colors hover:underline focus-visible:shadow-[var(--lv-ring)] focus-visible:outline-none"
                style="color:var(--lv-color-muted-fg);"
                href="${_safeHref}"
                $unsafe{_itemAttrs}
              >${_item.getOrDefault("label", "")}</a>
            @else
              <%-- Non-current item without href: a <span>, styled but not interactive. --%>
              <span
                data-slot="breadcrumb-link"
                class="lv-breadcrumb__link"
                style="color:var(--lv-color-muted-fg);"
              >${_item.getOrDefault("label", "")}</span>
            @endif
          </li>
        @endif
      @endfor
    @endif
  </ol>
</nav>
