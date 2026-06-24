@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui hover-card partial -- the floating preview card panel for a hover-card-trigger.

  TIER: PARTIAL + ENH (hover-card.enhancer.ts). The card content is fully server-rendered
  at page load time (the entity is known; no server round-trip on open). The open/close state
  is pure ephemeral client state; the enhancer (hover-card.enhancer.ts) owns show/hide timing,
  hover-grace delay, focus-open path, and Esc dismiss. Zero server round-trips just to open.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Tooltip pattern
  (https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) -- the correct pattern for a hover-
  triggered content preview whose body contains NO focusable elements. role="tooltip" on the
  panel + aria-describedby on the trigger wrapper (emitted by hover-card-trigger.jte) is the
  sufficient a11y mapping. popover="manual" is mandatory (not "auto"): the native light-dismiss
  fires on any outside click, which would fight the hover-grace-delay; the enhancer controls
  all show/hide transitions explicitly. CSS Anchor Positioning (position-anchor + position-area
  + position-try-fallbacks) is the shared popover seam for placement; no getBoundingClientRect.

  A11y (WAI-ARIA APG Tooltip):
  - role="tooltip" on the panel (server-rendered, static).
  - id matches cardId on the trigger wrapper's aria-describedby.
  - panel must NOT be aria-hidden (that would break the aria-describedby link for SR users).
  - No focus ever enters the card panel (APG: "Focus stays on the triggering element"). No
    tabindex on the panel or its children. No focus trap.
  - Esc while card is open: enhancer dismisses; focus stays on trigger (non-modal).
  - data-slot="hover-card" + data-variant="default" for CSS / test targeting.
  - header/content/footer slot divs are conditional to avoid empty DOM nodes.

  CONTENT CONSTRAINT (load-bearing): no interactive children (<a>, <button>, form controls)
  inside the card. The APG Tooltip pattern explicitly prohibits focusable elements inside the
  tooltip. A design needing clickable children must use popover or dialog instead.

  TOKENS consumed: --lv-color-popover, --lv-color-popover-fg, --lv-color-border,
  --lv-color-muted-fg, --lv-shadow-md, --lv-radius-lg, --lv-space-3, --lv-space-4,
  --lv-space-2, --lv-z-popover, --lv-font-sans, --lv-text-sm, --lv-text-xs, --lv-text-base.
  NET-NEW (additive): --lv-hover-card-max-width-{xs,sm,md,lg}, --lv-hover-card-open-duration,
  --lv-hover-card-close-duration (see hover-card.css for the :root declarations).

  EXTRA ATTRIBUTES -- two channels, by trust (the XSS decision rule):
    * attrs (TRUSTED, raw) -- $unsafe, STATIC author-typed strings only. Never DB-derived.
    * dataAttrs (SAFE, escaped) -- Map<String,String>; each value via Escape.htmlAttribute.

  Params:
    String             id          REQUIRED. Unique id; matches cardId on hover-card-trigger.
    String             placement   = "bottom"  Preferred CSS Anchor Positioning side.
                                   top | bottom | left | right | top-start | top-end |
                                   bottom-start | bottom-end.
    String             maxWidth    = "sm"  xs | sm | md | lg.
    String             cssClass    = ""    Extra utility classes on the card panel root.
    String             attrs       = ""    TRUSTED raw ($unsafe) -- STATIC strings only.
    Map<String,String> dataAttrs   = {}    SAFE dynamic data-* (value via Escape.htmlAttribute).
    gg.jte.Content     header      = null  Optional header region (avatar + name). Omitted when null.
    gg.jte.Content     content     REQUIRED. Card body (stats, bio, dates). No interactive children.
    gg.jte.Content     footer      = null  Optional footer (timestamp, secondary stat). Omitted when null.

  Usage:
    @@template.lievit.hover-card(
        id = "u-ada-card",
        content = @@`<p style="color:var(--lv-color-popover-fg)">Ada Lovelace, first programmer.</p>`
    )
    @@template.lievit.hover-card(
        id = "u-ada-card",
        maxWidth = "md",
        placement = "top",
        header = @@`<span>Ada Lovelace</span>`,
        content = @@`<p>First programmer. Babbage collaborator. 1815-1852.</p>`,
        footer = @@`<span>Joined 1840</span>`
    )
--%>
@param String id
@param String placement = "bottom"
@param String maxWidth = "sm"
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param Content header = null
@param Content content
@param Content footer = null

<%-- CSS Anchor Positioning: map the placement param to a CSS position-area value.
     The anchor-name is set on the trigger wrapper (hover-card-trigger.jte) as --hc-{id}. --%>
!{var anchorName = "--hc-" + id;}
!{var positionArea = switch (placement) {
    case "top"          -> "top center";
    case "top-start"    -> "top span-right";
    case "top-end"      -> "top span-left";
    case "bottom-start" -> "bottom span-right";
    case "bottom-end"   -> "bottom span-left";
    case "left"         -> "left center";
    case "right"        -> "right center";
    default             -> "bottom center"; // "bottom" (the default)
  };}

<%-- max-width mapped to the net-new structural token family. --%>
!{var maxWidthToken = "var(--lv-hover-card-max-width-" + maxWidth + ")";}

<%-- SAFE dynamic data-* attributes: each value escaped via Escape.htmlAttribute. JTE's HTML
     parser forbids a raw @for in attribute-NAME position, so we build the fragment once here.
     Keys must be simple identifiers ([A-Za-z][A-Za-z0-9-]*); a non-identifier key is dropped. --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<div
  id="${id}"
  role="tooltip"
  popover="manual"
  data-slot="hover-card"
  data-variant="default"
  data-max-width="${maxWidth}"
  class="lv-hover-card m-0 box-border rounded-[var(--lv-radius-lg)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-md)] ${cssClass}"
  style="font-family:var(--lv-font-sans); max-width:${maxWidthToken}; z-index:var(--lv-z-popover); position-anchor:${anchorName}; position-area:${positionArea}; position-try-fallbacks:flip-block,flip-inline; margin-block:var(--lv-space-2);"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>
  @if(header != null)
    <div data-slot="header" class="border-b border-[var(--lv-color-border)] px-[var(--lv-space-4)] py-[var(--lv-space-3)] text-[length:var(--lv-text-base)] font-[var(--lv-font-medium)] text-[var(--lv-color-popover-fg)]">${header}</div>
  @endif
  <div data-slot="content" class="px-[var(--lv-space-4)] py-[var(--lv-space-3)]">${content}</div>
  @if(footer != null)
    <div data-slot="footer" class="border-t border-[var(--lv-color-border)] px-[var(--lv-space-4)] py-[var(--lv-space-3)] text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)]">${footer}</div>
  @endif
</div>
