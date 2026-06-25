@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui tooltip partial -- a hover/focus-triggered floating description panel.

  TIER: PARTIAL + ENH (tooltip.enhancer.ts, minimal). The content is static server-rendered
  text; the open state is a purely client-side ephemeral concern (mouse position / keyboard
  focus is not worth a round-trip). The irreducible client piece -- show/hide timing (hover
  delay + instant focus, dismiss on blur/mouseleave/Esc), aria-describedby binding, and native
  popover attribute management -- lives in tooltip.enhancer.ts. Server renders both the trigger
  wrapper and the bubble (hidden via popover="manual"); the enhancer surfaces them on demand.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Tooltip pattern
  (https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) + tooltip ARIA role
  (https://w3c.github.io/aria/#tooltip). The bubble carries role="tooltip" and a stable id.
  The enhancer wires aria-describedby on the first focusable descendant of the wrapper (or
  the wrapper itself) at mount -- NOT server-side, because the trigger element identity is a
  rendering detail, not a template concern. Native popover="manual" is used so the UA hides
  the bubble by default and the enhancer calls showPopover()/hidePopover() explicitly. The
  popover="auto" mode is intentionally avoided: it adds UA light-dismiss-on-click, which
  conflicts with the hover/focus-driven show model. CSS Anchor Positioning (position-anchor +
  position-area) is the shared popover seam for all floating surfaces in lievit; the tooltip
  does not hand-roll getBoundingClientRect() or position:absolute math.

  A11y (WAI-ARIA Tooltip):
  - role="tooltip" on the bubble (server-rendered, static).
  - id on the bubble matches data-lievit-tooltip-id on the wrapper; enhancer resolves the
    pairing and sets aria-describedby at onInit; removes at onDestroy.
  - Keyboard: Tab into trigger -> shows immediately (focusin ignores delay). Tab/Shift+Tab
    out -> hides immediately (no hide-delay on focusout). Escape while visible -> dismisses;
    focus stays on trigger (APG rule: tooltip is non-modal, no focus trap). The Esc handler
    is registered on document (capture) only while the bubble is open and removed on hide.
  - Hover persistence: pointer from trigger to bubble cancels the hide timer (APG rule). The
    enhancer hooks pointerenter on the bubble to cancel the pending hide.
  - The tooltip never receives keyboard focus (APG rule); no roving tabindex.
  - No live region: content surfaces via aria-describedby, not aria-live.
  - Bubble omitted when content is blank (role="tooltip" on an empty element is a violation).

  Params:
    String         id          REQUIRED. Unique id stamped on the bubble and mirrored into
                               data-lievit-tooltip-id on the wrapper; the enhancer reads
                               these to wire aria-describedby.
    String         content     REQUIRED. Tooltip text (plain text; HTML-escaped by JTE's
                               default ${} -- never $unsafe; never the sole carrier of
                               essential information).
    gg.jte.Content trigger     REQUIRED. The element the tooltip describes (button, icon,
                               link, text span); rendered inside the wrapper span.
    String         variant     "default" | "info" | "warning" | "destructive". Intent maps to
                               the shared token pairs (--lv-color-<intent> bg + -fg text).
                               "default" uses --lv-color-popover so all floating surfaces
                               share a look at rest.
    String         placement   "top" | "top-start" | "top-end" | "bottom" | "bottom-start" |
                               "bottom-end" | "left" | "right" -- CSS Anchor Positioning
                               preferred placement (position-area). Falls back gracefully via
                               position-try-fallbacks. Default "top".
    int            delay       Hover show-delay in ms (default 600). 0 = immediate (useful
                               for icon-only buttons where the label IS the tooltip). focusin
                               always shows immediately regardless.
    int            hideDelay   Hover hide-delay in ms after mouseleave (default 0). Non-zero
                               lets the pointer traverse into the bubble (APG hover-persistence
                               rule).
    boolean        arrow       Render the directional CSS-only arrow (default true). The arrow
                               is a pseudo-element; no new token needed.
    String         maxWidth    Inline override for --_lv-tooltip-max-width (default "14rem").
                               A structural dimension, not a colour; safe in the style attr.
    boolean        disabled    When true the enhancer no-ops all events; bubble stays hidden.
                               Stamped as data-lievit-tooltip-disabled on the wrapper.
    String         cssClass    Extra utility classes on the bubble.
    String         attrs       TRUSTED raw ($unsafe) -- STATIC author-typed strings only, e.g.
                               data-testid="save-tooltip". Never interpolate DB-derived values.

  Usage:
    @@template.lievit.tooltip(id = "save-tip", content = "Save document", trigger = @@`
      <button>Save</button>
    `)
    @@template.lievit.tooltip(id = "del-tip", content = "Delete forever",
        variant = "destructive", placement = "bottom", delay = 0,
        trigger = @@`
      @@template.lievit.button(variant = "destructive", iconOnly = true, ariaLabel = "Delete",
          content = @@`@@template.lievit.icon(name = "trash-2", size = "1rem")`)
    `)
--%>
@param String id
@param String content
@param gg.jte.Content trigger
@param String variant = "default"
@param String placement = "top"
@param int delay = 600
@param int hideDelay = 0
@param boolean arrow = true
@param String maxWidth = "14rem"
@param boolean disabled = false
@param String cssClass = ""
@param String attrs = ""

<%-- CSS Anchor Positioning: map the placement param to a CSS position-area value.
     The spec placement vocabulary mirrors floating-ui/Radix and maps to the two-keyword
     position-area syntax (block-position inline-position). --%>
!{var positionArea = switch (placement) {
    case "top-start"    -> "top span-right";
    case "top-end"      -> "top span-left";
    case "bottom"       -> "bottom center";
    case "bottom-start" -> "bottom span-right";
    case "bottom-end"   -> "bottom span-left";
    case "left"         -> "left center";
    case "right"        -> "right center";
    default             -> "top center"; // "top" (the default)
  };}

<%-- Variant -> bg and fg token resolution (the shared intent vocabulary).
     "default" maps to the popover surface so all floating surfaces share a look at rest.
     No new token needed: the existing --lv-color-popover family is the correct bucket. --%>
!{var variantBg = switch (variant) {
    case "info"        -> "var(--lv-color-info)";
    case "warning"     -> "var(--lv-color-warning)";
    case "destructive" -> "var(--lv-color-destructive)";
    default            -> "var(--lv-color-popover)";
  };}
!{var variantFg = switch (variant) {
    case "info"        -> "var(--lv-color-info-fg)";
    case "warning"     -> "var(--lv-color-warning-fg)";
    case "destructive" -> "var(--lv-color-destructive-fg)";
    default            -> "var(--lv-color-popover-fg)";
  };}

<%-- The anchor name is set inline on the wrapper span via style so CSS Anchor Positioning
     can resolve the bubble's position-anchor reference. Both the anchor-name and
     position-anchor use the same CSS custom ident derived from the id param. --%>
!{var anchorName = "--" + id + "-anchor";}

<span
  data-controller="lv-tooltip"
  data-lievit-tooltip-wrapper
  data-lievit-tooltip-id="${id}"
  data-lievit-tooltip-delay="${delay}"
  data-lievit-tooltip-hide-delay="${hideDelay}"
  data-lievit-tooltip-placement="${placement}"
  data-lievit-tooltip-disabled="${disabled ? "true" : null}"
  class="relative inline-block"
  style="anchor-name:${anchorName};"
>
  <%-- trigger slot: the element whose focus/hover shows the tooltip --%>
  ${trigger}

  <%-- tooltip bubble: always present in the DOM, hidden via popover="manual" until the
       enhancer calls showPopover(). Omitted entirely when content is blank so a
       role="tooltip" is never present on an empty or missing element (APG + ARIA spec). --%>
  @if(content != null && !content.isBlank())
    <div
      id="${id}"
      role="tooltip"
      popover="manual"
      data-slot="tooltip"
      data-variant="${variant}"
      class="lv-tooltip m-0 box-border whitespace-normal rounded-[var(--lv-radius-sm)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-xs)] leading-[var(--lv-leading-tight)] shadow-[var(--lv-shadow-md)] ${cssClass}"
      style="background-color:${variantBg}; color:${variantFg}; --_lv-tooltip-max-width:${maxWidth}; max-width:var(--_lv-tooltip-max-width); font-family:var(--lv-font-sans); position-anchor:${anchorName}; position-area:${positionArea}; position-try-fallbacks:flip-block,flip-inline; margin-block:var(--lv-space-1); z-index:var(--lv-z-tooltip);"
      $unsafe{attrs}
    >${content}@if(arrow)<span class="lv-tooltip__arrow" aria-hidden="true"></span>@endif</div>
  @endif
</span>
