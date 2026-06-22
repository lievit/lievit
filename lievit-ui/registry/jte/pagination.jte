@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui :: pagination (static JTE partial)

  Page navigation: previous / next plus a windowed list of numbered page links with
  ellipsis gaps. Mirrors shadcn's Pagination / PaginationContent / PaginationItem /
  PaginationLink / PaginationPrevious / PaginationNext / PaginationEllipsis.

  Tier rationale (planning two-tier model): pure presentation, no client state. The
  page links are REAL <a> elements (server-rendered hrefs), so the control works with
  JavaScript disabled, which a Lit island could not claim. JTE partial it is.

  SHAPE DECISION (scientific rule). shadcn/MUI/Radix were compared for how the page list
  is produced. shadcn leaves the item list to the caller (hand-written <PaginationItem>s);
  MUI's <Pagination> DERIVES the windowed list (first, last, current +/- siblings, ellipsis
  for gaps) from count/page/siblingCount. MUI wins criterion (4) ergonomics + (5) robustness
  for the no-JS server case: the caller passes the page math (current + total), the partial
  computes the visible window once, so every page renders a correct, consistent control with
  no per-call boilerplate. We adopt MUI's derivation with shadcn's markup/token styling.

  HREF: page links are built from a printf-style `hrefPattern` (one %d placeholder for the
  page number), e.g. "/contatti?page=%d". This keeps the partial query-string-agnostic: the
  caller owns the URL shape, the partial only substitutes the number. A real <a href> per page.

  Accessibility (shadcn + APG): the root is <nav aria-label> so AT lands on a named landmark;
  the active page carries aria-current="page" and is a non-link <span> (you cannot navigate to
  where you already are); prev/next at the boundary become aria-disabled <span> (still in the
  DOM for layout, not focusable); the ellipsis is aria-hidden with an sr-only "More pages".
  The chevron icons are decorative (Lucide partial, aria-hidden) with sr-only text labels.

  Params:
    int    current      the active page (1-based).
    int    total        the total number of pages (>= 1).
    String hrefPattern  printf pattern for a page URL; one %d = the page number.
    int    siblings     pages shown either side of current before collapsing to "...". Default 1.
    String ariaLabel    the <nav> accessible name. Default "Pagination".
    String prevLabel    sr-only text for the previous control. Default "Previous page".
    String nextLabel    sr-only text for the next control. Default "Next page".
    boolean inline      when false (default) the <nav> is full-width + centered (mx-auto w-full
                        justify-center), the standalone control under a list. When true it drops those
                        so the pager sits inline (its intrinsic width, no self-centering): for a host
                        row that already lays it out, e.g. the kit table footer's justify-between row
                        (count left | per-page + pager clustered right). Filament's footer layout.
    String klass        extra classes on the <nav>.

  asChild / router-Link (server-first): shadcn's PaginationLink takes `asChild` so the page
  links can be a framework router-Link instead of a bare <a>. Server-side the element stays a
  real <a href> (no-JS correctness), but the caller can OPT IN extra attributes on every
  navigable link via `linkAttrs` (a raw attribute string, output with $unsafe so it lands as
  markup, not escaped text), e.g. an htmx/Turbo/router hook that upgrades the anchor to an
  in-place navigation: `linkAttrs = "hx-boost=\"true\" hx-target=\"#list\""`. This is the
  server-first analogue of asChild: same accessible anchor, with the adopter's router wiring
  attached. Left blank, nothing is injected. Only the navigable links (prev / numbered / next)
  receive it; the disabled boundary spans and the ellipsis do not.

  Usage:
    @@template.lievit.pagination(current = 3, total = 10, hrefPattern = "/contatti?page=%d")
    @@template.lievit.pagination(current = page, total = totalPages, hrefPattern = "/listings?p=%d&q=" + query, siblings = 2)
    @@template.lievit.pagination(current = page, total = totalPages, hrefPattern = "/listings?p=%d",
      linkAttrs = "hx-boost=\"true\" hx-target=\"#list\"")
    @@template.lievit.pagination(current = page, total = totalPages, hrefPattern = "/attivita?page=%d", inline = true)
--%>
@param int current
@param int total
@param String hrefPattern
@param int siblings = 1
@param String ariaLabel = "Pagination"
@param String prevLabel = "Previous page"
@param String nextLabel = "Next page"
@param String linkAttrs = ""
@param boolean inline = false
@param String klass = ""

!{var page = Math.max(1, Math.min(current, total));}
!{var hasPrev = page > 1;}
!{var hasNext = page < total;}
<%-- Windowed page list (MUI derivation): first + last always, current +/- siblings, gaps -> -1 sentinel (ellipsis). --%>
!{var pages = new java.util.ArrayList<Integer>();}
!{var lastShown = 0;}
@for(int p = 1; p <= total; p++)
  !{boolean show = p == 1 || p == total || (p >= page - siblings && p <= page + siblings);}
  @if(show)
    @if(lastShown != 0 && p - lastShown > 1)
      !{pages.add(-1);}
    @endif
    !{pages.add(p);}
    !{lastShown = p;}
  @endif
@endfor

<%-- Layout classes: standalone (default) is full-width + self-centered; inline drops mx-auto/w-full/
     justify-center so the host row (e.g. the kit footer's justify-between) lays the pager out. --%>
!{var layout = inline ? "flex" : "mx-auto flex w-full justify-center";}
<nav
  role="navigation"
  aria-label="${ariaLabel}"
  data-slot="pagination"
  data-inline="${inline}"
  class="${layout} ${klass}"
>
  <ul data-slot="pagination-content" class="flex flex-row items-center gap-[var(--lv-space-1)]" style="list-style:none;margin:0;padding:0;font-family:var(--lv-font-sans);">
    <%-- Previous --%>
    <li data-slot="pagination-item">
      @if(hasPrev)
        <a
          href="${hrefPattern.formatted(page - 1)}"
          $unsafe{linkAttrs}
          aria-label="${prevLabel}"
          data-slot="pagination-previous"
          class="inline-flex h-[var(--lv-space-9)] items-center justify-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] no-underline transition-colors hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
        >
          @template.lievit.icon(name = "chevron-left", size = "1rem")
          <span aria-hidden="true">Prev</span>
        </a>
      @else
        <span
          aria-label="${prevLabel}"
          aria-disabled="true"
          data-slot="pagination-previous"
          class="inline-flex h-[var(--lv-space-9)] items-center justify-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)] opacity-50 select-none"
        >
          @template.lievit.icon(name = "chevron-left", size = "1rem")
          <span aria-hidden="true">Prev</span>
        </span>
      @endif
    </li>

    <%-- Numbered pages + ellipsis --%>
    @for(int p : pages)
      <li data-slot="pagination-item">
        @if(p == -1)
          <span
            aria-hidden="true"
            data-slot="pagination-ellipsis"
            class="flex h-[var(--lv-space-9)] w-[var(--lv-space-9)] items-center justify-center text-[var(--lv-color-muted-fg)]"
          >
            @template.lievit.icon(name = "ellipsis", size = "1rem")
            <span class="sr-only">More pages</span>
          </span>
        @elseif(p == page)
          <a
            href="${hrefPattern.formatted(p)}"
            $unsafe{linkAttrs}
            aria-current="page"
            data-slot="pagination-link"
            data-active="true"
            class="inline-flex h-[var(--lv-space-9)] w-[var(--lv-space-9)] items-center justify-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-accent)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-accent-fg)] no-underline transition-colors focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
          >${p}</a>
        @else
          <a
            href="${hrefPattern.formatted(p)}"
            $unsafe{linkAttrs}
            aria-label="Go to page ${p}"
            data-slot="pagination-link"
            class="inline-flex h-[var(--lv-space-9)] w-[var(--lv-space-9)] items-center justify-center rounded-[var(--lv-radius-md)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] no-underline transition-colors hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
          >${p}</a>
        @endif
      </li>
    @endfor

    <%-- Next --%>
    <li data-slot="pagination-item">
      @if(hasNext)
        <a
          href="${hrefPattern.formatted(page + 1)}"
          $unsafe{linkAttrs}
          aria-label="${nextLabel}"
          data-slot="pagination-next"
          class="inline-flex h-[var(--lv-space-9)] items-center justify-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] no-underline transition-colors hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
        >
          <span aria-hidden="true">Next</span>
          @template.lievit.icon(name = "chevron-right", size = "1rem")
        </a>
      @else
        <span
          aria-label="${nextLabel}"
          aria-disabled="true"
          data-slot="pagination-next"
          class="inline-flex h-[var(--lv-space-9)] items-center justify-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)] opacity-50 select-none"
        >
          <span aria-hidden="true">Next</span>
          @template.lievit.icon(name = "chevron-right", size = "1rem")
        </span>
      @endif
    </li>
  </ul>
</nav>
