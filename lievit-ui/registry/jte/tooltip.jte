@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui tooltip partial -- a floating contextual label, CSS-only (no JS).

  TIER: STATIC presentational -> JTE partial. The former <lv-tooltip> island used Floating UI
  + Lit state to toggle a panel. Per ADR-0012 the server-pure path is CSS: the label text is
  already in the DOM and revealed by the wrapper's :hover / :focus-within. No positioning JS;
  the label sits above the trigger in flow (absolute, bottom-full). Escape-to-dismiss (an
  island nicety needing a listener) is dropped; leaving / blurring the trigger hides it, which
  satisfies the APG dismissable requirement for a CSS tooltip.

  STRUCTURE (scientific decision rule): WAI-ARIA APG tooltip pattern rendered with Tailwind
  group-hover / group-focus-within. The trigger references the label via aria-describedby (the
  APG contract) so assistive tech announces the description on focus; the visual reveal is the
  CSS group toggle. A real tooltip role + aria-describedby is what makes this a tooltip rather
  than a decorative title attribute, so both are kept.

  A11y (WAI-ARIA tooltip): panel has role="tooltip" + a stable id; the trigger carries
  aria-describedby pointing at that id, so the label is announced on hover AND on keyboard focus.

  Params:
    gg.jte.Content trigger             the element the tooltip describes.
    String         content             the tooltip label text.
    String         tipId   = "lv-tooltip"  id linking aria-describedby to the label.
    String         cssClass = ""       extra utility classes on the wrapper.

  Usage:
    @@template.tooltip(content = "Save document", tipId = "save-tip", trigger = @@`
      <button aria-describedby="save-tip">Save</button>
    `)
--%>
@param gg.jte.Content trigger
@param String content
@param String tipId = "lv-tooltip"
@param String cssClass = ""

<span data-slot="tooltip" class="group relative inline-block ${cssClass}">
  <span data-slot="tooltip-trigger" aria-describedby="${tipId}" class="inline-block">${trigger}</span>
  <span
    data-slot="tooltip-panel"
    id="${tipId}"
    role="tooltip"
    class="invisible absolute bottom-full left-1/2 z-[var(--lv-z-popover)] mb-[var(--lv-space-1)] -translate-x-1/2 rounded-[var(--lv-radius-sm)] bg-[var(--lv-color-fg)] px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] whitespace-nowrap text-[var(--lv-color-bg)] opacity-0 shadow-[var(--lv-shadow-md)] transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
    style="font-family:var(--lv-font-sans);"
  >${content}</span>
</span>
