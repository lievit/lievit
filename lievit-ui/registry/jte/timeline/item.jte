@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui timeline.item partial -- one event node in a timeline (Ant Timeline.Item parity).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012). Zero JS, CSP-clean.

  STRUCTURE (scientific decision rule):
    A list item laid out as a two-column flex row: [node rail][content]. The rail holds a coloured
    dot and the vertical connector line drawn DOWNWARD to the next item; the last item suppresses
    the connector (last=true). `color` is a semantic intent mapped onto --lv-* tokens (the dot
    fill). An optional `dot` content slot replaces the default circle (e.g. an icon for a milestone).
    `label` is a small timestamp/meta line above the content.
    Inventory reference: Ant Design Timeline.Item (color, dot, label, pending). Original generation.

  A11y: an <li>; the dot + connector are aria-hidden decoration; the label + content carry meaning.

  Params:
    gg.jte.Content content              the event body.
    String color    = "primary"         dot intent: primary|success|warning|danger|info|muted
                                        OR a raw CSS colour used verbatim.
    String label    = null              optional meta line (timestamp) above the content.
    gg.jte.Content dot                  optional custom node slot replacing the default circle.
    boolean last    = false             suppress the downward connector (the final item).
    String cssClass = ""                extra utility classes on the <li>.
    String attrs    = ""                TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.timeline.item(color = "success", label = "10:00", content = @@`Created`)
    @@template.lievit.timeline.item(last = true, content = @@`Done`)
--%>
@param gg.jte.Content content
@param String color = "primary"
@param String label = null
@param gg.jte.Content dot = null
@param boolean last = false
@param String cssClass = ""
@param String attrs = ""

!{var dotColor = switch (color) {
    case "success" -> "var(--lv-color-success)";
    case "warning" -> "var(--lv-color-warning)";
    case "danger"  -> "var(--lv-color-danger)";
    case "info"    -> "var(--lv-color-info)";
    case "muted"   -> "var(--lv-color-muted-fg)";
    case "primary" -> "var(--lv-color-primary)";
    default        -> color;
  };}

<li
  data-slot="timeline-item"
  data-color="${color}"
  class="relative flex gap-[var(--lv-space-3)] pb-[var(--lv-space-5)] ${cssClass}"
  $unsafe{attrs}
>
  <%-- Node rail: the dot, plus the connector line drawn downward (absolute, behind the dot)
       unless this is the last item. aria-hidden: pure decoration. --%>
  <div data-slot="timeline-rail" aria-hidden="true" class="relative flex w-[var(--lv-space-4)] flex-none justify-center">
    @if(!last)
      <span data-slot="timeline-connector" class="absolute top-[var(--lv-space-4)] bottom-[calc(-1*var(--lv-space-5))] w-px" style="background:var(--lv-color-border);"></span>
    @endif
    @if(dot != null)
      <span data-slot="timeline-dot" class="relative z-10 inline-flex items-center justify-center" style="color:${dotColor};">${dot}</span>
    @else
      <span data-slot="timeline-dot" class="relative z-10 mt-[var(--lv-space-1)] block h-[0.625rem] w-[0.625rem] flex-none rounded-full" style="background:${dotColor};box-shadow:0 0 0 2px var(--lv-color-bg);"></span>
    @endif
  </div>
  <div data-slot="timeline-body" class="min-w-0 flex-1 pt-0">
    @if(label != null && !label.isBlank())
      <div data-slot="timeline-label" class="mb-[var(--lv-space-1)] text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)]" style="color:var(--lv-color-muted-fg);">${label}</div>
    @endif
    <div data-slot="timeline-content" class="text-[length:var(--lv-text-sm)] leading-[var(--lv-leading-normal)]" style="color:var(--lv-color-fg);">${content}</div>
  </div>
</li>
