@import java.util.Map
@import java.util.LinkedHashMap
@import dev.lievit.kit.GlobalSearchResults
@import dev.lievit.kit.GlobalSearchResult
@import dev.lievit.kit.page.KitPageView
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.page.global-search - the Filament topbar GLOBAL SEARCH (fi-global-search),
  rendered onto the lievit-ui input-group + icon (the search field) and, when results are present,
  the popover partial (the grouped-results panel). The Filament livewire/global-search.blade: a
  search input with a leading magnifier, and a results panel of category GROUPS, each a list of
  result links (title + optional detail dl), or a no-results message.

  TWO modes, ONE constant root <div> (the JTE static-checker forbids an @if/@else opening a different
  root tag per branch, so the conditional stays inside):
    - FIELD ONLY (the default + the JS-off path): a real <form method=get action=searchAction> with a
      token-styled input (name=q, echoing the active term). Submitting reloads the page with ?q=..,
      the server renders the hits into the page body. Correct with zero JS.
    - FIELD + RESULTS POPOVER: when a GlobalSearchResults is passed (a server-side prefetch of hits
      for the current term), the same field becomes the trigger of a native-popover panel listing the
      grouped results as real <a href> links (the Filament grouped dropdown), or a no-results line.

  MOBILE MAGNIFIER POPOVER (issue #495, ADR sw-architecture-008 backflow): below the `sm` breakpoint
  the inline search field is `hidden`, so on a phone the topbar had NO search at all. Filament
  collapses search into a magnifier icon-button that opens the field. We mirror that: a `sm:hidden`
  magnifier button that toggles a native-HTML-popover panel (lievit.popover -> CSP-clean, zero JS,
  top-layer, Escape + outside-click dismiss) holding the SAME GET search form. The desktop inline
  field is `hidden sm:block` and the mobile trigger is `sm:hidden`, so exactly one is shown per
  breakpoint and the search form is never duplicated to the user (only in the markup, for the two
  layouts). The form is the SAME real GET (works JS-off once the popover is open); the
  grouped-results popover is desktop-only (it is a server prefetch of the active term, surfaced on
  the inline field).

  EXTERNAL FINDER SUPPORT (issue #494 companion param, ADR sw-architecture-008 backflow): the search
  may target an app whose finder expects a different query param name and extra fixed GET fields.
  A GET form discards the action URL's query string and replaces it with the form fields, so extra
  selectors MUST ride as hidden inputs, not baked in the action. Two extra params carry this:
  `name` (the query field name, default "q") and `hidden` (fixed extra fields). The kit default
  (name "q", no hidden) is unchanged so existing adopters are unaffected.

  Server-first / strict-CSP: the field is a real form GET; the results popover + the mobile-search
  popover are the lievit-ui popover partial (native HTML popover, zero JS, light-dismiss + Escape).
  Every result is a real <a href> the browser navigates. Nothing inline-scripts.

  Params:
    page        - the KitPageView render bundle (read .searchAction() + .searchQuery()).
    results     - server-prefetched grouped hits for the active term; null => field-only (no popover).
    name        - the search input name (the GET param). Default "q".
    placeholder - the field placeholder. Default "Search...".
    hidden      - fixed extra GET fields rendered as hidden inputs (e.g. a legacy selector).
                  Empty by default. ADR sw-architecture-008 backflow.
--%>
@param KitPageView page
@param GlobalSearchResults results = null
@param String name = "q"
@param String placeholder = "Search..."
@param Map<String, String> hidden = new LinkedHashMap<>()
!{var hasResults = results != null && !results.isEmpty();}
<%-- Topbar search-field surface (issue: the global-search field had no visible background and did
     not read as a field on the brand band). Drive the input-group bg + border to the veiled,
     semi-transparent --lv-color-topbar-search-* tokens (built from currentColor, so the veil reads
     on the navy AND the green band as well as the light default). Set as Tailwind arbitrary
     properties (--lv-group-bg / --lv-group-border), which input-group resolves on its own surface
     without a conflicting second bg- utility. --%>
!{var searchFieldClass = "[--lv-group-bg:var(--lv-color-topbar-search-bg)] [--lv-group-border:var(--lv-color-topbar-search-border)]";}
<%-- The plain GET search form, rendered into both the desktop inline field and the mobile popover so
     the two layouts share one form definition. A GET form discards the action's query string and uses
     its own fields, so any extra `hidden` selectors ride as hidden inputs. --%>
!{gg.jte.Content searchForm = @`
  <form role="search" method="get" action="${page.searchAction()}" class="block w-full">
    @for(Map.Entry<String, String> h : hidden.entrySet())
      <input type="hidden" name="${h.getKey()}" value="${h.getValue()}">
    @endfor
    @template.lievit.input-group(
      ariaLabel = placeholder,
      cssClass = searchFieldClass,
      leadingAddon = @`@template.lievit.icon(name = "search")`,
      content = @`<input type="search" name="${name}" value="${page.searchQuery()}" placeholder="${placeholder}" class="w-full border-0 bg-transparent pl-[var(--lv-space-2)] pr-0 py-0 outline-none focus:ring-0" style="font:inherit;color:inherit;">`)
  </form>
`;}
<%-- Mobile magnifier (issue #495): below `sm` the inline field is hidden, so this Filament-style
     icon-button opens the search in a native-popover panel. CSP-clean: lievit.popover is the native
     HTML popover, no inline handler. ADR sw-architecture-008 backflow. --%>
<div data-slot="kit-page-global-search-mobile" class="sm:hidden">
  @template.lievit.popover(
    id = "kit-page-search-mobile",
    placement = "bottom-end",
    trigger = @`
      <span data-slot="kit-page-search-mobile-trigger"
            class="inline-flex h-[var(--lv-space-9)] w-[var(--lv-space-9)] items-center justify-center rounded-[var(--lv-radius-md)] hover:bg-[var(--lv-color-accent)]"
            aria-label="${placeholder}">
        @template.lievit.icon(name = "search")
      </span>
    `,
    content = @`
      <div class="w-[min(20rem,calc(100vw-var(--lv-space-8)))]">
        ${searchForm}
      </div>
    `)
</div>
<div data-slot="kit-page-global-search" class="hidden w-[var(--lv-app-shell-search-w,18rem)] min-w-0 sm:block" style="font-family:var(--lv-font-sans);">
  @if(hasResults)
    <%-- Field + grouped-results popover: the field is the trigger, the panel lists hits by group.
         v-next: popover align= -> placement=; input-group is now a layout wrapper (content= slot). --%>
    @template.lievit.popover(
      id = "kit-page-search-results",
      placement = "bottom-end",
      cssClass = "block w-full",
      trigger = @`
        <form role="search" method="get" action="${page.searchAction()}" class="block w-full">
          @for(Map.Entry<String, String> h : hidden.entrySet())
            <input type="hidden" name="${h.getKey()}" value="${h.getValue()}">
          @endfor
          @template.lievit.input-group(
            ariaLabel = placeholder,
            cssClass = searchFieldClass,
            leadingAddon = @`@template.lievit.icon(name = "search")`,
            content = @`<input type="search" name="${name}" value="${page.searchQuery()}" placeholder="${placeholder}" class="w-full border-0 bg-transparent pl-[var(--lv-space-2)] pr-0 py-0 outline-none focus:ring-0" style="font:inherit;color:inherit;">`)
        </form>
      `,
      content = @`
        <div data-slot="kit-page-search-groups" class="flex w-[var(--lv-space-80,20rem)] max-w-[calc(100vw-var(--lv-space-4))] flex-col gap-[var(--lv-space-3)]">
          @for(String group : results.groups())
            <section data-search-group="${group}" class="flex flex-col gap-[var(--lv-space-1)]">
              <h2 class="px-[var(--lv-space-1)] text-[length:var(--lv-text-xs)] font-[var(--lv-font-semibold)] uppercase tracking-wide text-[var(--lv-color-muted-fg)]">${group}</h2>
              @for(GlobalSearchResult hit : results.resultsFor(group))
                <a href="${hit.url()}" data-search-result class="flex flex-col gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] px-[var(--lv-space-2)] py-[var(--lv-space-2)] no-underline hover:bg-[var(--lv-color-accent)]">
                  <span class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]">${hit.title()}</span>
                  @if(!hit.details().isEmpty())
                    <dl class="m-0 flex flex-wrap gap-x-[var(--lv-space-3)] text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)]">
                      @for(Map.Entry<String, String> d : hit.details().entrySet())
                        <div class="flex gap-[var(--lv-space-1)]"><dt class="font-[var(--lv-font-medium)]">${d.getKey()}:</dt><dd class="m-0">${d.getValue()}</dd></div>
                      @endfor
                    </dl>
                  @endif
                </a>
              @endfor
            </section>
          @endfor
        </div>
      `)
  @else
    <%-- Field only: a real form GET; the server renders the hits into the page body on submit.
         v-next: input-group is now a layout wrapper (content= slot). --%>
    ${searchForm}
  @endif
</div>
