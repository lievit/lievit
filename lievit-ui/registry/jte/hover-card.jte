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
  laying the panel directly under the trigger with no margin and a small padding bridge.

  STRUCTURE (scientific decision rule): Radix's hover-card MODEL (preview affordance, not an
  announced popup) rendered with a CSS group-hover reveal. Tailwind's group + group-hover /
  group-focus-within utilities express "show the panel when the trigger area is hovered or
  focused" without any script -- the canonical CSS-only disclosure. No CSS Anchor Positioning
  is needed because a preview card sits in normal flow under its trigger (absolute, top-full).

  A11y (Radix preview model): the trigger is a normal interactive element; the panel carries
  NO ARIA role and is aria-hidden="true" -- it is a sighted-pointer/keyboard preview, so the
  same information MUST also be reachable in the page flow for assistive tech. Not focus-trapping.

  Params:
    gg.jte.Content trigger             the trigger element (a link / button / text).
    gg.jte.Content content             the preview body, revealed on hover/focus.
    String         cssClass = ""       extra utility classes on the wrapper.

  Usage:
    @@template.lievit.hover-card(
      trigger = @@`<a href="/u/ada">@@ada</a>`,
      content = @@`<p>Ada Lovelace, first programmer.</p>`
    )
--%>
@param gg.jte.Content trigger
@param gg.jte.Content content
@param String cssClass = ""

<span data-slot="hover-card" class="group relative inline-block ${cssClass}">
  <span data-slot="hover-card-trigger" class="inline-block">${trigger}</span>
  <span
    data-slot="hover-card-panel"
    aria-hidden="true"
    class="invisible absolute top-full left-0 z-[var(--lv-z-popover)] mt-[var(--lv-space-1)] box-border block w-[16rem] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] p-[var(--lv-space-4)] text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-popover-fg)] opacity-0 shadow-[var(--lv-shadow-md)] transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
    style="font-family:var(--lv-font-sans);"
  >${content}</span>
</span>
