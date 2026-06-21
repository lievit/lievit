@import java.util.Map
@import io.lievit.kit.GlobalSearchResults
@import io.lievit.kit.GlobalSearchResult
@import io.lievit.kit.page.KitPageView
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

  Server-first / strict-CSP: the field is a real form GET; the results popover is the lievit-ui
  popover partial (native HTML popover, zero JS, light-dismiss + Escape). Every result is a real
  <a href> the browser navigates. Nothing inline-scripts.

  Params:
    page    - the KitPageView render bundle (read .searchAction() + .searchQuery()).
    results - server-prefetched grouped hits for the active term; null => field-only (no popover).
    name    - the search input name (the GET param). Default "q".
    placeholder - the field placeholder.
--%>
@param KitPageView page
@param GlobalSearchResults results = null
@param String name = "q"
@param String placeholder = "Search..."
!{var hasResults = results != null && !results.isEmpty();}
<div data-slot="kit-page-global-search" class="hidden w-[var(--lv-app-shell-search-w,18rem)] min-w-0 sm:block" style="font-family:var(--lv-font-sans);">
  @if(hasResults)
    <%-- Field + grouped-results popover: the field is the trigger, the panel lists hits by group. --%>
    @template.lievit.popover(
      id = "kit-page-search-results",
      align = "end",
      cssClass = "block w-full",
      trigger = @`
        <form role="search" method="get" action="${page.searchAction()}" class="block w-full">
          @template.lievit.input-group(
            name = name, type = "search", value = page.searchQuery(),
            placeholder = placeholder, ariaLabel = placeholder,
            leading = @`@template.lievit.icon(name = "search")`)
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
    <%-- Field only: a real form GET; the server renders the hits into the page body on submit. --%>
    <form role="search" method="get" action="${page.searchAction()}" class="block w-full">
      @template.lievit.input-group(
        name = name, type = "search", value = page.searchQuery(),
        placeholder = placeholder, ariaLabel = placeholder,
        leading = @`@template.lievit.icon(name = "search")`)
    </form>
  @endif
</div>
