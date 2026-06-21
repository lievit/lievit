@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui sidebar partial -- the application sidebar: a <nav> landmark of real <a href> nav
  items (composed from sidebar/group + sidebar/item) PLUS a collapse/expand control. Server-first
  PARTIAL + a CSP-clean typed-TS enhancer (sidebar.enhancer.ts), NOT a Lit island (ADR-0012,
  Wave 3). Pairs with registry/jte/sidebar/{group,item}.jte + registry/jte/sidebar.enhancer.ts.

  TIER DECISION (why PARTIAL + enhancer, NOT WIRE): the blueprint classes sidebar as
  WIRE(PARTIAL): "nav is PARTIAL, collapse is tiny vanilla/wire state". Both halves resolve to
  server-pure:
    (1) NAV: real <a href> entries. Which one is current is a fact the SERVER already knows (the
        route being rendered), passed in as the item's `active` -> aria-current="page" -- not
        client state. Groups / menu-items / sub-items come in via @param Content composed from the
        sub-partials, filled by the caller from its typed model (gest's shell.jte already
        iterates a typed NavTab list into <a>s the same way). No data is hardcoded in the partial.
    (2) COLLAPSE: a rail-width toggle + mobile off-canvas open/close. This is PURE CLIENT COSMETIC:
        there is nothing for the server to decide when a user narrows their own sidebar, so
        round-tripping it over the wire would be chat for no gain (the same reasoning input-otp's
        enhancer uses). Per the blueprint's own fallback -- "pure client cosmetic -> a registry:jte
        partial + a tiny CSP-clean typed-TS toggle (localStorage persistence), NO Lit" -- the
        collapse is the enhancer, and the choice persists to localStorage. There is therefore no
        @Wire field, no action, no wire component.

  STRUCTURE (scientific decision rule): shadcn Sidebar anatomy (header / content / footer; group ->
  menu -> menu-item -> menu-sub), the model the dropped Lit island cited, rendered as a <nav>
  landmark + <ul>/<li> lists of real anchors. Desktop collapse is an icon rail (width animates to
  the icon width, labels/badges/group-headings hide via CSS on the collapsed state). Mobile is an
  off-canvas overlay: the SAME slide-in + backdrop + Escape/focus-return pattern as the drawer wire
  (Wave 2), but TS-toggled here because it is cosmetic, not server state -- reuse, not reinvent. No
  No light-DOM slot elements: items arrive via @param Content (the sub-partials), header/footer via
  their own Content slots, never slotted light-DOM children (the silent-slot bug the pivot kills).

  A11y (shadcn Sidebar + WAI-ARIA): <nav aria-label> landmark; the collapse trigger is a real
  <button aria-expanded aria-controls> -> the nav id; the active item carries aria-current="page";
  the mobile backdrop is aria-hidden. Enter/Space activate the native button for free.

  TRIGGER DECOUPLING: the trigger lives in a header bar that ALWAYS renders, never gated by the
  optional `header` content. Gating it on the header meant a headerless sidebar had NO toggle on
  desktop and could not be opened on mobile (the trigger is the only opener) -- a real runtime bug.
  When `header` is null the bar shows just the trigger.

  Params:
    gg.jte.Content content   the groups (sidebar/group, each holding sidebar/item entries).
    String label = "Main"    aria-label for the <nav> landmark.
    gg.jte.Content header     optional header content (logo / app name); empty leaves the header bar
                              with just the trigger (the bar + trigger always render).
    gg.jte.Content footer     optional footer region (user chip / actions); empty hides the footer.
    String side = "left"      "left" | "right": which edge the rail docks + collapses toward.
    String variant = "sidebar" "sidebar" | "none" | "floating" | "inset" (shadcn data-variant on
                              the root): "sidebar" is the default flush rail; "none" drops the
                              border/elevation; "floating" detaches the rail as a bordered+shadowed
                              rounded card; "inset" floats the rail AND pairs with sidebar/inset (a
                              <main> that becomes a floating inset card). The visual treatment per
                              variant lives in the enhancer's injected CSS keyed on data-variant.
    boolean collapsed = false SSR hint: render collapsed (icon rail) server-side; the enhancer then
                              hydrates the persisted choice from localStorage.
    String triggerLabel = "Toggle sidebar"  accessible name for the collapse <button>.
    String storageKey = "lv-sidebar-state"  localStorage key the collapsed choice persists under.
    String cssClass = ""      extra utility classes on the <nav>.

  Usage:
    @@template.lievit.sidebar(label = "Primary", header = @@`...logo...`, footer = @@`...user...`, content = @@`
      @@template.lievit.sidebar.group(label = "Platform", content = @@`
        @@template.lievit.sidebar.item(key = "home", href = "/", label = "Home", icon = "house", active = activeTab.equals("home"))
        @@template.lievit.sidebar.item(key = "deals", href = "/deals", label = "Deals", icon = "folder", badge = "3", active = activeTab.equals("deals"))
      `)
    `)
--%>
@param gg.jte.Content content
@param String label = "Main"
@param gg.jte.Content header = null
@param gg.jte.Content footer = null
@param String side = "left"
@param String variant = "sidebar"
@param boolean collapsed = false
@param String triggerLabel = "Toggle sidebar"
@param String storageKey = "lv-sidebar-state"
@param String cssClass = ""
!{var navId = "lv-sidebar-nav";}
!{var isRight = "right".equals(side);}
!{var resolvedVariant = ("none".equals(variant) || "floating".equals(variant) || "inset".equals(variant)) ? variant : "sidebar";}
<div
    data-slot="sidebar-wrapper"
    data-sidebar="root"
    data-side="${isRight ? "right" : "left"}"
    data-variant="${resolvedVariant}"
    data-storage-key="${storageKey}"
    data-state="${collapsed ? "collapsed" : "expanded"}"
    class="lv-sidebar-root"
    style="font-family: var(--lv-font-sans); font-size: var(--lv-text-sm);"
>
    <button
        type="button"
        data-sidebar="backdrop"
        aria-hidden="true"
        tabindex="-1"
        class="lv-sidebar-backdrop"
        style="position: fixed; inset: 0; z-index: var(--lv-z-modal, 9500); background: var(--lv-color-overlay); border: 0; padding: 0; cursor: pointer; display: none;"
    ></button>
    <nav
        id="${navId}"
        data-slot="sidebar"
        aria-label="${label}"
        class="lv-sidebar ${cssClass}"
        style="display: flex; flex-direction: column; height: 100%; background: var(--lv-color-sidebar); color: var(--lv-color-sidebar-fg); box-sizing: border-box;"
    >
        <%-- The header bar always renders: it carries the collapse/open trigger, which MUST exist
             with or without `header` content (else there is no toggle on desktop and mobile cannot
             open -- the decoupling fix). When `header` is null the bar shows just the trigger. --%>
        <div
            data-slot="sidebar-header"
            class="lv-sidebar-header"
            style="display: flex; align-items: center; gap: var(--lv-space-2); padding: var(--lv-space-3); border-bottom: 1px solid var(--lv-color-sidebar-border); flex-shrink: 0;"
        >
            @if(header != null)
                <div style="flex: 1; min-width: 0;" class="lv-sidebar-collapsible">${header}</div>
            @else
                <div style="flex: 1; min-width: 0;"></div>
            @endif
            <button
                type="button"
                data-slot="sidebar-trigger"
                aria-label="${triggerLabel}"
                aria-controls="${navId}"
                aria-expanded="${collapsed ? "false" : "true"}"
                class="lv-sidebar-trigger"
                style="display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; padding: var(--lv-space-2); border: 0; border-radius: var(--lv-radius-md); background: transparent; color: inherit; cursor: pointer;"
            >
                <span aria-hidden="true" style="display: inline-flex;">@template.lievit.icon(name = "menu", size = "1.1rem")</span>
            </button>
        </div>
        <div
            data-slot="sidebar-content"
            class="lv-sidebar-content"
            style="flex: 1; overflow-y: auto; padding: var(--lv-space-2); display: flex; flex-direction: column; gap: var(--lv-space-3);"
        >
            ${content}
        </div>
        @if(footer != null)
            <div
                data-slot="sidebar-footer"
                class="lv-sidebar-footer lv-sidebar-collapsible"
                style="display: flex; align-items: center; gap: var(--lv-space-2); padding: var(--lv-space-3); border-top: 1px solid var(--lv-color-sidebar-border); margin-top: auto; flex-shrink: 0;"
            >${footer}</div>
        @endif
    </nav>
</div>
