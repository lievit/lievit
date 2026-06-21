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
      places the panel on the preferred side; position-try-fallbacks=flip-block flips it when the
      preferred side is cramped (the offset+flip(){} the island used floating-ui for).
  Both the panel and ITS CONTENT are OWNED, server-rendered markup (the `content` Content slot is
  filled by the caller's @`...` block and rendered with ${content}); the panel is always present
  in the DOM, the `popover` attribute hides it until shown, so the content CANNOT fail to project.

  ANCHOR DECOUPLING (shadcn PopoverAnchor): by default the TRIGGER button is the anchor
  (anchor-name on the button). Pass `anchorId` to anchor the panel to a DIFFERENT element instead
  (give that element style="anchor-name:--<anchorId>-anchor;" + data-slot="popover-anchor"); the
  panel then positions against the anchor while the (possibly far-away) trigger still toggles it.

  ALIGN (shadcn `align` prop: start | center | end): the inline-axis alignment of the panel
  relative to the anchor, mapped to the position-area inline span -- start = span the inline-end
  side (panel left edge tracks the anchor), center = centred, end = span the inline-start side.
  data-align mirrors it for styling/testing.

  HEADER / LABELLING (shadcn PopoverHeader/Title/Description): pass a `title` (+ optional
  `description`) and the panel becomes a LABELLED dialog -- role="dialog" + aria-labelledby the
  title id (and aria-describedby the description id when present). This is the shadcn-faithful
  labelled-dialog: the Type-1 fix dropped role="dialog" precisely because the bare panel had no
  accessible name; WITH a title the name exists, so the dialog role is honest again. A header-less
  popover stays a plain styled panel with NO role (the announced affordance is the native popover
  relationship), exactly as before.

  WIRE variant (server-data-driven content, e.g. gest's calendar-filter feed): keep this exact
  native-popover chrome, but render a WIRE region INSIDE the panel content. See
  registry/wire/popover/ for the open-state-held-server-side form and its render-asserting IT.

  A11y: the trigger is a real <button popovertarget> -> the browser sets aria-expanded +
  aria-details to the content id while open; Escape + outside-click dismiss for free; focus is not
  trapped. A header-less panel carries NO role (a role="dialog" with no accessible name lies to
  AT); a titled panel carries role="dialog" + aria-labelledby (+ aria-describedby).

  Params:
    String         id = "lv-popover"   the panel id (the popovertarget link target). Unique per page.
    gg.jte.Content trigger             the trigger CONTENT (label / icon) inside the <button>.
    gg.jte.Content content             the panel body, OWNED + server-rendered (never a <slot>).
    gg.jte.Content title    = null     a header title; renders a PopoverHeader + makes it a labelled dialog.
    gg.jte.Content description = null   a muted subtitle under the title (PopoverDescription).
    String         placement = "bottom" "bottom" | "top": the preferred block side (flips when cramped).
    String         align    = "center" "start" | "center" | "end": inline-axis alignment vs the anchor.
    String         anchorId = ""       anchor the panel to this element's --<anchorId>-anchor instead
                                        of the trigger (shadcn PopoverAnchor decoupling).
    boolean        disabled = false    disables the trigger so the popover cannot open.
    String         cssClass = ""       extra utility classes on the wrapper.

  Usage:
    @@template.lievit.popover(
      id = "user-popover",
      trigger = @@`Open`,
      title = @@`Dimensions`,
      description = @@`Set the box size.`,
      content = @@`<p>Panel body, server-rendered.</p>`
    )
--%>
@param String id = "lv-popover"
@param gg.jte.Content trigger
@param gg.jte.Content content
@param gg.jte.Content title = null
@param gg.jte.Content description = null
@param String placement = "bottom"
@param String align = "center"
@param String anchorId = ""
@param boolean disabled = false
@param String cssClass = ""
!{var anchorName = anchorId.isEmpty() ? "--" + id + "-anchor" : "--" + anchorId + "-anchor";}
!{var block = "top".equals(placement) ? "top" : "bottom";}
!{var inline = switch (align) {
    case "start" -> "span-right";
    case "end"   -> "span-left";
    default      -> "center";
  };}
!{var area = block + " " + inline;}
!{var labelled = title != null;}
!{var titleId = id + "-title";}
!{var descId = id + "-description";}

<span data-slot="popover" class="relative inline-block ${cssClass}" style="font-family:var(--lv-font-sans);">
  <button
    type="button"
    data-slot="popover-trigger"
    popovertarget="${id}"
    disabled="${disabled}"
    class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
    style="${anchorId.isEmpty() ? "anchor-name:" + anchorName + ";" : ""}"
  >${trigger}</button>

  <div
    id="${id}"
    popover="auto"
    data-slot="popover-content"
    data-align="${align}"
    role="${labelled ? "dialog" : null}"
    aria-labelledby="${labelled ? titleId : null}"
    aria-describedby="${labelled && description != null ? descId : null}"
    class="m-0 box-border min-w-[12rem] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] p-[var(--lv-space-4)] text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-md)]"
    style="position-anchor:${anchorName}; position-area:${area}; position-try-fallbacks:flip-block; margin-block:var(--lv-space-1); z-index:var(--lv-z-popover); font-family:var(--lv-font-sans);"
  >
    @if(labelled)
      <div data-slot="popover-header" class="grid gap-[var(--lv-space-1)] mb-[var(--lv-space-2)]">
        <div data-slot="popover-title" id="${titleId}" class="text-[length:var(--lv-text-base)] font-[var(--lv-font-semibold)] leading-none">${title}</div>
        @if(description != null)
          <div data-slot="popover-description" id="${descId}" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">${description}</div>
        @endif
      </div>
    @endif
    ${content}
  </div>
</span>
