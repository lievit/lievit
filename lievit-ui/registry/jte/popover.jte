@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui popover partial -- a click-triggered floating panel anchored to a trigger, with
  ZERO shipped JS. This is the LOAD-BEARING overlay seam (ADR-0012 blueprint R4): dropdown-menu,
  the calendar-filter popover and any anchored panel build on this exact mechanism.

  TIER: STATIC presentational -> JTE partial. The former <lv-popover> island held `open` in Lit
  reactive state, projected the trigger + body through native <slot>s (inert in light DOM, so the
  body silently never rendered -- the bug ADR-0012 was written to kill) and positioned with
  @floating-ui/dom. Per ADR-0012 R4 the server-pure path replaces ALL of that with platform
  primitives:
    - SHOW/HIDE = the native HTML `popover` attribute. A <button popovertarget> toggles a
      `popover="auto"` panel: the browser shows/hides it, renders it in the TOP LAYER (escapes
      overflow/stacking contexts with no z-index war), light-dismisses on outside-click + Escape,
      and wires the trigger's aria-expanded / aria-details automatically. No JS, CSP-clean.
    - POSITION = CSS Anchor Positioning. The popover + its invoker have an IMPLICIT anchor
      reference (MDN: "Popover anchor positioning"); we also set an explicit anchor-name /
      position-anchor so positioning is robust where the implicit ref is gated. position-area
      places the panel under the trigger; position-try-fallbacks=flip-block flips it above when
      the bottom is cramped (the offset+flip(){} the island used floating-ui for).
  Both the panel and ITS CONTENT are OWNED, server-rendered markup (the `content` Content slot is
  filled by the caller's @`...` block and rendered with ${content}); the panel is always present
  in the DOM, the `popover` attribute hides it until shown, so the content CANNOT fail to project.

  WIRE variant (server-data-driven content, e.g. gest's calendar-filter feed): keep this exact
  native-popover chrome, but render a WIRE region INSIDE the panel content. The browser still owns
  show/hide (native popover); the wire owns the server feed + filter state. See
  registry/wire/popover/ for the open-state-held-server-side form and its render-asserting IT.

  STRUCTURE (scientific decision rule): a non-modal floating panel (shadcn Popover model) rendered
  with the platform Popover API + CSS Anchor Positioning instead of floating-ui + a Lit reactive
  tree. The native popover gives the dismiss + top-layer + focus + ARIA the island re-implemented;
  CSS anchor positioning gives the flip/shift. The non-modal default (popover="auto") matches
  shadcn's non-modal popover: focus is NOT trapped, the page stays interactive behind it.

  A11y (Popover API + shadcn model): the trigger is a real <button popovertarget> -> the browser
  sets aria-expanded + aria-details to the content id while open; Escape + outside-click dismiss for
  free; focus is not trapped; the content is reachable from the trigger via the implicit popover
  relationship. The content carries NO role="dialog" (shadcn's PopoverContent is a plain styled
  panel with no role): a role="dialog" with no accessible name lies to AT, so it is dropped -- the
  native popover relationship is the announced affordance.

  Params:
    String         id = "lv-popover"   the panel id (the popovertarget link target). Unique per page.
    gg.jte.Content trigger             the trigger CONTENT (label / icon) inside the <button>.
    gg.jte.Content content             the panel body, OWNED + server-rendered (never a <slot>).
    String         placement = "bottom" "bottom" | "top": the preferred side (flips when cramped).
    boolean        disabled = false    disables the trigger so the popover cannot open.
    String         cssClass = ""       extra utility classes on the wrapper.

  Usage:
    @@template.lievit.popover(
      id = "user-popover",
      trigger = @@`Open`,
      content = @@`<p>Panel body, server-rendered.</p>`
    )
--%>
@param String id = "lv-popover"
@param gg.jte.Content trigger
@param gg.jte.Content content
@param String placement = "bottom"
@param boolean disabled = false
@param String cssClass = ""
!{var anchorName = "--" + id + "-anchor";}
!{var area = "top".equals(placement) ? "top span-all" : "bottom span-all";}

<span data-slot="popover" class="relative inline-block ${cssClass}" style="font-family:var(--lv-font-sans);">
  <button
    type="button"
    data-slot="popover-trigger"
    popovertarget="${id}"
    disabled="${disabled}"
    class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
    style="anchor-name:${anchorName};"
  >${trigger}</button>

  <div
    id="${id}"
    popover="auto"
    data-slot="popover-content"
    class="m-0 box-border min-w-[12rem] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] p-[var(--lv-space-4)] text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-md)]"
    style="position-anchor:${anchorName}; position-area:${area}; position-try-fallbacks:flip-block; margin-block:var(--lv-space-1); z-index:var(--lv-z-popover); font-family:var(--lv-font-sans);"
  >${content}</div>
</span>
