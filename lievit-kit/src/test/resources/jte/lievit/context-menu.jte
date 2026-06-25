@import dev.lievit.component.ComponentMetadata
@import dev.lievit.kit.wire.ContextMenuComponent
@import dev.lievit.kit.wire.ContextMenuComponent.Entry
@import java.util.List
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui context-menu WIRE template -- a right-click menu whose open-state, pointer position
  and selection live server-side in ContextMenuComponent (ADR-0012, Wave 2). Pairs with
  registry/wire/context-menu/ContextMenuComponent.java + the context-menu.ts enhancer.

  TIER: WIRE. The open-state + the pointer coordinates + the last selection are server state
  (@Wire fields); the items are server-owned data read off _instance (a record list cannot
  round-trip the generic-Map snapshot codec, the listing-list pattern). Right-click opens the
  menu via a tiny CSP-clean typed-TS enhancer (context-menu.ts) that prevents the browser menu,
  writes x/y into the wire fields and fires the `openAt` action; the server re-renders open at
  those coordinates and the client morphs it. No <slot>: the right-clickable region is OWNED
  markup inside this template (the server-first equivalent of children), never a projected slot
  (the light-DOM slot bug the pivot exists to kill).

  STRUCTURE (scientific decision rule): WAI-ARIA APG Menu pattern, Radix ContextMenu as the
  a11y source (the same source the dropped Lit island cited):
    - the panel is role="menu";
    - items are role="menuitem" / "menuitemcheckbox" / "menuitemradio", a real <button> each;
    - separators are role="separator";
    - a disabled item carries aria-disabled and is not selectable;
    - the panel is position:fixed, anchored at the x/y the enhancer captured (CSS custom props),
      no @floating-ui/dom, CSP-clean.
  Native <button> menu items + a server re-render beat a Lit reactive tree: the menu cannot fail
  to project (the whole point of the pivot). Keyboard arrow-navigation within the open menu is
  the one piece the enhancer layers on top of the server-rendered items (roving via the buttons).

  A11y (WAI-ARIA APG Menu): div[role=menu] of button[role=menuitem]; aria-disabled on a disabled
  item; aria-checked on a checkbox/radio item; the panel is removed from the DOM when closed.

  Params:
    open        boolean            menu open state (server-owned)
    x           int                pointer x the menu is anchored at (px from viewport left)
    y           int                pointer y the menu is anchored at (px from viewport top)
    selectedKey String             the last selected item's key (armed by $set, read by the host)
    _instance   ContextMenuComponent  the live instance the items list is read from
    _component  ComponentMetadata  always-present wire metadata (the className anchor)

  Usage (copy this template in, then put YOUR right-clickable content in the owned trigger
  region below; supply the real `items` list from your component):
    <div data-context-menu-trigger ...>
        <p>Your owned, server-rendered right-clickable content here.</p>
    </div>
--%>
@param boolean open
@param int x
@param int y
@param String selectedKey
@param ContextMenuComponent _instance
@param ComponentMetadata _component
!{var cid = _component.className();}
!{List<Entry> items = _instance.items();}
<div data-lievit-component="${cid}" class="block" style="font-family: var(--lv-font-sans);">
    <div
        data-context-menu-trigger
        tabindex="0"
        style="display: block;"
    >
        <%-- Owned trigger region: replace this with your right-clickable markup (server-rendered).
             The context-menu.ts enhancer captures the contextmenu event on this element. --%>
        <p data-context-menu-body>Right-click here.</p>
    </div>
    @if(open)
        <div
            data-context-menu-panel
            role="menu"
            style="position: fixed; left: ${x}px; top: ${y}px; z-index: 9300; min-width: 12rem; background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); box-shadow: var(--lv-shadow-md); padding: var(--lv-space-1) 0; font-size: var(--lv-text-sm);"
        >
            @for(Entry entry : items)
                @if(entry.isSeparator())
                    <div role="separator" data-context-menu-separator style="height: 1px; background: var(--lv-color-border); margin: var(--lv-space-1) 0;"></div>
                @else
                    <button
                        type="button"
                        role="${entry.role()}"
                        data-context-menu-item="${entry.key()}"
                        aria-disabled="${entry.disabled() ? "true" : "false"}"
                        l:click="$set('selectedKey', '${entry.key()}')"
                        class="flex items-center w-full text-left"
                        style="gap: var(--lv-space-2); width: 100%; color: var(--lv-color-fg); background: transparent; border: 0; padding: var(--lv-space-2) var(--lv-space-3); cursor: ${entry.disabled() ? "not-allowed" : "pointer"}; opacity: ${entry.disabled() ? "0.5" : "1"}; font: inherit; box-sizing: border-box;"
                        aria-checked="${entry.isCheckable() ? (entry.checked() ? "true" : "false") : null}"
                    >
                        @if(!entry.icon().isEmpty())
                            <span aria-hidden="true" style="flex-shrink: 0; display: inline-flex;">@template.icon(name = entry.icon(), size = "1rem")</span>
                        @endif
                        <span style="flex: 1 1 auto;">${entry.label()}</span>
                        @if(!entry.shortcut().isEmpty())
                            <span aria-hidden="true" style="flex-shrink: 0; margin-left: auto; padding-left: var(--lv-space-3); color: var(--lv-color-muted); font-size: var(--lv-text-xs); letter-spacing: 0.05em;">${entry.shortcut()}</span>
                        @endif
                    </button>
                @endif
            @endfor
        </div>
    @endif
</div>
