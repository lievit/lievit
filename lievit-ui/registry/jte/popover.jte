@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui popover partial -- the shared positioning + light-dismiss + focus-return SEAM.
  Every non-modal overlay in lievit composes this: dropdown-menu, select, combobox, tooltip,
  hover-card, date-picker, context-menu, command, mentions. This is NOT a standalone tooltip
  bubble; it is the ONE mechanism so no overlay hand-rolls anchor positioning or light-dismiss.

  TIER: PARTIAL + ENH (popover-anchor.enhancer.ts handles the one irreducible client bit:
  CSS Anchor Positioning fallback wiring + focus-return bookkeeping on light-dismiss).
  This template is a CONTROLLED / UNCONTROLLED headless overlay (NOT a bespoke WIRE component):
    UNCONTROLLED (default, controlled=false): the panel is always present in the DOM; the
      browser's native popover API (popovertarget + popovertargetaction="toggle") shows/hides
      it client-side. Zero JS, zero wire round-trip. open-state is ephemeral (browser-owned).
    CONTROLLED (controlled=true): the caller OWNS an open-state field (e.g. a @Wire boolean on
      a parent component). The panel is present in the DOM only when open=true (server conditional).
      The trigger's l:click action is wired by the CALLER's owned copy (copy-in pattern); the seam
      does not hardcode it. This covers: content fetched on open; open must survive a round-trip;
      open is a genuine business fact.
  The open-state is NOT owned by this partial: the partial holds no @Wire field, no Java component,
  no _component/_instance/_componentSnapshot params.

  STRUCTURE (scientific decision rule):
    a11y source: WAI-ARIA APG Disclosure (Show/Hide) pattern
      (https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) for the trigger/panel pair; the native
      HTML popover attribute (MDN + open-ui.org) supplies the browser-native light-dismiss +
      top-layer seam. No APG "Popover" pattern exists -- the APG Disclosure + native popover +
      context-specific ARIA roles (added by the composing component) is the correct assembly.
    positioning: CSS Anchor Positioning Level 1 (anchor-name / position-anchor / position-area).
      All twelve placement positions map to CSS position-area values; no JS positioning loop.
      NO @floating-ui/dom; NO hand-rolled pixel-offset JS.

  A11y (APG Disclosure + native popover attribute):
    Trigger: real native button, role implicit (button); aria-expanded server-emitted from open;
      aria-controls points to the panel id. popovertarget + popovertargetaction="toggle" wire the
      browser's native open/close signal (Enter, Space, click). The browser also sets the implicit
      anchor relationship (popover invoker target); we additionally set explicit anchor-name /
      position-anchor for CSS AP.
    Panel: popover attribute on a div (or semantically appropriate container); no fixed ARIA role
      on the seam itself -- the composing component adds role="menu" / "listbox" / "dialog" etc.
      An optional title + description make the panel a labelled dialog (role="dialog" +
      aria-labelledby) when the popover carries interactive or confirmable content.
    Keyboard (APG Disclosure + native popover):
      Enter / Space on trigger: toggle open/close (platform, native button)
      Escape: closes auto/hint popover (native browser signal); popover-anchor.enhancer.ts syncs
        the server close() action when the panel is controlled.
      Tab: non-trapping -- focus moves naturally through and out of the panel (non-modal).
    Focus: focus-return on Esc is native (browser popover spec); focus-return on light-dismiss
      (click-outside) is the enhancer's responsibility via data-lv-opener on the panel.
      No focus trap (use dialog/drawer + focus-trap.enhancer.ts for modal overlays).

  Enhancer wiring (data-attribute contract, READ runtime/features/popover-anchor.enhancer.ts):
    Panel carries: popover="${type}" (native), data-lv-opener="${triggerId}" (focus-return).
    Trigger carries: id="${triggerId}", style="anchor-name: --${triggerId}".
    Panel carries: style="position-anchor: --${triggerId}; position-area: <value>; ...".
    Inside panel: [data-lv-autofocus] -- the element the enhancer moves focus to after open.
    The enhancer fires close() wire action on light-dismiss in controlled mode; it finds the
    component root via panel.closest("[data-lievit-component]").

  Params:
    String          id         = "lv-popover"   the panel id (the popovertarget link). Unique per page.
                                                Derives triggerId="${id}-trigger" and panelId="${id}".
    gg.jte.Content  trigger                     the trigger CONTENT (label / icon) inside the button.
    gg.jte.Content  content                     the panel body, OWNED + server-rendered.
    boolean         open       = false           controlled state: true = panel present in DOM.
                                                Ignored when controlled=false (always rendered).
    boolean         controlled = false           false = uncontrolled (browser owns open state);
                                                true  = server owns open state via the open param.
    String          placement  = "bottom-start" CSS Anchor Positioning placement: one of the twelve
                                                positions (bottom-start | bottom | bottom-end |
                                                top-start | top | top-end | left-start | left |
                                                left-end | right-start | right | right-end).
    String          type       = "auto"         native popover type: auto | manual | hint.
                                                auto = light-dismiss + Esc; manual = neither.
    int             offset     = 4              gap in px between trigger and panel.
    boolean         withArrow  = false          render a decorative caret pointing at the trigger.
    String          variant    = "default"      panel surface: default | muted | destructive.
    String          cssClass   = ""             extra utility classes on the trigger button.
    boolean         disabled   = false          disables the trigger (panel cannot open).
    gg.jte.Content  title      = null           optional header title; makes the panel a labelled
                                                dialog (role="dialog" + aria-labelledby the title id).
    gg.jte.Content  description = null          optional subtitle under the title (aria-describedby).

  Usage:
    Uncontrolled (default -- browser toggles, no wire round-trip):
    @@template.lievit.popover(
        id = "settings-popover",
        trigger = @@`Settings`,
        content = @@`<p>Panel body, server-rendered.</p>`
    )

    Controlled (caller's @Wire boolean gates the panel -- copy-in pattern for the l:click):
    @@template.lievit.popover(
        id = "filter-popover",
        open = filterPanel.open(),
        controlled = true,
        trigger = @@`Filter`,
        content = @@`...`
    )
--%>
@param String id = "lv-popover"
@param gg.jte.Content trigger
@param gg.jte.Content content
@param boolean open = false
@param boolean controlled = false
@param String placement = "bottom-start"
@param String type = "auto"
@param int offset = 4
@param boolean withArrow = false
@param String variant = "default"
@param String cssClass = ""
@param boolean disabled = false
@param gg.jte.Content title = null
@param gg.jte.Content description = null

<%-- Derive stable ids from the base id. The trigger gets an id for aria-controls + anchor-name.
     The anchor dashed-ident must be a valid <dashed-ident> (starts with --); the trigger id
     is always server-generated (lv-prefixed), so the inline anchor-name style is the safe channel. --%>
!{var triggerId = id + "-trigger";}
!{var panelId = id;}
!{var anchorIdent = "--" + triggerId;}

<%-- Map the twelve placement values to CSS position-area values (CSS Anchor Positioning Level 1).
     Each position-area value places the panel on the named side relative to the anchor. --%>
!{var positionArea = switch (placement) {
    case "bottom"       -> "bottom center";
    case "bottom-start" -> "bottom span-right";
    case "bottom-end"   -> "bottom span-left";
    case "top"          -> "top center";
    case "top-start"    -> "top span-right";
    case "top-end"      -> "top span-left";
    case "left"         -> "left center";
    case "left-start"   -> "left span-bottom";
    case "left-end"     -> "left span-top";
    case "right"        -> "right center";
    case "right-start"  -> "right span-bottom";
    case "right-end"    -> "right span-top";
    default             -> "bottom span-right";
  };}

<%-- Arrow placement side: which side of the panel the caret visually points FROM (the side
     that faces the trigger). Derived from the block/inline direction of the placement. --%>
!{var arrowSide = switch (placement) {
    case "top", "top-start", "top-end"       -> "bottom";
    case "left", "left-start", "left-end"    -> "right";
    case "right", "right-start", "right-end" -> "left";
    default                                   -> "top";
  };}

<%-- Panel surface tokens: variant drives bg + fg (no hardcoded colours, tokens only). --%>
!{var panelBg = switch (variant) {
    case "muted"       -> "var(--lv-color-muted-bg)";
    case "destructive" -> "var(--lv-color-destructive)";
    default            -> "var(--lv-color-popover)";
  };}
!{var panelFg = switch (variant) {
    case "muted"       -> "var(--lv-color-muted-fg)";
    case "destructive" -> "var(--lv-color-destructive-fg)";
    default            -> "var(--lv-color-popover-fg)";
  };}

<%-- Inline offset: the gap between trigger and panel edge. Applied as margin on the axis that
     runs away from the trigger (block for top/bottom, inline for left/right placements). --%>
!{var isBlock = placement.startsWith("bottom") || placement.startsWith("top");}
!{var offsetPx = offset + "px";}
!{var marginBlock = isBlock ? offsetPx + " 0" : "0";}
!{var marginInline = !isBlock ? offsetPx + " 0" : "0";}

<%-- Labelled-dialog wiring: a non-null title renders a PopoverHeader and adds role="dialog"
     + aria-labelledby so AT announces the panel's purpose. A header-less panel carries NO role
     (a role="dialog" with no accessible name lies to AT; the native popover relationship is the
     announced affordance). --%>
!{var labelled = title != null;}
!{var titleId = id + "-title";}
!{var descId = id + "-description";}

<%-- aria-expanded: server-emitted from the open state for consistent AT behaviour. In
     uncontrolled mode open=false (default), the browser updates it dynamically; we still emit
     it statically so AT sees the correct initial state. In controlled mode it tracks the server
     fact. --%>
!{var ariaExpanded = open ? "true" : "false";}

<%-- Panel presence gate: in uncontrolled mode the panel is always present in the DOM; the native
     popover attribute hides it until the trigger toggles it. In controlled mode the server
     conditional is the authoritative gate (panel absent = completely out of AT + DOM). --%>
!{var renderPanel = !controlled || open;}

<%-- The trigger is the FIRST root-level element (stays in normal document flow).
     anchor-name is set as an inline style -- safe: value is server-generated (lv- prefixed id),
     never user-supplied. popovertarget wires the browser's native show/hide signal for the
     uncontrolled case; in controlled mode the caller's owned copy adds l:click="toggleOpen". --%>
<button
  id="${triggerId}"
  type="button"
  data-slot="popover-trigger"
  aria-expanded="${ariaExpanded}"
  aria-controls="${panelId}"
  popovertarget="${panelId}"
  popovertargetaction="toggle"
  disabled="${disabled}"
  class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] transition-colors hover:bg-[var(--lv-color-muted-bg)] disabled:cursor-not-allowed disabled:opacity-[var(--lv-opacity-disabled)] outline-none focus-visible:shadow-[var(--lv-ring)] ${cssClass}"
  style="font-family:var(--lv-font-sans);anchor-name:${anchorIdent};"
>${trigger}</button>

<%-- The panel is the SECOND root-level element (adjacent sibling -- never wrapped with the trigger
     in a common container). The native popover attribute moves it to the top layer.
     In uncontrolled mode: always present, browser hides/shows via popovertarget.
     In controlled mode: server-conditional (panel absent from DOM + AT when closed). --%>
@if(renderPanel)
<div
  id="${panelId}"
  popover="${type}"
  data-slot="popover-panel"
  data-variant="${variant}"
  data-placement="${placement}"
  data-with-arrow="${withArrow ? "true" : "false"}"
  data-lv-opener="${triggerId}"
  role="${labelled ? "dialog" : null}"
  aria-labelledby="${labelled ? titleId : null}"
  aria-describedby="${labelled && description != null ? descId : null}"
  class="m-0 box-border min-w-[12rem] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] p-[var(--lv-space-4)] text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] shadow-[var(--lv-shadow-md)] outline-none"
  style="font-family:var(--lv-font-sans);background:${panelBg};color:${panelFg};position-anchor:${anchorIdent};position-area:${positionArea};position-try-fallbacks:flip-block;margin-block:${marginBlock};margin-inline:${marginInline};z-index:var(--lv-z-popover);transition:opacity var(--lv-duration-fast) var(--lv-ease-out),transform var(--lv-duration-fast) var(--lv-ease-out);"
>
  @if(labelled)
    <%-- PopoverHeader: a title (+ optional description) makes the panel a labelled dialog.
         Header-less panels carry no role; labelled panels get role="dialog" + aria-labelledby.
         The title id is stable (derived from the panel id) so aria-labelledby resolves. --%>
    <div data-slot="popover-header" class="grid gap-[var(--lv-space-1)] mb-[var(--lv-space-3)]">
      <div
        data-slot="popover-title"
        id="${titleId}"
        class="text-[length:var(--lv-text-base)] font-[var(--lv-font-semibold)] leading-none"
      >${title}</div>
      @if(description != null)
        <div
          data-slot="popover-description"
          id="${descId}"
          class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]"
        >${description}</div>
      @endif
    </div>
  @endif
  <%-- Panel body: OWNED server-rendered markup. The Content slot fills here; composing
       components that own a copy of this template fill this region with their content
       (options list, date grid, form fields, rich content). Never a native <slot>. --%>
  <div data-slot="popover-body" class="contents">${content}</div>
  @if(withArrow)
    <%-- Decorative caret: a rotated square clipped to a triangle via CSS. Positioned on the
         side of the panel that faces the trigger (arrowSide). aria-hidden: decorative only.
         The clip-path produces a triangle pointing toward the trigger for each side:
           top    arrowSide -> bottom: panel is above trigger, caret points down (bottom edge)
           bottom arrowSide -> top:    panel is below trigger, caret points up (top edge)
           left   arrowSide -> right:  panel is left of trigger, caret points right
           right  arrowSide -> left:   panel is right of trigger, caret points left --%>
    <span
      aria-hidden="true"
      data-slot="popover-arrow"
      data-placement="${placement}"
      style="position:absolute;${arrowSide}:-5px;${("top".equals(arrowSide) || "bottom".equals(arrowSide)) ? "left:50%;transform:translateX(-50%) rotate(45deg)" : "top:50%;transform:translateY(-50%) rotate(45deg)"};width:10px;height:10px;background:${panelBg};border:1px solid var(--lv-color-border);clip-path:${("top".equals(arrowSide)) ? "polygon(0 0, 100% 0, 0 100%)" : ("bottom".equals(arrowSide)) ? "polygon(0 100%, 100% 100%, 100% 0)" : ("left".equals(arrowSide)) ? "polygon(0 0, 0 100%, 100% 100%)" : "polygon(100% 0, 0 0, 100% 100%)"};"
    ></span>
  @endif
</div>
@endif
