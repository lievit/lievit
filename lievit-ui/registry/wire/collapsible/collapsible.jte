@import dev.lievit.component.ComponentMetadata
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui collapsible WIRE template -- a single disclosure trigger + region whose open
  state lives server-side in CollapsibleComponent (ADR-0012). Pairs with
  registry/wire/collapsible/CollapsibleComponent.java.

  TIER: WIRE. The open/closed state is server state (a @Wire boolean). The trigger click is owned
  by the `lv-collapsible` Stimulus controller (data-action, CSP-clean, no inline script) which
  routes it through the controlled/uncontrolled doctrine: this WIRE template is CONTROLLED (it
  stamps `data-lv-wire-toggle="toggle"`), so the click rides the wire, the server flips the @Wire
  boolean + re-renders this template, and the client morphs it. A standalone (non-wire) include
  that omits `data-lv-wire-toggle` is UNCONTROLLED and flips purely client-side (no round-trip).
  No <slot> (the light-DOM slot bug). The wire runtime renders this template with ONLY the
  component's @Wire fields + _component + _instance (JteTemplateAdapter), so the panel body is
  NOT a JTE Content slot supplied at call time: it is OWNED markup inside this region. The
  adopter edits the body region directly (this is copy-in source), or drives it from a @Wire
  field / the _instance. That is the server-first equivalent of "children": owned, server-rendered,
  cannot fail to project.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Disclosure pattern, Radix Collapsible as
  the a11y source (the same source the dropped Lit island cited):
    - the trigger is a real <button> carrying aria-expanded + aria-controls -> the region id;
    - the region carries the matching id, role="region", aria-labelledby -> the trigger id;
    - when closed the region is `hidden`, so collapsed content leaves the tab order + a11y tree;
    - Enter/Space activate the native <button> for free, no key handler needed.
  Native <button> + hidden beats a JS height-measure: zero client logic, CSP-clean, cannot fail
  to project (the whole point of the pivot).

  A11y (WAI-ARIA APG Disclosure): button[aria-expanded][aria-controls] + region[aria-labelledby],
  collapsed region removed from the a11y tree via `hidden`.

  Params:
    label    String      the trigger label text (round-trips on the wire)
    open     boolean     disclosure open state (server-owned)
    disabled boolean     when true the trigger is dimmed + the toggle action is a no-op (locked)
    _component ComponentMetadata  always-present wire metadata (the className anchor)

  Usage (copy this template in, then put YOUR panel markup in the data-collapsible-region body):
    <div data-collapsible-region ...>
        <p>Your owned, server-rendered body here.</p>
    </div>
--%>
@param String label
@param boolean open
@param boolean disabled
@param ComponentMetadata _component
!{var cid = _component.className();}
!{var triggerId = "lv-collapsible-trigger";}
!{var panelId = "lv-collapsible-panel";}
<div data-lievit-component="${cid}" class="block" style="font-family: var(--lv-font-sans);"
     data-controller="lv-collapsible"
     data-slot="collapsible"
     data-state="${open ? "open" : "closed"}"
     data-lv-wire-toggle="toggle"
     data-lv-collapsible-disabled-value="${disabled ? "true" : "false"}">
    <button
        type="button"
        id="${triggerId}"
        class="flex items-center justify-between w-full text-left"
        style="gap: var(--lv-space-3); padding: var(--lv-space-2) var(--lv-space-3); background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); font-size: var(--lv-text-sm); font-weight: 500; color: var(--lv-color-fg); cursor: ${disabled ? "not-allowed" : "pointer"}; opacity: ${disabled ? "0.5" : "1"};"
        aria-expanded="${open ? "true" : "false"}"
        aria-controls="${panelId}"
        data-action="click->lv-collapsible#toggle"
        data-lv-collapsible-target="trigger"
        data-slot="collapsible-trigger"
        data-collapsible-trigger
    >
        <span data-collapsible-label>${label}</span>
        <span aria-hidden="true" data-lv-collapsible-target="chevron" style="color: var(--lv-color-muted); flex-shrink: 0; display: inline-flex; transition: transform 0.2s ease; transform: rotate(${open ? "180" : "0"}deg);">
            @template.icon(name = "chevron-down", size = "1rem")
        </span>
    </button>
    <div
        id="${panelId}"
        role="region"
        aria-labelledby="${triggerId}"
        hidden="${!open}"
        data-lv-collapsible-target="region"
        data-slot="collapsible-content"
        data-collapsible-region
        style="padding: var(--lv-space-3); font-size: var(--lv-text-base); color: var(--lv-color-fg); line-height: var(--lv-leading);"
    >
        <%-- Owned body region: replace this with your panel markup (server-rendered). --%>
        <p data-collapsible-body>Collapsible content.</p>
    </div>
</div>
