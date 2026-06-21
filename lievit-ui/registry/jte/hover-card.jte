@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui hover-card partial -- a hover/focus-triggered preview card, CSS-only (no JS).

  TIER: STATIC presentational -> JTE partial. The former <lv-hover-card> island used Floating
  UI + open/close timers + Lit state. Per ADR-0012 the server-pure path is CSS: the panel
  content is ALREADY in the DOM and is revealed by the group's :hover / :focus-within, with no
  client state and no positioning JS. The open/close delay nuance is dropped deliberately (a
  delay needs a timer = client state); the gap between trigger and panel is kept crossable by
  laying the panel directly under the trigger with a small token offset.

  STRUCTURE (scientific decision rule): Radix's hover-card MODEL (preview affordance, not an
  announced popup) rendered with a CSS group-hover reveal. Tailwind's group + group-hover /
  group-focus-within utilities express "show the panel when the trigger area is hovered or
  focused" without any script -- the canonical CSS-only disclosure. A preview card sits in normal
  flow under its trigger (side=bottom, the Radix default); no CSS Anchor Positioning needed.

  POSITIONING (server-first equivalent of Radix align/sideOffset): shadcn places HoverCardContent
  with align=center default + sideOffset=4. We map `align` (start/center/end) to the horizontal
  anchoring under the trigger and `sideOffset` to the token gap below it, computed at render time;
  `data-align` mirrors Radix's data attribute so a stylesheet can hook it. side stays bottom (a
  preview reads below its trigger); flip it in your own copy if a layout needs it.

  A11y (Radix preview model): the trigger is a normal interactive element; the panel carries
  NO ARIA role and is aria-hidden="true" -- it is a sighted-pointer/keyboard preview, so the
  same information MUST also be reachable in the page flow for assistive tech. Not focus-trapping.

  Params:
    gg.jte.Content trigger             the trigger element (a link / button / text).
    gg.jte.Content content             the preview body, revealed on hover/focus.
    String         align   = "center"  one of: start | center | end (horizontal anchoring).
    String         sideOffset = null  the gap below the trigger (a token; defaults to the level-1
                                    spacing token when null).
    String         cssClass = ""       extra utility classes on the wrapper.

  Usage:
    @@template.lievit.hover-card(
      trigger = @@`<a href="/u/ada">@@ada</a>`,
      content = @@`<p>Ada Lovelace, first programmer.</p>`
    )
    @@template.lievit.hover-card(align = "end", trigger = @@`...`, content = @@`...`)
--%>
@param gg.jte.Content trigger
@param gg.jte.Content content
@param String align = "center"
@param String sideOffset = null
@param String cssClass = ""

!{var customOffset = sideOffset != null && !sideOffset.isBlank();}
<%--
  The gap below the trigger. By DEFAULT the level-1 spacing token, applied as a bracketed Tailwind
  margin-top class (so the dimension reads a spacing token); a caller sideOffset overrides it inline.
--%>
!{var offsetClass = customOffset ? "" : "mt-[var(--lv-space-1)]";}
!{var offsetStyle = customOffset ? "margin-top:" + sideOffset + ";" : "";}
<%-- align maps to the horizontal anchoring of the preview under its trigger. --%>
!{var alignPos = switch (align) {
    case "center" -> "left:50%; transform:translateX(-50%);";
    case "end"    -> "right:0;";
    default       -> "left:0;"; // start
  };}

<span data-slot="hover-card" class="group relative inline-block ${cssClass}">
  <span data-slot="hover-card-trigger" class="inline-block">${trigger}</span>
  <span
    data-slot="hover-card-content"
    data-align="${align}"
    aria-hidden="true"
    class="invisible absolute top-full z-[var(--lv-z-popover)] ${offsetClass} box-border block w-[16rem] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] p-[var(--lv-space-4)] text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-popover-fg)] opacity-0 shadow-[var(--lv-shadow-md)] transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
    style="font-family:var(--lv-font-sans); ${offsetStyle} ${alignPos}"
  >${content}</span>
</span>
