@import dev.lievit.component.ComponentMetadata
@import dev.lievit.wire.TabsComponent
@import java.util.List
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui tabs WIRE template -- a tab bar + panels whose active tab lives server-side in
  TabsComponent (ADR-0012, Wave 2). Pairs with registry/wire/tabs/TabsComponent.java.

  TIER: WIRE. The active tab is server state (a @Wire scalar string); each tab click sets it via the
  `$set('active', '<id>')` magic (the canonical wire:click="$set(...)" idiom this repo already uses
  in listing-list.jte), the server re-renders this template, the client morphs it. There is no
  <slot> (the light-DOM slot bug). The wire runtime renders this template with ONLY the component's
  @Wire fields + _component + _instance (JteTemplateAdapter); the panel BODIES are NOT a JTE Content
  slot supplied at call time -- they are OWNED markup, one region per tab. Only the active panel is
  shown; the others carry the boolean `hidden` attribute. The adopter edits each panel body region
  directly (this is copy-in source). That is the server-first equivalent of "children".

  HTMX alternative: a content-on-demand tab set can instead be a plain HTMX recipe -- the tab links
  carry hx-get to a controller endpoint returning the panel partial, swapped into the panel
  container, no wire snapshot. That is lighter when the panels are independent server fragments; this
  WIRE form is the richer path when the tabs share server state with the page (the form Wave 2 ships).

  STRUCTURE (scientific decision rule): WAI-ARIA APG Tabs pattern, Radix Tabs as the a11y source
  (the same source the dropped Lit island cited):
    - role="tablist" on the bar; role="tab" per tab with aria-selected + aria-controls -> its panel;
    - role="tabpanel" per panel with aria-labelledby -> its tab; the inactive panels are `hidden`;
    - roving tabindex: the active tab is tabindex="0", the others tabindex="-1";
    - a disabled tab carries `disabled` and is never selectable (the server refuses it too).
  Native <button> tabs + hidden panels beat a JS measure: zero client logic, CSP-clean, cannot fail
  to project.

  A11y (WAI-ARIA APG Tabs): tablist > tab[aria-selected][aria-controls] + tabpanel[aria-labelledby];
  inactive panels removed from view via `hidden`; roving tabindex on the tabs.

  Params:
    tabIds      List<String>  tab ids in render order (locked server config)
    labels      List<String>  tab labels, index-aligned with tabIds (locked)
    disabledIds List<String>  disabled tab ids (locked)
    active      String        the active tab id (server-owned)
    pending     String        a tab armed for the explicit select() action (server-owned, unused here)
    _component  ComponentMetadata  always-present wire metadata (the className anchor)
    _instance   TabsComponent  the live instance, read for isActive(id) / isDisabled(id)

  Usage (copy this template in, then put YOUR panel markup in each data-tabs-panel body):
    <div data-tabs-panel ...>
        <p>Your owned, server-rendered body for this tab here.</p>
    </div>
--%>
@param List<String> tabIds
@param List<String> labels
@param List<String> disabledIds
@param String active
@param String pending
@param ComponentMetadata _component
@param TabsComponent _instance
!{var cid = _component.className();}
<div data-lievit-component="${cid}" data-tabs class="block" style="font-family: var(--lv-font-sans);">
    <div role="tablist" data-tabs-list class="flex" style="gap: 0; border-bottom: 2px solid var(--lv-color-border); overflow-x: auto;">
        @for(int i = 0; i < tabIds.size(); i++)
            !{var id = tabIds.get(i);}
            !{var label = i < labels.size() ? labels.get(i) : id;}
            !{var isActive = _instance.isActive(id);}
            !{var isDisabled = _instance.isDisabled(id);}
            !{var tabElId = "lv-tab-" + id;}
            !{var panelId = "lv-tabpanel-" + id;}
            <button
                type="button"
                role="tab"
                id="${tabElId}"
                data-tabs-tab="${id}"
                aria-selected="${isActive ? "true" : "false"}"
                aria-controls="${panelId}"
                tabindex="${isActive ? "0" : "-1"}"
                disabled="${isDisabled}"
                l:click="$set('active', '${id}')"
                style="padding: var(--lv-space-2) var(--lv-space-4); font-size: var(--lv-text-sm); font-weight: 500; color: ${isActive ? "var(--lv-color-primary)" : "var(--lv-color-muted)"}; background: transparent; border: 0; border-bottom: 2px solid ${isActive ? "var(--lv-color-primary)" : "transparent"}; margin-bottom: -2px; cursor: ${isDisabled ? "not-allowed" : "pointer"}; opacity: ${isDisabled ? "0.45" : "1"}; white-space: nowrap;"
            >${label}</button>
        @endfor
    </div>
    @for(int i = 0; i < tabIds.size(); i++)
        !{var id = tabIds.get(i);}
        !{var label = i < labels.size() ? labels.get(i) : id;}
        !{var isActive = _instance.isActive(id);}
        !{var tabElId = "lv-tab-" + id;}
        !{var panelId = "lv-tabpanel-" + id;}
        <div
            id="${panelId}"
            role="tabpanel"
            aria-labelledby="${tabElId}"
            tabindex="0"
            hidden="${!isActive}"
            data-tabs-panel="${id}"
            style="padding: var(--lv-space-4) 0; font-size: var(--lv-text-base); color: var(--lv-color-fg); line-height: var(--lv-leading);"
        >
            <%-- Owned body region for this tab: replace with your panel markup (server-rendered). --%>
            <p data-tabs-body="${id}">Panel content for ${label}.</p>
        </div>
    @endfor
</div>
