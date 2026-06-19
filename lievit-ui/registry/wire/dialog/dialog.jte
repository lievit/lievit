@import io.lievit.component.ComponentMetadata
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui dialog WIRE template -- an accessible modal dialog whose open state lives server-side
  in DialogComponent (ADR-0012). Pairs with registry/wire/dialog/DialogComponent.java.

  TIER: WIRE. The open/closed state is server state (a @Wire boolean); the trigger fires the
  `open` action and the backdrop / close button fire `close` over the wire; the server re-renders
  this template and the client morphs it. No <slot> (the light-DOM slot bug). The wire runtime
  renders this template with ONLY the component's @Wire fields + _component + _instance
  (JteTemplateAdapter), so the body + footer are NOT JTE Content slots supplied at call time: they
  are OWNED markup inside this region. The adopter edits the body + footer regions directly (this
  is copy-in source), or drives them from @Wire fields / the _instance. That is the server-first
  equivalent of "children": owned, server-rendered, cannot fail to project.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Dialog (Modal) pattern, Radix Dialog as the
  a11y source (the same source the dropped Lit island cited):
    - the panel is role="dialog" + aria-modal="true";
    - aria-labelledby -> the heading id when a heading is set, else aria-label="Dialog";
    - aria-describedby -> the description id when a description is set;
    - when closed the whole overlay is `hidden`, so it leaves the tab order + a11y tree.
  Open-state is SERVER (wire); focus-trap + Escape are a tiny CSP-clean typed-TS enhancement
  (data-lv-dialog hooks): zero open-state in the client, only the focus mechanics. Escape + the
  backdrop dispatch the `close` action; the close button does too.

  A11y (WAI-ARIA APG Dialog/Modal): div[role=dialog][aria-modal=true] labelled by the heading +
  described by the description; closed overlay removed from the a11y tree via `hidden`.

  Params:
    open        boolean    modal open state (server-owned)
    heading     String     dialog title; wired to aria-labelledby (empty hides the header)
    description String     supporting line; wired to aria-describedby (empty omits it)
    dismissible boolean    when true the backdrop + Escape route to `close` (locked server-side)
    _component  ComponentMetadata  always-present wire metadata (the className anchor)

  Usage (copy this template in, then put YOUR body + footer markup in the owned regions):
    <div data-lv-dialog-body ...>
        <p>Your owned, server-rendered body here.</p>
    </div>
--%>
@param boolean open
@param String heading
@param String description
@param boolean dismissible
@param ComponentMetadata _component
!{var cid = _component.className();}
!{var headingId = "lv-dialog-heading";}
!{var descId = "lv-dialog-desc";}
!{var hasHeading = heading != null && !heading.isEmpty();}
!{var hasDesc = description != null && !description.isEmpty();}
<div
    data-lievit-component="${cid}"
    data-lv-dialog
    data-lv-dialog-dismissible="${dismissible ? "true" : "false"}"
    hidden="${!open}"
    class="fixed inset-0 flex items-center justify-center"
    style="z-index: var(--lv-z-modal, 9500); background: var(--lv-color-overlay); padding: var(--lv-space-4); font-family: var(--lv-font-sans);"
>
    <%-- Backdrop: a sibling button covering the overlay so a click on the empty area closes
         (dismissible). Keeping it a real button keeps the close path CSP-clean + keyboard-safe. --%>
    @if(dismissible)
        <button
            type="button"
            data-lv-dialog-backdrop
            aria-label="Close dialog"
            l:click="close"
            class="absolute inset-0 w-full h-full"
            style="background: transparent; border: 0; cursor: pointer;"
        ></button>
    @endif
    <div
        data-lv-dialog-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="${hasHeading ? headingId : null}"
        aria-describedby="${hasDesc ? descId : null}"
        aria-label="${hasHeading ? null : "Dialog"}"
        class="relative flex flex-col"
        style="background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); box-shadow: var(--lv-shadow-md); width: min(90vw, 32rem); max-height: 85vh; overflow-y: auto;"
    >
        @if(hasHeading)
            <div
                class="flex items-center justify-between"
                style="gap: var(--lv-space-3); padding: var(--lv-space-4); border-bottom: 1px solid var(--lv-color-border);"
            >
                <div class="flex flex-col" style="gap: var(--lv-space-1);">
                    <h2
                        id="${headingId}"
                        data-lv-dialog-title
                        style="margin: 0; font-size: var(--lv-text-lg); font-weight: 600; color: var(--lv-color-fg);"
                    >${heading}</h2>
                    @if(hasDesc)
                        <p
                            id="${descId}"
                            data-lv-dialog-description
                            style="margin: 0; font-size: var(--lv-text-sm); color: var(--lv-color-muted); line-height: var(--lv-leading);"
                        >${description}</p>
                    @endif
                </div>
                <button
                    type="button"
                    data-lv-dialog-close
                    aria-label="Close dialog"
                    l:click="close"
                    style="background: transparent; border: 0; cursor: pointer; color: var(--lv-color-muted); line-height: 1; padding: var(--lv-space-1); border-radius: var(--lv-radius-sm); flex-shrink: 0; display: inline-flex;"
                >
                    @template.icon(name = "x", size = "1.25rem")
                </button>
            </div>
        @endif
        <%-- Owned body region: replace this with your dialog body markup (server-rendered). --%>
        <div
            data-lv-dialog-body
            style="padding: var(--lv-space-4); font-size: var(--lv-text-base); color: var(--lv-color-fg); line-height: var(--lv-leading); flex: 1;"
        >
            <p>Dialog content.</p>
        </div>
        <%-- Owned footer region: replace this with your action buttons (server-rendered). --%>
        <div
            data-lv-dialog-footer
            class="flex justify-end"
            style="gap: var(--lv-space-2); padding: var(--lv-space-3) var(--lv-space-4); border-top: 1px solid var(--lv-color-border);"
        >
            <button
                type="button"
                l:click="close"
                style="padding: var(--lv-space-2) var(--lv-space-3); background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); font-size: var(--lv-text-sm); color: var(--lv-color-fg); cursor: pointer;"
            >Close</button>
        </div>
    </div>
</div>
