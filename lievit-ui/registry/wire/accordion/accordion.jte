@import io.lievit.component.ComponentMetadata
@import io.lievit.wire.AccordionComponent
@import java.util.List
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui accordion WIRE template -- a disclosure GROUP whose open set lives server-side in
  AccordionComponent (ADR-0012, Wave 2). Pairs with registry/wire/accordion/AccordionComponent.java.

  TIER: WIRE. The open set is server state (a @Wire list); each trigger ARMS its item via the
  `$set('toggleId', '<id>')` magic (the canonical wire:click="$set(...)" idiom this repo already
  uses in listing-list.jte), the server re-renders this template, the client morphs it. There is no
  <slot> (the light-DOM slot bug). The wire runtime renders this template with ONLY the component's
  @Wire fields + _component + _instance (JteTemplateAdapter); the panel BODIES are NOT a JTE Content
  slot supplied at call time -- they are OWNED markup inside each region. The adopter edits the body
  region per item directly (this is copy-in source). That is the server-first equivalent of
  "children": owned, server-rendered, cannot fail to project.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Accordion pattern, Radix Accordion as the a11y
  source (the same source the dropped Lit island cited):
    - each trigger is a real <button> carrying aria-expanded + aria-controls -> its region id;
    - each region carries the matching id, role="region", aria-labelledby -> its trigger id;
    - a closed region is `hidden`, so collapsed content leaves the tab order + a11y tree;
    - Enter/Space activate the native <button> for free; the panels stack as headers + regions, the
      APG accordion structure. Arrow-key roving between headers was a client nicety of the island;
      native buttons are Tab-reachable, the server holds the open set, no key handler needed.
  Native <button> + hidden beats a JS height-measure: zero client logic, CSP-clean, cannot fail to
  project (the whole point of the pivot).

  A11y (WAI-ARIA APG Accordion): per item button[aria-expanded][aria-controls] + region[aria-labelledby],
  the collapsed region removed from the a11y tree via `hidden`.

  Params:
    itemIds   List<String>  item ids in render order (locked server config)
    labels    List<String>  trigger labels, index-aligned with itemIds (locked)
    open      List<String>  the open item ids (server-owned disclosure state)
    mode      String        "single" | "multiple" selection mode (locked)
    toggleId  String        the item a click armed; consumed + cleared on render (server-owned)
    _component ComponentMetadata  always-present wire metadata (the className anchor)
    _instance AccordionComponent  the live instance, read for isOpen(id)

  Usage (copy this template in, then put YOUR panel markup in each data-accordion-region body):
    <div data-accordion-region ...>
        <p>Your owned, server-rendered body for this item here.</p>
    </div>
--%>
@param List<String> itemIds
@param List<String> labels
@param List<String> open
@param String mode
@param String toggleId
@param ComponentMetadata _component
@param AccordionComponent _instance
!{var cid = _component.className();}
<div data-lievit-component="${cid}" data-accordion role="presentation" class="block" style="font-family: var(--lv-font-sans); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); overflow: hidden;">
    @for(int i = 0; i < itemIds.size(); i++)
        !{var id = itemIds.get(i);}
        !{var label = i < labels.size() ? labels.get(i) : id;}
        !{var isOpen = _instance.isOpen(id);}
        !{var triggerId = "lv-acc-trigger-" + id;}
        !{var panelId = "lv-acc-panel-" + id;}
        <div data-accordion-item="${id}" style="border-bottom: 1px solid var(--lv-color-border);">
            <button
                type="button"
                id="${triggerId}"
                class="flex items-center justify-between w-full text-left"
                style="gap: var(--lv-space-3); padding: var(--lv-space-4); background: var(--lv-color-bg); border: 0; font-size: var(--lv-text-base); font-weight: 500; color: var(--lv-color-fg); cursor: pointer;"
                aria-expanded="${isOpen ? "true" : "false"}"
                aria-controls="${panelId}"
                l:click="$set('toggleId', '${id}')"
                data-accordion-trigger="${id}"
            >
                <span data-accordion-label>${label}</span>
                <span aria-hidden="true" style="color: var(--lv-color-muted); flex-shrink: 0; display: inline-flex; transition: transform 0.2s ease; transform: rotate(${isOpen ? "180" : "0"}deg);">
                    @template.icon(name = "chevron-down", size = "1rem")
                </span>
            </button>
            <div
                id="${panelId}"
                role="region"
                aria-labelledby="${triggerId}"
                hidden="${!isOpen}"
                data-accordion-region="${id}"
                style="padding: 0 var(--lv-space-4) var(--lv-space-4); font-size: var(--lv-text-base); color: var(--lv-color-fg); line-height: var(--lv-leading);"
            >
                <%-- Owned body region for this item: replace with your panel markup (server-rendered). --%>
                <p data-accordion-body="${id}">Panel content for ${label}.</p>
            </div>
        </div>
    @endfor
</div>
