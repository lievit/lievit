@import java.util.Map
@import dev.lievit.component.ComponentMetadata
@import dev.lievit.kit.SlideOver
@import dev.lievit.kit.wire.SlideOverComponent
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit slide-over WIRE template (roadmap K2) -- a right-anchored detail panel hosting a
  record's resolved Infolist, built ON the drawer wire. Pairs with SlideOverComponent.

  TIER: WIRE. Same open-state-server model as the drawer: `open` is a @Wire boolean, the trigger
  fires `open`, the backdrop / close button fire `close`, the server re-renders and the client
  morphs. It reuses the drawer's data-lv-drawer structure (right-anchored, role=dialog, hidden when
  closed) so the drawer's typed-TS focus-trap / Escape enhancement applies unchanged -- this does
  NOT reinvent the open/close/focus-trap, it adds the hosted Infolist content. No <slot> (the
  light-DOM slot bug): the body iterates the resolved SlideOver entries read off the live instance.

  A11y (WAI-ARIA APG Dialog/Modal): div[role=dialog][aria-modal=true] labelled by the heading;
  closed overlay removed from the a11y tree via `hidden`.

  Params:
    open        boolean    modal open state (server-owned)
    heading     String     panel title; wired to aria-labelledby (empty hides the header)
    dismissible boolean    when true the backdrop + Escape route to `close`
    recordId    String     the shown record id (re-resolved each render on the instance)
    _instance   SlideOverComponent  the live component (carries the resolved SlideOver content)
    _component  ComponentMetadata   always-present wire metadata (the className anchor)
--%>
@param boolean open
@param String heading
@param boolean dismissible
@param String recordId
@param SlideOverComponent _instance
@param ComponentMetadata _component
!{var cid = _component.className();}
!{var headingId = "lv-slide-over-heading";}
!{var hasHeading = heading != null && !heading.isEmpty();}
!{SlideOver content = _instance.content();}
<div
    data-lievit-component="${cid}"
    data-lv-drawer
    data-lv-slide-over
    data-lv-drawer-side="right"
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
        aria-label="${hasHeading ? null : "Detail"}"
        class="fixed flex flex-col"
        style="top: 0; right: 0; bottom: 0; width: min(90vw, 28rem); border-left: 1px solid var(--lv-color-border); z-index: 1; background: var(--lv-color-bg); box-shadow: var(--lv-shadow-md); overflow-y: auto;"
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
        <%-- Owned body region: the hosted Infolist, resolved server-side (never a <slot>). --%>
        <div
            data-lv-drawer-body
            data-lv-slide-over-body
            style="padding: var(--lv-space-4); font-size: var(--lv-text-base); color: var(--lv-color-fg); line-height: var(--lv-leading); flex: 1; overflow-y: auto;"
        >
            @if(content != null && content.hasEntries())
                <dl data-lv-slide-over-entries>
                    @for(Map.Entry<String, String> entry : content.entries().entrySet())
                        <div data-lv-slide-over-entry="${entry.getKey()}">
                            <dt>${entry.getKey()}</dt>
                            <dd>${entry.getValue()}</dd>
                        </div>
                    @endfor
                </dl>
            @else
                <p data-lv-slide-over-empty>No record selected.</p>
            @endif
        </div>
    </div>
</div>
