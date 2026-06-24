@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  navigation-menu/menu partial -- one disclosure item in a navigation-menu: a <button
  aria-expanded aria-controls> trigger that reveals a rich panel of links via the native
  [popover] API (UNCONTROLLED, no server round-trip). The trigger and panel are siblings
  inside a <li>; the panel is positioned absolutely below the trigger (horizontal) or expands
  inline (vertical, via non-popover hidden toggle on the panel).

  TIER: PARTIAL + ENH. The [popover] attribute on the panel gives:
    - Native Esc dismissal (browser built-in).
    - Native light-dismiss (click outside).
    - popover-anchor.enhancer.ts: opener recording + focus return on light-dismiss.
  ENHANCER_NEEDED: popover-anchor -- set aria-expanded on the opener trigger on popover
  toggle event (newState "open" -> "true", "closed" -> "false"). Until then aria-expanded
  reflects the server-set initial value (always "false" on first render).

  STRUCTURE (APG Disclosure Navigation trigger+panel):
    - <button> trigger: aria-expanded, aria-controls="panel-<id>", popovertarget="panel-<id>".
    - <div id="panel-<id>" popover="auto">: native popover panel; contains <ul> of group sections.
    - Panel for vertical orientation: omits [popover] (inline accordion expand/collapse via hidden).
    - The trigger carries data-lievit-item so collection-nav picks it up for arrow-key nav.
    - Separator sentinel: a <li role="separator"> with a visible rule (pass id="" + label="").

  A11y (APG Disclosure Navigation):
    - <button>: native button role + Enter/Space activation + Tab focus by platform.
    - aria-expanded="true"/"false": reflects panel visibility (managed by ENHANCER after open).
    - aria-controls="panel-<id>": references the panel element (always present, may be [hidden]).
    - panel: id="panel-<id>"; not hidden on initial render (hidden when closed below
      is conveyed by the [popover] API hiding it from the a11y tree natively).
    - Chevron icon: aria-hidden="true" (visual affordance only; state via aria-expanded).
    - Badge on trigger: aria-hidden="true" (decorative).
    - Group heading <p>: visible text, aria-hidden not added (informational group label for AT).
    - Panel link icons: decorative, aria-hidden via icon partial default.
    - Disabled trigger: native `disabled` attribute (not aria-disabled, which is for <a>).

  CSS Anchor Positioning (horizontal positioned panels):
    - The panel uses CSS Anchor Positioning to sit below the trigger. When the browser supports
      `anchor-name` / `position-anchor` (Chrome 125+, Safari 18.2+, Firefox 131+), the panel
      auto-anchors. The polyfill (see popover-anchor.enhancer.ts header) can be loaded separately
      for older targets. The trigger carries a dynamic `anchor-name` via the CSS custom property
      approach (inline style). panelFull=true disables anchor positioning and stretches full-width.

  Separator sentinel:
    When id is blank, renders a <li role="separator"> (a visible horizontal rule). This is the
    sentinel value pattern: pass id="" label="" to insert a separator between groups.

  Params:
    String id                   stable unique id (used for trigger id="nm-trigger-<id>" and
                                  panel id="panel-<id>"); must be HTML-attribute-safe.
    String label                the visible trigger label text (omit for separator sentinel).
    String icon = null          optional Lucide icon name on the trigger (decorative).
    String badge = null         optional badge text on the trigger; aria-hidden.
    boolean disabled = false    native `disabled` on the button trigger.
    boolean panelFull = false   true => panel stretches container-full-width (mega-menu style);
                                  false => positioned below the trigger (dropdown style).
    boolean vertical = false    true => panel expands inline (accordion, no [popover]);
                                  false => panel floats below trigger ([popover=auto]).
    gg.jte.Content content      the panel body: one or more navigation-menu/menu.group() blocks
                                  or bare navigation-menu/link(..., inPanel=true) items.
    String cssClass = ""        extra utility classes on the root <li>.
    Map<String,String> dataAttrs = {}  SAFE dynamic data-* on the <li> root (value escaped).

  Usage:
    @template.lievit.navigation-menu.menu(id = "products", label = "Products", content = @`
      @template.lievit.navigation-menu.menu.group(label = "Catalogue", content = @`
        @template.lievit.navigation-menu.link(href = "/products", label = "All products",
            description = "Browse the full catalogue", icon = "package", inPanel = true)
      `)
    `)
    @template.lievit.navigation-menu.menu(id = "", label = "")
--%>
@param String id
@param String label
@param String icon = null
@param String badge = null
@param boolean disabled = false
@param boolean panelFull = false
@param boolean vertical = false
@param gg.jte.Content content = null
@param String cssClass = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

<%-- Separator sentinel: id blank => render a separator rule, nothing else. --%>
@if(id == null || id.isBlank())
<li role="separator" data-slot="navigation-menu-separator" style="width:1px;align-self:stretch;background:var(--lv-color-border);margin:var(--lv-space-1) 0;" class="${cssClass}"></li>
@else

!{var _triggerId = "nm-trigger-" + id;}
!{var _panelId = "panel-" + id;}
<%-- Anchor positioning: each trigger gets a scoped anchor-name so the panel can position-anchor to it. --%>
!{var _anchorName = "--nm-anchor-" + id;}

<%-- SAFE dynamic data-* fragment. --%>
!{var _dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      _dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), _dataAttrs_);
      _dataAttrs_.writeContent("\"");
    }
  }}
!{var _dataAttrsMarkup = _dataAttrs_.toString();}

<li
  data-slot="navigation-menu-item"
  data-id="${id}"
  style="position:relative;"
  class="${cssClass}"
  $unsafe{_dataAttrsMarkup}
>
  <button
    type="button"
    id="${_triggerId}"
    data-slot="navigation-menu-trigger"
    data-lievit-item
    aria-expanded="false"
    aria-controls="${_panelId}"
    popovertarget="${vertical ? null : _panelId}"
    disabled="${disabled}"
    class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-sm)] whitespace-nowrap border-0 bg-transparent cursor-pointer outline-none focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-[0.5] hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)]"
    style="min-height:var(--lv-nm-trigger-h,var(--lv-space-9));padding:0 var(--lv-space-3);color:var(--lv-color-fg);font:inherit;font-size:var(--lv-text-sm);transition:background var(--lv-duration-fast) var(--lv-ease),color var(--lv-duration-fast) var(--lv-ease);anchor-name:${_anchorName};"
  >
    @if(icon != null && !icon.isBlank())
      @template.lievit.icon(name = icon, size = "1rem")
    @endif
    ${label}
    @if(badge != null && !badge.isBlank())
      <span aria-hidden="true" style="display:inline-flex;align-items:center;border-radius:9999px;padding:0 var(--lv-space-2);font-size:var(--lv-text-xs);font-weight:var(--lv-font-medium);background:var(--lv-color-accent);color:var(--lv-color-accent-fg);">${badge}</span>
    @endif
    <span aria-hidden="true" style="display:inline-flex;flex-shrink:0;transition:transform var(--lv-duration-fast) var(--lv-ease);">@template.lievit.icon(name = "chevron-down", size = "1rem")</span>
  </button>

  @if(vertical)
  <%-- VERTICAL (inline accordion): panel is a plain <div> with hidden; no [popover].
       The toggle is handled by the collection-nav enhancer's Esc action OR by a companion
       JS module. For now the panel is always hidden initially; a parent can open it by
       removing the hidden attribute server-side (pass open=true path is NOT in this partial
       since UNCONTROLLED means client owns the state). --%>
  <div
    id="${_panelId}"
    data-slot="navigation-menu-panel"
    data-lv-opener="${_triggerId}"
    hidden
    style="padding:0 0 var(--lv-space-2) var(--lv-space-4);"
  >
    <ul data-slot="navigation-menu-panel-list" style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;">${content}</ul>
  </div>
  @else
  <%-- HORIZONTAL (positioned popover): panel floats below trigger via [popover=auto].
       Native Esc + light-dismiss close. CSS Anchor Positioning anchors it to the trigger.
       popover-anchor.enhancer.ts wires focus return on light-dismiss.
       panelFull=true: stretches to the container; panelFull=false: min-width positioned. --%>
  <div
    id="${_panelId}"
    popover="auto"
    data-slot="navigation-menu-panel"
    data-lv-opener="${_triggerId}"
    style="${panelFull
        ? "position:fixed;inset:auto 0 auto 0;margin:var(--lv-space-1) auto 0;width:100%;"
        : "position:absolute;position-anchor:" + _anchorName + ";inset-area:bottom span-all;margin:0;min-width:16rem;width:max-content;"
    }border:1px solid var(--lv-color-border);border-radius:var(--lv-radius-md);background:var(--lv-color-popover);color:var(--lv-color-popover-fg);box-shadow:var(--lv-shadow-md);padding:var(--lv-space-2);z-index:var(--lv-z-popover);font-size:var(--lv-text-sm);"
  >
    <ul data-slot="navigation-menu-panel-list" style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;">${content}</ul>
  </div>
  @endif
</li>
@endif
