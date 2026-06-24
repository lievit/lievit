<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  navigation-menu/link partial -- one focusable item in a navigation-menu: either a top-level
  leaf <a> link or a plain panel link (inside a navigation-menu/menu panel).

  TIER: PARTIAL -- pure server-rendered presentation, no client state.

  STRUCTURE (APG Disclosure Navigation leaf link):
    Top-level leaf link: a real <a href> in natural Tab order. Carries data-lievit-item so
    collection-nav.enhancer.ts can include it in the arrow-key / typeahead supplemental nav.
    Panel link: same <a>, rendered as a richer row (icon + label + optional description), placed
    inside the panel <ul> of navigation-menu/menu. Does NOT carry data-lievit-item (panel links
    are NOT in the top-level collection; Tab naturally reaches them when the panel is open).

  A11y:
    - Real <a> anchor: browser gives role=link + Tab focus + Enter navigation for free.
    - aria-current="page" when href matches the active route (server-supplied via activeHref).
    - Disabled: aria-disabled="true" + href omitted (NOT native `disabled`, which does not apply
      to <a>). The link remains focusable so Tab still reaches it (APG recommendation for disabled
      links; they are informational even when blocked).
    - Icon (when rendered): aria-hidden="true" via the icon partial's default (decorative).
    - Badge (when rendered): aria-hidden="true" (decorative; the label provides the accessible name).

  Params:
    String href                   the destination href; omitted (href not set) when disabled.
    String label                  the visible link text.
    String activeHref = ""        the current page href; when href == activeHref the link gets
                                    aria-current="page" and the active accent style.
    String description = null     optional sub-description beneath the label (panel rows only).
    String icon = null            optional Lucide icon name (decorative; aria-hidden via icon partial).
    String badge = null           optional badge text (e.g. "New"); aria-hidden.
    boolean disabled = false      aria-disabled="true" + href omitted.
    boolean inPanel = false       true => richer in-panel row style; false => top-level pill style.
    String cssClass = ""          extra utility classes on the <a>.
--%>
@param String href
@param String label
@param String activeHref = ""
@param String description = null
@param String icon = null
@param String badge = null
@param boolean disabled = false
@param boolean inPanel = false
@param String cssClass = ""

!{boolean _isActive = href != null && !href.isBlank() && href.equals(activeHref);}
!{var _href = disabled ? null : href;}
!{var _ariaCurrent = _isActive ? "page" : null;}
!{var _ariaDisabled = disabled ? "true" : null;}

@if(inPanel)
<%-- PANEL LINK: richer row with optional icon + description. Not in the top-level collection. --%>
<li role="listitem">
  <a
    href="${_href}"
    data-slot="navigation-menu-panel-link"
    aria-current="${_ariaCurrent}"
    aria-disabled="${_ariaDisabled}"
    class="flex items-start rounded-[var(--lv-radius-sm)] outline-none focus-visible:shadow-[var(--lv-ring)] ${disabled ? "cursor-not-allowed opacity-[0.5]" : "hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)]"} ${_isActive ? "bg-[var(--lv-color-accent)]" : ""} ${cssClass}"
    style="gap:var(--lv-space-2);padding:var(--lv-space-2) var(--lv-space-3);color:var(--lv-color-fg);text-decoration:none;transition:background var(--lv-duration-fast) var(--lv-ease),color var(--lv-duration-fast) var(--lv-ease);"
  >
    @if(icon != null && !icon.isBlank())
      <span aria-hidden="true" style="flex-shrink:0;display:inline-flex;margin-top:2px;">@template.lievit.icon(name = icon, size = "1rem")</span>
    @endif
    <span style="display:flex;flex-direction:column;gap:2px;min-width:0;">
      <span style="font-weight:var(--lv-font-medium);line-height:var(--lv-leading);">${label}@if(badge != null && !badge.isBlank())&nbsp;<span aria-hidden="true" style="display:inline-flex;align-items:center;border-radius:9999px;padding:0 var(--lv-space-2);font-size:var(--lv-text-xs);font-weight:var(--lv-font-medium);background:var(--lv-color-accent);color:var(--lv-color-accent-fg);">${badge}</span>@endif</span>
      @if(description != null && !description.isBlank())
        <span style="color:var(--lv-color-muted-fg);font-size:var(--lv-text-xs);line-height:1.4;">${description}</span>
      @endif
    </span>
  </a>
</li>
@else
<%-- TOP-LEVEL LEAF LINK: pill style; in the collection for arrow-key nav. --%>
<li role="listitem">
  <a
    href="${_href}"
    data-slot="navigation-menu-link"
    data-lievit-item
    aria-current="${_ariaCurrent}"
    aria-disabled="${_ariaDisabled}"
    class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-sm)] whitespace-nowrap outline-none focus-visible:shadow-[var(--lv-ring)] ${disabled ? "cursor-not-allowed opacity-[0.5]" : "hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)]"} ${_isActive ? "border-b-2 border-[var(--lv-color-primary)] font-[var(--lv-font-medium)]" : ""} ${cssClass}"
    style="min-height:var(--lv-nm-trigger-h,var(--lv-space-9));padding:0 var(--lv-space-3);color:var(--lv-color-fg);text-decoration:none;font-size:var(--lv-text-sm);transition:background var(--lv-duration-fast) var(--lv-ease),color var(--lv-duration-fast) var(--lv-ease);"
  >
    @if(icon != null && !icon.isBlank())
      @template.lievit.icon(name = icon, size = "1rem")
    @endif
    ${label}
    @if(badge != null && !badge.isBlank())
      <span aria-hidden="true" style="display:inline-flex;align-items:center;border-radius:9999px;padding:0 var(--lv-space-2);font-size:var(--lv-text-xs);font-weight:var(--lv-font-medium);background:var(--lv-color-accent);color:var(--lv-color-accent-fg);">${badge}</span>
    @endif
  </a>
</li>
@endif
