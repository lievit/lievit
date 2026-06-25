@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui accordion partial -- a vertically stacked list of disclosure panels.

  TIER: PARTIAL presentational (controlled/uncontrolled). Zero JS, zero server round-trip
  just to open or close a panel. The browser owns the open/close state (uncontrolled mode via
  native <details>); when expansion is a server fact the CALLER binds open="${yourField}" on
  each accordion-item (controlled mode). The accordion itself declares no @Wire field and no
  Java component. This is the arch-contract §1 PARTIAL tier: overlay + stateful primitives as
  headless controlled/uncontrolled, never bespoke WIRE.

  STRUCTURE (scientific decision rule):
    WAI-ARIA APG Accordion (https://www.w3.org/WAI/ARIA/apg/patterns/accordion/): each panel
    is a native <details>/<summary> pair -- the platform gives aria-expanded, Enter/Space
    activation, Tab traversal, and (with <details name=...>) single-open exclusivity for free.
    This is the "platform does it all" composition the spec endorses. No enhancer, no roving
    tabindex, no focus trap (APG defines none of these for Accordion).

    Uncontrolled (default): the caller omits open= on each item; the browser persists the
    expanded state client-side for the lifetime of the page.
    Controlled: the caller binds open="${yourWireField.contains(itemId)}" on each item; the
    server renders which panels are open; a wire action on the trigger button on the CALLER
    side updates the state and re-renders. The accordion-item partial is a pure presentation
    shell in both modes.

    Single-mode exclusivity: pass a shared name= to every sibling accordion-item; the
    platform <details name=...> group ensures at most one is open at a time -- zero JS.
    Multiple-mode: omit name= (each item is independent).

    Inventory reference: Ant Design Collapse (ghost/borderless/default variants, dividers,
    multiple-expand, nested panels). Original generation; no Ant Design code copied.
    Styling: inspired by Tailwind UI disclosure; original generation over --lv-* tokens.

  A11y (WAI-ARIA APG Accordion):
    - Native <details> exposes aria-expanded automatically (the browser owns it).
    - Native <summary> is the disclosure trigger (role=button, Enter/Space, Tab: platform).
    - Panel body: role="region" + aria-labelledby on the content <div> inside each item.
    - Keyboard: Enter/Space on summary = platform; Tab/Shift+Tab = standard page order;
      ArrowDown/Up/Home/End = NOT in APG Accordion; intentionally absent.
    - Focus: no trap, no roving tabindex, no restore -- standard page Tab sequence.
    - No live region (the expand/collapse is visible in-place; no AT announcement needed).
    - No enhancer: all keyboard + role + focus is platform-supplied.
    - Stimulus migration: nothing to convert. This component has ZERO client JS by design (the
      platform owns disclosure via native <details>); it ships NO lv-* Stimulus controller and
      needs none. There is no enhancer, WeakSet, or data-*-enhanced marker to delete.

  Params:
    gg.jte.Content content           the accordion items (zero or more @@template.lievit.accordion-item(...)).
    String variant     = "default"   "default" (bordered card) | "ghost" (dividers only, transparent outer) |
                                     "borderless" (fully flat, no borders).
    String cssClass    = ""          extra utility classes on the root container.
    String attrs       = ""          TRUSTED raw attribute string ($unsafe) -- STATIC, author-typed
                                     strings only (data-testid, wire directives on root).

  Usage:
    @@template.lievit.accordion(variant = "default", content = @@`
      @@template.lievit.accordion-item(label = "Section one", id = "alpha", open = true,
          name = "faq",
          content = @@`<p>Body of the first section.</p>`)
      @@template.lievit.accordion-item(label = "Section two", id = "beta",
          name = "faq",
          content = @@`<p>Body of the second section.</p>`)
    `)
    @@template.lievit.accordion(variant = "ghost",
        content = @@`
          @@template.lievit.accordion-item(label = "Terms", id = "terms",
              content = @@`<p>These are the terms.</p>`)
        `)
--%>
@param gg.jte.Content content
@param String variant = "default"
@param String cssClass = ""
@param String attrs = ""

<%-- Variant-driven outer container style. Ghost and borderless suppress the outer
     border/shadow/radius; dividers between items are controlled per-item in accordion-item.jte. --%>
!{var variantStyle = switch (variant) {
    case "ghost"      -> "background:transparent;border:0;box-shadow:none;border-radius:0;";
    case "borderless" -> "background:transparent;border:0;box-shadow:none;border-radius:0;";
    default           -> "background:var(--lv-color-popover);border:1px solid var(--lv-color-border);border-radius:var(--lv-radius-md);box-shadow:var(--lv-shadow-xs);overflow:hidden;";
  };}

<div
  data-slot="accordion"
  data-variant="${variant}"
  class="${cssClass}"
  style="font-family:var(--lv-font-sans);${variantStyle}"
  $unsafe{attrs}
>
  ${content}
</div>
