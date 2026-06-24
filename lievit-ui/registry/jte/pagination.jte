@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui pagination partial -- APG navigation landmark with numbered page controls.

  TIER: PARTIAL -- pure server-rendered presentation, zero client state.
  The consuming context (a WIRE table, an HTMX fragment, a controller-rendered list) owns
  currentPage and totalPages; this partial receives them as typed @params and renders the
  correct markup. The page links are plain (a href) elements -- a click navigates (Turbo
  Drive intercepts for SPA-like transitions), or the consuming WIRE template replaces them
  with l:click="goToPage" wired (button) elements when navigation must be a wire action
  instead of a URL change. Server-first works trivially: there is nothing client about a
  page indicator. The entire pagination chrome is a pure function of (currentPage,
  totalPages, windowSize, baseUrl) -- all server facts.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA APG Navigation landmark (https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
      with aria-current="page" on the active page link, following the APG Breadcrumb
      aria-current usage (https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/).
      A native (nav) element is the landmark; a native (ol) is the ordered page list;
      real (a href) or (button) elements carry their own keyboard + focus semantics from
      the platform. No roving tabindex, no focus trap, no enhancer required.
    - Inventory reference: Ant Design Pagination (numbered pages, prev/next, ellipsis,
      page-size switcher, quick-jumper, total count, size variants, simple mode) as the
      feature-completeness reference.
    - Sliding window algorithm: deterministic, spec-pinned. Given currentPage (C),
      totalPages (T), windowSize (W, odd >= 3): half = floor(W/2);
      windowStart = max(1, min(C - half, T - W + 1)); windowEnd = min(T, windowStart + W - 1).
      Pages [windowStart..windowEnd] are the visible window. When windowStart > 1: show
      page 1 button, then ellipsis if windowStart > 2. When windowEnd < T: show ellipsis
      if windowEnd < T - 1, then page T button. When showFirstLast=false, omit the
      explicit page-1 and page-T buttons outside the window.
    - Styling: ORIGINAL generation over --lv-* (OKLCH) tokens; look inspired by Tailwind UI
      (NO code copied). Active page uses --lv-color-primary / --lv-color-primary-fg;
      hover uses --lv-color-accent / --lv-color-accent-fg.

  A11y (WAI-ARIA APG Navigation landmark + Breadcrumb aria-current pattern):
    - Outer container: (nav aria-label="${ariaLabel}") -- navigation landmark role.
      aria-label is REQUIRED; default "Pagination". When two navs coexist the caller
      sets distinct ariaLabel values.
    - Page list: (ol) -- ordered list; screen readers announce item count.
    - Page items: (li) wrappers; the (a)/(button) inside is the focusable element.
    - Current page: aria-current="page" on the (a)/(button) -- the ONLY valid token per
      ARIA 1.2 para 6.6.4. Never aria-current="true", never aria-current="false".
      The attribute is omitted entirely on non-current pages (null-drop via JTE).
    - Prev/next: real (a)/(button) with aria-label="Previous page" / "Next page"
      when the content is icon-only (icon-only accessible-name rule).
    - Disabled prev/next at boundary: (button disabled) or (a aria-disabled="true"
      tabindex="-1") -- NOT the href variant, the (a) stays in the DOM but is skipped.
    - Disabled whole control: all (button) get disabled; all (a) get aria-disabled="true"
      + tabindex="-1" + no href; root gets data-disabled for opacity.
    - Ellipsis: (span aria-hidden="true") inside (li) -- never a button or link;
      skipped by screen readers; the numbered context communicates the gap.
    - Simple mode: fraction "Page X / Y" inside aria-live="polite" region; prev/next still.
    - Total summary: (span role="status" aria-live="polite" aria-atomic="true") --
      announces total count to screen readers when the morph updates it.
    - Page-size switcher: native (label)+(select) via native-select partial;
      platform supplies all a11y.
    - Quick jumper: (label for) + (input type="number") + (button type="submit") inside
      (form); platform supplies accessible name + submit on Enter.
    - Keyboard: Tab/Shift+Tab through each (a)/(button) in DOM order (prev, pages, next,
      size-switcher, jumper); Enter activates links/buttons; Space activates buttons.
      Disabled elements are removed from tab order (disabled on button; tabindex="-1" on a).
      No roving tabindex, no trap, no enhancer needed.

  WIRE mode vs URL mode:
    baseUrl set (URL mode) -> (a href="${baseUrl}?page=${n}") real links, Turbo Drive ready.
    baseUrl null (wire mode) -> (button type="button") with data-page="${n}" (SAFE int);
    the caller wires the action via pageAttrs (e.g. pageAttrs='l:click="goToPage"');
    the Java action reads dataset.page. The same template renders both.

  ESCAPING CHANNELS (the XSS decision rule -- same as button.jte):
    attrs / pageAttrs  = TRUSTED raw ($unsafe) -- STATIC author-typed strings only (wire
      directives the author types in the Java template call). A DB-derived value NEVER
      goes here.
    dataAttrs / pageDataAttrs = SAFE escaped (Map of String to String, each value through
      Escape.htmlAttribute) -- any dynamic data goes through this channel.
    data-page="${n}" is an integer rendered directly from the server-side loop variable
      (not from user input), safe to inline; documented here so implementers do not treat
      it as a trusted-raw bypass.

  Params:
    int currentPage              the active page (1-based). REQUIRED.
    int totalPages               total page count; 0 or 1 renders nothing. REQUIRED.
    String baseUrl               = null  URL prefix: links become baseUrl + "?page=" + n.
                                         null = wire mode; page buttons are (button type="button").
    int windowSize               = 5     odd number >= 3 of page buttons visible around currentPage.
    boolean showFirstLast        = true  render explicit page-1 and page-T buttons outside window.
    boolean showPrevNext         = true  render prev (less-than) and next (greater-than) arrow buttons.
    boolean showTotal            = false render a total-items summary before the nav.
    long totalItems              = 0     item count for the summary (read only when showTotal=true).
    boolean showSizeSwitcher     = false render a page-size native-select after the nav.
    java.util.List<Integer> pageSizes = null  options for the size switcher; null uses built-in defaults.
    int currentPageSize          = 10    selected page size for the switcher.
    String pageSizeBaseUrl       = null  URL prefix for page-size links; null = wire mode.
    boolean showJumper           = false render a "Go to page" input + submit button at the end.
    boolean simple               = false simple mode: prev/next + "Page X / Y", no numbered list.
    String size                  = "md"  "sm" | "md" | "lg" -- height-based, toolbar-aligned.
    boolean disabled             = false dims the whole control; removes hrefs; adds aria-disabled.
    String ariaLabel             = "Pagination"  aria-label on the (nav) element.
    String cssClass              = ""    extra utility classes on the outermost wrapper div.
    String attrs                 = ""    TRUSTED raw ($unsafe) -- STATIC author-typed wire directives on root.
    java.util.Map<String,String> dataAttrs = java.util.Map.of()  SAFE dynamic data-* on wrapper.
    String pageAttrs             = ""    TRUSTED raw -- extra attributes on EVERY page (a)/(button).
    java.util.Map<String,String> pageDataAttrs = java.util.Map.of()  SAFE dynamic data-* on each page element.
    gg.jte.Content ellipsisContent = null  custom ellipsis; null = default "..." span.
    gg.jte.Content prevContent   = null  custom prev arrow; null = default chevron-left icon.
    gg.jte.Content nextContent   = null  custom next arrow; null = default chevron-right icon.

  Usage:
    @@template.lievit.pagination(currentPage = 3, totalPages = 10, baseUrl = "/items")
    @@template.lievit.pagination(currentPage = page, totalPages = total,
        baseUrl = "/listings", windowSize = 7, showTotal = true, totalItems = count)
    @@template.lievit.pagination(currentPage = page, totalPages = total,
        pageAttrs = "l:click=\"goToPage\"", showSizeSwitcher = true,
        pageSizes = java.util.List.of(10, 20, 50), currentPageSize = 20)
    @@template.lievit.pagination(currentPage = page, totalPages = total,
        baseUrl = "/results", size = "sm", simple = true)
--%>
@param int currentPage
@param int totalPages
@param String baseUrl = null
@param int windowSize = 5
@param boolean showFirstLast = true
@param boolean showPrevNext = true
@param boolean showTotal = false
@param long totalItems = 0
@param boolean showSizeSwitcher = false
@param java.util.List<Integer> pageSizes = null
@param int currentPageSize = 10
@param String pageSizeBaseUrl = null
@param boolean showJumper = false
@param boolean simple = false
@param String size = "md"
@param boolean disabled = false
@param String ariaLabel = "Pagination"
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String,String> dataAttrs = java.util.Map.of()
@param String pageAttrs = ""
@param java.util.Map<String,String> pageDataAttrs = java.util.Map.of()
@param gg.jte.Content ellipsisContent = null
@param gg.jte.Content prevContent = null
@param gg.jte.Content nextContent = null

<%-- Guard: 0 or 1 total pages needs no chrome at all. --%>
@if(totalPages > 1)

<%-- ------------------------------------------------------------------ --%>
<%-- Computed locals                                                     --%>
<%-- ------------------------------------------------------------------ --%>
!{var urlMode = baseUrl != null;}
!{var cp = Math.max(1, Math.min(currentPage, totalPages));}
!{var prevDisabled = disabled || cp <= 1;}
!{var nextDisabled = disabled || cp >= totalPages;}

<%-- Sliding window algorithm (spec-pinned): --%>
!{var W = Math.max(3, windowSize | 1);}
!{var half = W / 2;}
!{var wStart = Math.max(1, Math.min(cp - half, totalPages - W + 1));}
!{var wEnd = Math.min(totalPages, wStart + W - 1);}

<%-- Height + text classes by size. --%>
!{var heightClass = switch (size) {
    case "sm" -> "h-[var(--lv-space-8)] min-w-[var(--lv-space-8)] text-[length:var(--lv-text-xs)]";
    case "lg" -> "h-[var(--lv-space-10)] min-w-[var(--lv-space-10)] text-[length:var(--lv-text-base)]";
    default   -> "h-[var(--lv-space-9)] min-w-[var(--lv-space-9)] text-[length:var(--lv-text-sm)]";
  };}
!{var padClass = "sm".equals(size) ? "px-[var(--lv-space-2)]" : "px-[var(--lv-space-3)]";}

<%-- Base button-like classes shared by every interactive page element. --%>
!{var btnBase = heightClass + " inline-flex items-center justify-center rounded-[var(--lv-radius-md)] font-[var(--lv-font-medium)] leading-none select-none transition-colors focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] no-underline";}
!{var btnIdle = btnBase + " text-[var(--lv-color-fg)] hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)]";}
!{var btnCurrent = btnBase + " bg-[var(--lv-color-primary)] text-[var(--lv-color-primary-fg)]";}
!{var btnDisabled = btnBase + " text-[var(--lv-color-muted)] opacity-50 cursor-not-allowed";}

<%-- Safe dynamic data-* fragment for the wrapper. --%>
!{var wrapperData = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      wrapperData.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), wrapperData);
      wrapperData.writeContent("\"");
    }
  }}

<%-- Safe dynamic data-* fragment for each page element. --%>
!{var pageDataMarkup = new StringOutput();}
!{for (var e : pageDataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      pageDataMarkup.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), pageDataMarkup);
      pageDataMarkup.writeContent("\"");
    }
  }}

<%-- Default page-sizes when none provided by caller. --%>
!{var effectiveSizes = (pageSizes != null) ? pageSizes : java.util.List.of(10, 20, 50, 100);}

<%-- Stable instance id for pairing labels with inputs (avoids collisions when multiple instances coexist). --%>
!{var instanceId = "pag-" + Integer.toHexString(System.identityHashCode(ariaLabel) ^ (currentPage * 31) ^ totalPages);}

<div
  data-slot="pagination"
  data-size="${size}"
  data-disabled="${disabled ? "true" : null}"
  class="inline-flex flex-wrap items-center gap-[var(--lv-space-4)] font-[var(--lv-font-sans)] ${cssClass}"
  $unsafe{wrapperData.toString()}
  $unsafe{attrs}
>

  <%-- Optional total summary (before the nav) --%>
  @if(showTotal)
  <span
    role="status"
    aria-live="polite"
    aria-atomic="true"
    data-slot="pagination-total"
    class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted)]"
  >Total ${totalItems} items</span>
  @endif

  <nav aria-label="${ariaLabel}" data-slot="pagination-nav">
    <ol
      data-slot="pagination-list"
      class="flex flex-row items-center gap-[var(--lv-space-1)] list-none m-0 p-0"
    >

      <%-- Prev button --%>
      @if(showPrevNext)
      <li data-slot="pagination-item">
        @if(urlMode && !prevDisabled)
        <a
          href="${baseUrl}?page=${cp - 1}"
          aria-label="Previous page"
          data-slot="pagination-prev"
          class="${btnIdle} ${padClass}"
          $unsafe{pageDataMarkup.toString()}
          $unsafe{pageAttrs}
        >@if(prevContent != null)${prevContent}@else@template.lievit.icon(name = "chevron-left", size = "1em")@endif</a>
        @elseif(!urlMode && !prevDisabled)
        <button
          type="button"
          aria-label="Previous page"
          data-slot="pagination-prev"
          data-page="${cp - 1}"
          class="${btnIdle} ${padClass}"
          $unsafe{pageDataMarkup.toString()}
          $unsafe{pageAttrs}
        >@if(prevContent != null)${prevContent}@else@template.lievit.icon(name = "chevron-left", size = "1em")@endif</button>
        @elseif(urlMode && prevDisabled)
        <a
          aria-label="Previous page"
          aria-disabled="true"
          tabindex="-1"
          data-slot="pagination-prev"
          class="${btnDisabled} ${padClass}"
        >@if(prevContent != null)${prevContent}@else@template.lievit.icon(name = "chevron-left", size = "1em")@endif</a>
        @else
        <button
          type="button"
          disabled
          aria-label="Previous page"
          data-slot="pagination-prev"
          class="${btnDisabled} ${padClass}"
        >@if(prevContent != null)${prevContent}@else@template.lievit.icon(name = "chevron-left", size = "1em")@endif</button>
        @endif
      </li>
      @endif

      <%-- Simple mode: fraction only, no numbered list --%>
      @if(simple)
      <li data-slot="pagination-item">
        <span
          aria-live="polite"
          data-slot="pagination-simple-label"
          class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] ${padClass}"
        >Page ${cp} / ${totalPages}</span>
      </li>

      @else
      <%-- Full numbered list --%>

      <%-- Page 1 anchor (when windowStart > 1 and showFirstLast) --%>
      @if(showFirstLast && wStart > 1)
      <li data-slot="pagination-item">
        @if(urlMode && !disabled)
        <a
          href="${baseUrl}?page=1"
          aria-current="${1 == cp ? "page" : null}"
          data-slot="pagination-page"
          data-page="1"
          class="${1 == cp ? btnCurrent : btnIdle}"
          $unsafe{pageDataMarkup.toString()}
          $unsafe{pageAttrs}
        >1</a>
        @elseif(!urlMode && !disabled)
        <button
          type="button"
          aria-current="${1 == cp ? "page" : null}"
          data-slot="pagination-page"
          data-page="1"
          class="${1 == cp ? btnCurrent : btnIdle}"
          $unsafe{pageDataMarkup.toString()}
          $unsafe{pageAttrs}
        >1</button>
        @elseif(urlMode)
        <a
          aria-disabled="true"
          tabindex="-1"
          aria-current="${1 == cp ? "page" : null}"
          data-slot="pagination-page"
          data-page="1"
          class="${1 == cp ? btnCurrent : btnDisabled}"
        >1</a>
        @else
        <button
          type="button"
          disabled
          aria-current="${1 == cp ? "page" : null}"
          data-slot="pagination-page"
          data-page="1"
          class="${1 == cp ? btnCurrent : btnDisabled}"
        >1</button>
        @endif
      </li>
      <%-- Leading ellipsis (when gap between page 1 and window start) --%>
      @if(wStart > 2)
      <li data-slot="pagination-item">
        @if(ellipsisContent != null)
        <span aria-hidden="true" data-slot="pagination-ellipsis">${ellipsisContent}</span>
        @else
        <span
          aria-hidden="true"
          data-slot="pagination-ellipsis"
          class="${heightClass} inline-flex items-center justify-center text-[var(--lv-color-muted)]"
        >@template.lievit.icon(name = "ellipsis", size = "1em")</span>
        @endif
      </li>
      @endif
      @endif

      <%-- Sliding window --%>
      @for(int p = wStart; p <= wEnd; p++)
      <li data-slot="pagination-item">
        @if(urlMode && !disabled)
        <a
          href="${baseUrl}?page=${p}"
          aria-current="${p == cp ? "page" : null}"
          data-slot="pagination-page"
          data-page="${p}"
          class="${p == cp ? btnCurrent : btnIdle}"
          $unsafe{pageDataMarkup.toString()}
          $unsafe{pageAttrs}
        >${p}</a>
        @elseif(!urlMode && !disabled)
        <button
          type="button"
          aria-current="${p == cp ? "page" : null}"
          data-slot="pagination-page"
          data-page="${p}"
          class="${p == cp ? btnCurrent : btnIdle}"
          $unsafe{pageDataMarkup.toString()}
          $unsafe{pageAttrs}
        >${p}</button>
        @elseif(urlMode)
        <a
          aria-disabled="true"
          tabindex="-1"
          aria-current="${p == cp ? "page" : null}"
          data-slot="pagination-page"
          data-page="${p}"
          class="${p == cp ? btnCurrent : btnDisabled}"
        >${p}</a>
        @else
        <button
          type="button"
          disabled
          aria-current="${p == cp ? "page" : null}"
          data-slot="pagination-page"
          data-page="${p}"
          class="${p == cp ? btnCurrent : btnDisabled}"
        >${p}</button>
        @endif
      </li>
      @endfor

      <%-- Trailing ellipsis + last page anchor (when windowEnd < totalPages and showFirstLast) --%>
      @if(showFirstLast && wEnd < totalPages)
      @if(wEnd < totalPages - 1)
      <li data-slot="pagination-item">
        @if(ellipsisContent != null)
        <span aria-hidden="true" data-slot="pagination-ellipsis">${ellipsisContent}</span>
        @else
        <span
          aria-hidden="true"
          data-slot="pagination-ellipsis"
          class="${heightClass} inline-flex items-center justify-center text-[var(--lv-color-muted)]"
        >@template.lievit.icon(name = "ellipsis", size = "1em")</span>
        @endif
      </li>
      @endif
      <li data-slot="pagination-item">
        @if(urlMode && !disabled)
        <a
          href="${baseUrl}?page=${totalPages}"
          aria-current="${totalPages == cp ? "page" : null}"
          data-slot="pagination-page"
          data-page="${totalPages}"
          class="${totalPages == cp ? btnCurrent : btnIdle}"
          $unsafe{pageDataMarkup.toString()}
          $unsafe{pageAttrs}
        >${totalPages}</a>
        @elseif(!urlMode && !disabled)
        <button
          type="button"
          aria-current="${totalPages == cp ? "page" : null}"
          data-slot="pagination-page"
          data-page="${totalPages}"
          class="${totalPages == cp ? btnCurrent : btnIdle}"
          $unsafe{pageDataMarkup.toString()}
          $unsafe{pageAttrs}
        >${totalPages}</button>
        @elseif(urlMode)
        <a
          aria-disabled="true"
          tabindex="-1"
          aria-current="${totalPages == cp ? "page" : null}"
          data-slot="pagination-page"
          data-page="${totalPages}"
          class="${totalPages == cp ? btnCurrent : btnDisabled}"
        >${totalPages}</a>
        @else
        <button
          type="button"
          disabled
          aria-current="${totalPages == cp ? "page" : null}"
          data-slot="pagination-page"
          data-page="${totalPages}"
          class="${totalPages == cp ? btnCurrent : btnDisabled}"
        >${totalPages}</button>
        @endif
      </li>
      @endif

      @endif
      <%-- end full numbered list --%>

      <%-- Next button --%>
      @if(showPrevNext)
      <li data-slot="pagination-item">
        @if(urlMode && !nextDisabled)
        <a
          href="${baseUrl}?page=${cp + 1}"
          aria-label="Next page"
          data-slot="pagination-next"
          class="${btnIdle} ${padClass}"
          $unsafe{pageDataMarkup.toString()}
          $unsafe{pageAttrs}
        >@if(nextContent != null)${nextContent}@else@template.lievit.icon(name = "chevron-right", size = "1em")@endif</a>
        @elseif(!urlMode && !nextDisabled)
        <button
          type="button"
          aria-label="Next page"
          data-slot="pagination-next"
          data-page="${cp + 1}"
          class="${btnIdle} ${padClass}"
          $unsafe{pageDataMarkup.toString()}
          $unsafe{pageAttrs}
        >@if(nextContent != null)${nextContent}@else@template.lievit.icon(name = "chevron-right", size = "1em")@endif</button>
        @elseif(urlMode && nextDisabled)
        <a
          aria-label="Next page"
          aria-disabled="true"
          tabindex="-1"
          data-slot="pagination-next"
          class="${btnDisabled} ${padClass}"
        >@if(nextContent != null)${nextContent}@else@template.lievit.icon(name = "chevron-right", size = "1em")@endif</a>
        @else
        <button
          type="button"
          disabled
          aria-label="Next page"
          data-slot="pagination-next"
          class="${btnDisabled} ${padClass}"
        >@if(nextContent != null)${nextContent}@else@template.lievit.icon(name = "chevron-right", size = "1em")@endif</button>
        @endif
      </li>
      @endif

    </ol>
  </nav>

  <%-- Optional page-size switcher (composes native-select + label partials) --%>
  @if(showSizeSwitcher)
  <div data-slot="pagination-size-switcher" class="flex items-center gap-[var(--lv-space-2)]">
    @template.lievit.native-select(
      name = "pageSize",
      id = instanceId + "-size",
      label = "Items per page",
      size = size,
      value = String.valueOf(currentPageSize),
      disabled = disabled,
      content = null,
      options = effectiveSizes.stream().map(n -> n + " / page").collect(java.util.stream.Collectors.toList())
    )
  </div>
  @endif

  <%-- Optional quick jumper --%>
  @if(showJumper)
  <form
    data-slot="pagination-jumper"
    class="flex items-center gap-[var(--lv-space-2)]"
  >
    <label
      for="${instanceId}-jump"
      class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] whitespace-nowrap"
    >Go to page</label>
    <input
      id="${instanceId}-jump"
      type="number"
      min="1"
      max="${totalPages}"
      placeholder="${cp}"
      class="${heightClass} w-[var(--lv-space-12)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-mono)] text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)]"
      style="appearance:textfield;"
    />
    <button
      type="submit"
      class="${btnIdle} ${padClass}"
    >Go</button>
  </form>
  @endif

</div>

@endif
<%-- totalPages <= 1: render nothing --%>
