@import dev.lievit.component.ComponentMetadata
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui popover WIRE template -- the server-data-driven popover variant whose open-state lives
  server-side in PopoverComponent (ADR-0012 blueprint R4). Pairs with
  registry/wire/popover/PopoverComponent.java. For a STATIC popover use the popover.jte PARTIAL
  (native `popover` attribute, zero JS); this wire form is for when the panel CONTENT is derived
  from server state on open (gest's calendar-filter feed).

  TIER: WIRE. The open/closed state is server state (a @Wire boolean); the trigger fires the
  `toggle` action over the wire and the server re-renders this template with the panel CONTENT
  recomputed from server state, the client morphs it. No <slot>: the panel body is OWNED markup
  conditionally rendered (@if(open)), the server-first equivalent of children -- it CANNOT fail to
  project (the light-DOM slot bug the pivot exists to kill). The wire runtime renders this template
  with ONLY the component's @Wire fields + _component (JteTemplateAdapter), so the body is NOT a JTE
  Content slot supplied at call time: it is owned markup the adopter edits in their copy, or drives
  from a @Wire field / the _instance.

  STRUCTURE (scientific decision rule): WAI-ARIA dialog-popover (Radix Popover model), positioned
  with CSS Anchor Positioning, the SAME server-pure positioning the popover PARTIAL uses:
    - the trigger is a real <button> carrying aria-haspopup="dialog" + aria-expanded + aria-controls;
    - it carries anchor-name so the panel can anchor to it;
    - the panel is role="dialog" aria-modal="false" (non-modal), position-anchor'd to the trigger
      with position-area + flip-block (no @floating-ui/dom);
    - when closed the panel is absent from the DOM (the strongest projection proof), so collapsed
      content leaves the tab order + a11y tree.
  An adopter who needs the native popover's top-layer + light-dismiss adds the `popover` attribute
  to the panel and toggles it; the default keeps the panel in normal flow, server-toggled.

  A11y (Radix Popover, non-modal): button[aria-haspopup=dialog][aria-expanded][aria-controls] +
  div[role=dialog][aria-modal=false]; the closed panel is removed from the DOM; focus is not trapped.

  Params:
    label      String              the trigger label text (round-trips on the wire)
    open       boolean             popover open state (server-owned)
    disabled   boolean             when true the trigger is dimmed + the toggle action is a no-op (locked)
    _component ComponentMetadata   always-present wire metadata (the className anchor)

  Usage (copy this template in, then put YOUR panel markup in the data-popover-panel body, or
  derive it from a @Wire field in your component):
    <div data-popover-panel ...>
        <p>Your owned, server-rendered panel body here.</p>
    </div>
--%>
@param String label
@param boolean open
@param boolean disabled
@param ComponentMetadata _component
!{var cid = _component.className();}
!{var triggerId = "lv-popover-wire-trigger";}
!{var panelId = "lv-popover-wire-panel";}
!{var anchorName = "--lv-popover-wire-anchor";}
<div data-lievit-component="${cid}" class="relative inline-block" style="font-family: var(--lv-font-sans);">
    <button
        type="button"
        id="${triggerId}"
        class="inline-flex items-center"
        style="gap: var(--lv-space-1); padding: var(--lv-space-2) var(--lv-space-3); background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); font-size: var(--lv-text-sm); color: var(--lv-color-fg); cursor: ${disabled ? "not-allowed" : "pointer"}; opacity: ${disabled ? "0.5" : "1"}; anchor-name: ${anchorName};"
        aria-haspopup="dialog"
        aria-expanded="${open ? "true" : "false"}"
        aria-controls="${panelId}"
        l:click="toggle"
        data-popover-trigger
    >
        <span data-popover-label>${label}</span>
    </button>
    @if(open)
        <div
            id="${panelId}"
            role="dialog"
            aria-modal="false"
            data-popover-panel
            style="position: absolute; position-anchor: ${anchorName}; position-area: bottom span-all; position-try-fallbacks: flip-block; margin-block: var(--lv-space-1); min-width: 12rem; box-sizing: border-box; background: var(--lv-color-popover); color: var(--lv-color-popover-fg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); box-shadow: var(--lv-shadow-md); padding: var(--lv-space-4); font-size: var(--lv-text-sm); line-height: var(--lv-leading); z-index: var(--lv-z-popover);"
        >
            <%-- Owned panel body: replace this with your server-derived content (the filtered feed,
                 a permission-gated form). Recomputed from server state on each open. --%>
            <p data-popover-body>Popover content.</p>
        </div>
    @endif
</div>
