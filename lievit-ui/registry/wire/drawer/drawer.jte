@import dev.lievit.component.ComponentMetadata
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui drawer WIRE template -- a modal side panel anchored to one viewport edge whose open
  state lives server-side in DrawerComponent (ADR-0012). Pairs with
  registry/wire/drawer/DrawerComponent.java.

  TIER: WIRE. The open/closed state is server state (a @Wire boolean); the trigger fires `open`
  and the backdrop / close button fire `close` over the wire; the server re-renders this template
  and the client morphs it. No <slot> (the light-DOM slot bug). The wire runtime renders this
  template with ONLY the component's @Wire fields + _component + _instance (JteTemplateAdapter), so
  the body is NOT a JTE Content slot supplied at call time: it is OWNED markup inside this region.
  The adopter edits the body region directly (this is copy-in source), or drives it from a @Wire
  field / the _instance. That is the server-first equivalent of "children".

  STRUCTURE (scientific decision rule): WAI-ARIA APG Dialog (Modal) pattern, Radix Dialog as the
  a11y source (the same source the dropped Lit island cited), presented as a side sheet:
    - the panel is role="dialog" + aria-modal="true";
    - aria-labelledby -> the heading id when set, else aria-label="Drawer";
    - the `side` field positions the panel against one edge (right/left/top/bottom);
    - when closed the whole overlay is `hidden`, so it leaves the tab order + a11y tree.
  Open-state is SERVER (wire); focus-trap + Escape are a tiny CSP-clean typed-TS enhancement
  (data-lv-drawer hooks). Escape + the backdrop dispatch the `close` action.

  A11y (WAI-ARIA APG Dialog/Modal): div[role=dialog][aria-modal=true] labelled by the heading;
  closed overlay removed from the a11y tree via `hidden`.

  Params:
    open        boolean    modal open state (server-owned)
    side        String     edge to anchor: "right" | "left" | "top" | "bottom"
    heading     String     panel title; wired to aria-labelledby (empty hides the header)
    dismissible boolean    when true the backdrop + Escape route to `close` (locked server-side)
    _component  ComponentMetadata  always-present wire metadata (the className anchor)

  Usage (copy this template in, then put YOUR body markup in the data-lv-drawer-body region):
    <div data-lv-drawer-body ...>
        <p>Your owned, server-rendered body here.</p>
    </div>
--%>
@param boolean open
@param String side
@param String heading
@param boolean dismissible
@param ComponentMetadata _component
!{var cid = _component.className();}
!{var headingId = "lv-drawer-heading";}
!{var hasHeading = heading != null && !heading.isEmpty();}
!{
    var edge = side == null ? "right" : side;
    String panelPos;
    switch (edge) {
        case "left" -> panelPos = "top: 0; left: 0; bottom: 0; width: min(90vw, 24rem); border-right: 1px solid var(--lv-color-border);";
        case "top" -> panelPos = "top: 0; left: 0; right: 0; max-height: 85vh; border-bottom: 1px solid var(--lv-color-border);";
        case "bottom" -> panelPos = "bottom: 0; left: 0; right: 0; max-height: 85vh; border-top: 1px solid var(--lv-color-border);";
        default -> panelPos = "top: 0; right: 0; bottom: 0; width: min(90vw, 24rem); border-left: 1px solid var(--lv-color-border);";
    }
}
<div
    data-lievit-component="${cid}"
    data-lv-drawer
    data-lv-drawer-side="${edge}"
    data-lv-drawer-dismissible="${dismissible ? "true" : "false"}"
    hidden="${!open}"
    class="fixed inset-0"
    style="z-index: var(--lv-z-modal, 9500); font-family: var(--lv-font-sans);"
>
    @if(dismissible)
        <button
            type="button"
            data-lv-drawer-backdrop
            aria-label="Close"
            l:click="close"
            class="absolute inset-0 w-full h-full"
            style="background: var(--lv-color-overlay); border: 0; cursor: pointer;"
        ></button>
    @endif
    <div
        data-lv-drawer-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="${hasHeading ? headingId : null}"
        aria-label="${hasHeading ? null : "Drawer"}"
        class="fixed flex flex-col"
        style="${panelPos} z-index: 1; background: var(--lv-color-bg); box-shadow: var(--lv-shadow-md); overflow-y: auto;"
    >
        @if(hasHeading)
            <div
                class="flex items-center justify-between"
                style="gap: var(--lv-space-3); padding: var(--lv-space-4); border-bottom: 1px solid var(--lv-color-border); flex-shrink: 0;"
            >
                <h2
                    id="${headingId}"
                    data-lv-drawer-title
                    style="margin: 0; font-size: var(--lv-text-lg); font-weight: 600; color: var(--lv-color-fg);"
                >${heading}</h2>
                <button
                    type="button"
                    data-lv-drawer-close
                    aria-label="Close"
                    l:click="close"
                    style="background: transparent; border: 0; cursor: pointer; color: var(--lv-color-muted); line-height: 1; padding: var(--lv-space-1); border-radius: var(--lv-radius-sm); flex-shrink: 0; display: inline-flex;"
                >
                    @template.icon(name = "x", size = "1.25rem")
                </button>
            </div>
        @endif
        <%-- Owned body region: replace this with your drawer body markup (server-rendered). --%>
        <div
            data-lv-drawer-body
            style="padding: var(--lv-space-4); font-size: var(--lv-text-base); color: var(--lv-color-fg); line-height: var(--lv-leading); flex: 1; overflow-y: auto;"
        >
            <p>Drawer content.</p>
        </div>
    </div>
</div>
