@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui slide-over partial -- the STATIC shadcn Sheet: a modal panel that slides in from a viewport
  edge (right | left | top | bottom), trigger-driven, with ZERO shipped JS. It is the modal partial
  pinned to an edge instead of centred: same native <dialog> seam (top-layer, browser focus-trap,
  ::backdrop, Escape light-dismiss, AT-modal), so it too is CSP-clean by construction with no
  enhancer.

  TIER: STATIC presentational -> JTE partial. Distinct from the WIRE drawer / sheet
  (registry/wire/drawer/, registry/wire/sheet/): those hold `open` server-side (a @Wire boolean) for
  flows where the server owns open-state (and the SlideOver "view in panel" outcome builds on the
  drawer wire). THIS partial is the trigger-driven static case -- the open-state is the browser's
  <dialog>, opened by the trigger, closed by the close button / backdrop / Escape, no round-trip.

  SERVES THE KIT: this is the static presentation shell behind the kit's edge-anchored panels --
  dev.lievit.kit.SlideOver (a right-anchored detail panel; side="right") and any ModalConfig with
  asSlideOver() (Filament slide-over, side defaults right, width full). The `side` left/right/top/
  bottom matches the kit/shadcn Sheet sides; data-side mirrors it for styling + testing.

  SHOW/HIDE (native, zero JS), identical to the modal partial:
    - OPEN  = <button command="show-modal" commandfor="${id}"> opens the <dialog> as a modal.
    - CLOSE = <form method="dialog"> close affordances: header close (x), backdrop, Escape (native).
  The only difference from the modal is the panel POSITION: instead of centring, the <dialog> is
  pinned to the chosen edge and sized to span the cross axis (a side sheet is full-height + a fixed
  inline width; a top/bottom sheet is full-width + a fixed block height).

  BACKDROP DISMISS (closeByClickingAway / shadcn outside-click close): a full-bleed
  <form method="dialog"><button data-slot="sheet-backdrop"> behind the content closes on click.

  A11y (WAI-ARIA APG Dialog/Modal via native <dialog>): showModal() makes it a modal dialog to AT;
  we also stamp role="dialog" + aria-modal="true" + aria-labelledby (the heading id, else
  aria-label) + aria-describedby (the description id when present). Browser traps focus + returns it
  to the trigger on close.

  Params:
    String         id = "lv-slide-over"   the <dialog> id (the commandfor target). Unique per page.
    gg.jte.Content trigger                 the trigger CONTENT inside the <button>.
    gg.jte.Content content                 the panel body, OWNED + server-rendered (never a <slot>).
    String         side = "right"          "right" | "left" | "top" | "bottom": the edge it slides from.
    String         heading = null          the panel title; renders SheetHeader + SheetTitle, wires aria-labelledby.
    String         description = null       supporting line; renders SheetDescription, wires aria-describedby.
    gg.jte.Content footer = null           the footer region (SheetFooter): actions pinned at the panel end.
    boolean        closeButton = true      render the top-right close (x) button.
    boolean        closeByClickingAway = true  a backdrop click closes the panel.
    String         cssClass = ""           extra utility classes on the wrapper.

  Usage:
    @@template.lievit.slide-over(
      id = "view-panel",
      side = "right",
      trigger = @@`View`,
      heading = "Record detail",
      content = @@`<dl>...the infolist...</dl>`
    )
--%>
@param String id = "lv-slide-over"
@param gg.jte.Content trigger
@param gg.jte.Content content
@param String side = "right"
@param String heading = null
@param String description = null
@param gg.jte.Content footer = null
@param boolean closeButton = true
@param boolean closeByClickingAway = true
@param String cssClass = ""
!{var titleId = id + "-title";}
!{var descId = id + "-description";}
!{var hasHeading = heading != null && !heading.isEmpty();}
!{var hasDesc = description != null && !description.isEmpty();}
!{var edge = switch (side) {
    case "left", "top", "bottom" -> side;
    default -> "right";
  };}
!{var panelPos = switch (edge) {
    case "left" -> "inset:0 auto 0 0; height:100dvh; width:min(90vw,24rem); border-right:1px solid var(--lv-color-border);";
    case "top" -> "inset:0 0 auto 0; width:100vw; max-height:85dvh; border-bottom:1px solid var(--lv-color-border);";
    case "bottom" -> "inset:auto 0 0 0; width:100vw; max-height:85dvh; border-top:1px solid var(--lv-color-border);";
    default -> "inset:0 0 0 auto; height:100dvh; width:min(90vw,24rem); border-left:1px solid var(--lv-color-border);";
  };}

<span data-slot="sheet" class="inline-block ${cssClass}" style="font-family:var(--lv-font-sans);">
  <button
    type="button"
    data-slot="sheet-trigger"
    command="show-modal"
    commandfor="${id}"
    class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
  >${trigger}</button>

  <dialog
    id="${id}"
    data-slot="sheet-content"
    data-side="${edge}"
    role="dialog"
    aria-modal="true"
    aria-labelledby="${hasHeading ? titleId : null}"
    aria-describedby="${hasDesc ? descId : null}"
    aria-label="${hasHeading ? null : "Sheet"}"
    class="m-0 box-border flex max-w-none flex-col border-0 bg-[var(--lv-color-bg)] p-0 text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-lg)]"
    style="${panelPos} z-index:var(--lv-z-modal); font-family:var(--lv-font-sans);"
  >
    @if(closeByClickingAway)
      <form method="dialog" data-slot="sheet-backdrop-form">
        <button
          type="submit"
          data-slot="sheet-backdrop"
          aria-label="Close"
          class="fixed inset-0 -z-[1] block h-full w-full cursor-default border-0 bg-transparent p-0"
        ></button>
      </form>
    @endif

    @if(hasHeading || closeButton)
      <div data-slot="sheet-header" class="flex items-start justify-between gap-[var(--lv-space-3)] p-[var(--lv-space-4)]">
        <div class="flex flex-col gap-[var(--lv-space-1)]">
          @if(hasHeading)
            <h2 data-slot="sheet-title" id="${titleId}" class="m-0 text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)] leading-[var(--lv-leading-tight)] text-[var(--lv-color-fg)]">${heading}</h2>
          @endif
          @if(hasDesc)
            <p data-slot="sheet-description" id="${descId}" class="m-0 text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-muted-fg)]">${description}</p>
          @endif
        </div>
        @if(closeButton)
          <form method="dialog" class="contents">
            <button
              type="submit"
              data-slot="sheet-close"
              aria-label="Close"
              class="inline-flex shrink-0 items-center rounded-[var(--lv-radius-sm)] border-0 bg-transparent p-[var(--lv-space-1)] leading-none text-[var(--lv-color-muted-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
            >@template.lievit.icon(name = "x", size = "1rem")</button>
          </form>
        @endif
      </div>
    @endif

    <div data-slot="sheet-body" class="flex-1 overflow-y-auto px-[var(--lv-space-4)] text-[length:var(--lv-text-base)] leading-[var(--lv-leading)] text-[var(--lv-color-fg)]">
      ${content}
    </div>

    @if(footer != null)
      <div data-slot="sheet-footer" class="mt-auto flex flex-col gap-[var(--lv-space-2)] p-[var(--lv-space-4)]">
        ${footer}
      </div>
    @endif
  </dialog>
</span>
