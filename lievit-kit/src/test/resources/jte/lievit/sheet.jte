@import io.lievit.component.ComponentMetadata
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui sheet WIRE template -- a modal side panel that slides in from any of the four viewport
  edges (the richer, shadcn-shaped generalisation of drawer) whose open state lives server-side in
  SheetComponent (ADR-0012). Pairs with registry/wire/sheet/SheetComponent.java.

  TIER: WIRE. The open/closed state is server state (a @Wire boolean); the trigger fires `open`
  and the backdrop / close button fire `close` over the wire; the server re-renders this template
  and the client morphs it. No <slot> (the light-DOM slot bug). The wire runtime renders this
  template with ONLY the component's @Wire fields + _component + _instance (JteTemplateAdapter), so
  the header / body / footer are NOT JTE Content slots supplied at call time: they are OWNED markup
  inside this region. The adopter edits the body + footer regions directly (this is copy-in
  source), or drives them from @Wire fields / the _instance. That is the server-first equivalent of
  "children".

  STRUCTURE (scientific decision rule): WAI-ARIA APG Dialog (Modal) pattern, Radix Dialog as the
  a11y source (the same source the dropped Lit island cited):
    - the panel is role="dialog" + aria-modal="true";
    - aria-labelledby -> the title id when a heading is set, else aria-label="Sheet";
    - aria-describedby -> the description id when a description is set;
    - the `side` field positions the panel against one edge (right/left/top/bottom);
    - a built-in close button (showClose) renders the vendored Lucide `x` via @template.icon;
    - when closed the whole overlay is `hidden`, so it leaves the tab order + a11y tree.
  Open-state is SERVER (wire); focus-trap + Escape are a tiny CSP-clean typed-TS enhancement
  (data-lv-sheet hooks). Escape + the backdrop dispatch the `close` action.

  A11y (WAI-ARIA APG Dialog/Modal): div[role=dialog][aria-modal=true] labelled by the title +
  described by the description; closed overlay removed from the a11y tree via `hidden`.

  Params:
    open        boolean    modal open state (server-owned)
    side        String     edge to anchor: "right" | "left" | "top" | "bottom"
    heading     String     panel title; wired to aria-labelledby (empty omits the title)
    description String     panel description; wired to aria-describedby (empty omits it)
    showClose   boolean    render the top-right close button
    dismissible boolean    when true the backdrop + Escape route to `close` (locked server-side)
    _component  ComponentMetadata  always-present wire metadata (the className anchor)

  Usage (copy this template in, then put YOUR body + footer markup in the owned regions):
    <div data-lv-sheet-body ...>
        <p>Your owned, server-rendered body here.</p>
    </div>
--%>
@param boolean open
@param String side
@param String heading
@param String description
@param boolean showClose
@param boolean dismissible
@param ComponentMetadata _component
!{var cid = _component.className();}
!{var titleId = "lv-sheet-title";}
!{var descId = "lv-sheet-desc";}
!{var hasHeading = heading != null && !heading.isEmpty();}
!{var hasDesc = description != null && !description.isEmpty();}
!{
    var edge = side == null ? "right" : side;
    String panelPos;
    switch (edge) {
        case "left" -> panelPos = "inset: 0 auto 0 0; width: min(90vw, 24rem); border-right: 1px solid var(--lv-color-border);";
        case "top" -> panelPos = "inset: 0 0 auto 0; max-height: 85vh; border-bottom: 1px solid var(--lv-color-border);";
        case "bottom" -> panelPos = "inset: auto 0 0 0; max-height: 85vh; border-top: 1px solid var(--lv-color-border);";
        default -> panelPos = "inset: 0 0 0 auto; width: min(90vw, 24rem); border-left: 1px solid var(--lv-color-border);";
    }
}
<div
    data-lievit-component="${cid}"
    data-lv-sheet
    data-lv-sheet-side="${edge}"
    data-lv-sheet-dismissible="${dismissible ? "true" : "false"}"
    hidden="${!open}"
    class="fixed inset-0"
    style="z-index: var(--lv-z-overlay, 9400); font-family: var(--lv-font-sans);"
>
    @if(dismissible)
        <button
            type="button"
            data-lv-sheet-backdrop
            aria-label="Close"
            l:click="close"
            class="absolute inset-0 w-full h-full"
            style="background: var(--lv-color-overlay); border: 0; cursor: pointer;"
        ></button>
    @endif
    <div
        data-lv-sheet-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="${hasHeading ? titleId : null}"
        aria-describedby="${hasDesc ? descId : null}"
        aria-label="${hasHeading ? null : "Sheet"}"
        class="fixed flex flex-col"
        style="${panelPos} z-index: var(--lv-z-modal, 9500); gap: var(--lv-space-4); background: var(--lv-color-bg); color: var(--lv-color-fg); box-shadow: var(--lv-shadow-lg); overflow-y: auto;"
    >
        @if(showClose)
            <button
                type="button"
                data-lv-sheet-close
                aria-label="Close"
                l:click="close"
                class="absolute inline-flex items-center justify-center"
                style="top: var(--lv-space-4); right: var(--lv-space-4); background: transparent; border: 0; cursor: pointer; color: var(--lv-color-muted); border-radius: var(--lv-radius-sm); padding: var(--lv-space-1);"
            >
                @template.icon(name = "x", size = "1rem")
            </button>
        @endif
        <div
            class="flex flex-col"
            style="gap: var(--lv-space-1); padding: var(--lv-space-4);"
        >
            @if(hasHeading)
                <h2
                    id="${titleId}"
                    data-lv-sheet-title
                    style="margin: 0; font-size: var(--lv-text-lg); font-weight: 600; color: var(--lv-color-fg);"
                >${heading}</h2>
            @endif
            @if(hasDesc)
                <p
                    id="${descId}"
                    data-lv-sheet-description
                    style="margin: 0; font-size: var(--lv-text-sm); color: var(--lv-color-muted); line-height: var(--lv-leading);"
                >${description}</p>
            @endif
        </div>
        <%-- Owned body region: replace this with your sheet body markup (server-rendered). --%>
        <div
            data-lv-sheet-body
            style="flex: 1; overflow-y: auto; padding: 0 var(--lv-space-4); font-size: var(--lv-text-base); color: var(--lv-color-fg); line-height: var(--lv-leading);"
        >
            <p>Sheet content.</p>
        </div>
        <%-- Owned footer region: replace this with your action buttons (server-rendered). --%>
        <div
            data-lv-sheet-footer
            class="flex flex-col"
            style="margin-top: auto; gap: var(--lv-space-2); padding: var(--lv-space-4);"
        >
            <button
                type="button"
                l:click="close"
                style="padding: var(--lv-space-2) var(--lv-space-3); background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); font-size: var(--lv-text-sm); color: var(--lv-color-fg); cursor: pointer;"
            >Close</button>
        </div>
    </div>
</div>
