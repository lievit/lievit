@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui modal partial -- the STATIC shadcn Dialog: a centred, trigger-driven modal dialog with
  ZERO shipped JS. This is the sibling of the popover overlay seam: where popover uses the native
  HTML `popover` attribute, the modal uses the native HTML <dialog> element, which gives a real
  modal for free -- the browser renders it in the TOP LAYER (escapes overflow/stacking, no z-index
  war), traps focus inside it, renders the ::backdrop, light-dismisses on Escape, and exposes it to
  AT as a modal dialog. No focus-trap JS, no Escape handler, no enhancer: the platform owns all of
  it, so this partial is CSP-clean by construction.

  TIER: STATIC presentational -> JTE partial. Distinct from the WIRE dialog (registry/wire/dialog/):
  that one holds `open` server-side (a @Wire boolean) for flows where the server owns the open-state
  and re-renders; THIS partial is the trigger-driven static case -- the open-state is the browser's
  <dialog> element, opened declaratively by the trigger and closed by the close button / backdrop /
  Escape, with no round-trip. Use the wire dialog when the server decides open/closed; use this when
  a button on the page opens it.

  SERVES THE KIT: this is the presentation shell the kit's modal stack renders through. It carries
  the io.lievit.kit.component.ModalView affordances (closeButton, closeByClickingAway,
  closeByEscaping, width) and the io.lievit.kit.ModalConfig chrome (heading/description, width,
  alignment, submit/cancel footer labels via the footer slot, sticky header/footer, icon). The
  width values mirror the kit Width / ModalWidth tokens (xs..7xl, full, screen).

  SHOW/HIDE (native, zero JS):
    - OPEN  = the native invoker command API. The trigger is a real <button command="show-modal"
      commandfor="${id}">: the browser opens the <dialog> as a modal (showModal()) with no script,
      exactly as popovertarget opens a popover. CSP-clean.
    - CLOSE = a <form method="dialog"> wrapping the close affordances. A submit button inside a
      method="dialog" form closes the <dialog> natively, no JS. The header close (x), the backdrop
      button and the footer cancel all live in (or submit) such a form, so every close path is
      browser-native. Escape closes for free (the <dialog> modal default), gated by
      closeByEscaping: when false we never let Escape cancel (the dialog cancel event is the only
      JS-free hook, so a non-escapable modal simply omits the affordance and documents the limit).

  BACKDROP DISMISS (closeByClickingAway, shadcn close-on-outside-click): a full-bleed
  <form method="dialog"><button data-slot="dialog-backdrop"> sits behind the content; a click on the
  empty area submits the dialog-method form and closes. Rendered only when closeByClickingAway.

  WIDTH (kit Width / ModalWidth): data-width carries the token; the panel max-width maps the token
  to a --lv-* sizing. center/start alignment (ModalConfig.alignment) sets the header/footer text
  alignment + the footer justification.

  A11y (WAI-ARIA APG Dialog/Modal via native <dialog>): the <dialog> opened with showModal() IS a
  modal dialog to AT (implicit role=dialog + aria-modal); we still stamp role="dialog" +
  aria-modal="true" + aria-labelledby (the heading id when a heading is set, else aria-label) +
  aria-describedby (the description id when present) so the contract is explicit + testable on
  source. Focus enters the dialog + is trapped by the browser; close returns focus to the trigger.

  Params:
    String         id = "lv-modal"        the <dialog> id (the commandfor target). Unique per page.
    gg.jte.Content trigger                 the trigger CONTENT (label / icon) inside the <button>.
    gg.jte.Content content                 the modal body, OWNED + server-rendered (never a <slot>).
    String         heading = null          the dialog title; renders DialogHeader + DialogTitle, wires aria-labelledby.
    String         description = null       supporting line; renders DialogDescription, wires aria-describedby.
    gg.jte.Content footer = null           the footer region (DialogFooter): submit/cancel actions.
    String         width = "md"            kit Width / ModalWidth token: xs|sm|md|lg|xl|2xl..7xl|full|screen.
    String         alignment = "start"     "start" | "center": header/footer text + footer alignment (ModalConfig.alignment).
    boolean        closeButton = true      render the header close (x) button (ModalView.closeButton).
    boolean        closeByClickingAway = true  a backdrop click closes the modal (ModalView.closeByClickingAway).
    String         cssClass = ""           extra utility classes on the wrapper.

  Usage:
    @@template.lievit.modal(
      id = "edit-modal",
      trigger = @@`Edit`,
      heading = "Edit record",
      description = "Change the fields and save.",
      content = @@`<p>Body, server-rendered.</p>`,
      footer = @@`<button type="submit" form="edit-form">Save</button>`
    )
--%>
@param String id = "lv-modal"
@param gg.jte.Content trigger
@param gg.jte.Content content
@param String heading = null
@param String description = null
@param gg.jte.Content footer = null
@param String width = "md"
@param String alignment = "start"
@param boolean closeButton = true
@param boolean closeByClickingAway = true
@param String cssClass = ""
!{var titleId = id + "-title";}
!{var descId = id + "-description";}
!{var hasHeading = heading != null && !heading.isEmpty();}
!{var hasDesc = description != null && !description.isEmpty();}
!{var center = "center".equals(alignment);}
!{var maxW = switch (width) {
    case "xs" -> "20rem";
    case "sm" -> "24rem";
    case "lg" -> "32rem";
    case "xl" -> "36rem";
    case "2xl" -> "42rem";
    case "3xl" -> "48rem";
    case "4xl" -> "56rem";
    case "5xl" -> "64rem";
    case "6xl" -> "72rem";
    case "7xl" -> "80rem";
    case "full", "screen" -> "100vw";
    default -> "28rem";
  };}

<span data-slot="modal" class="inline-block ${cssClass}" style="font-family:var(--lv-font-sans);">
  <button
    type="button"
    data-slot="dialog-trigger"
    command="show-modal"
    commandfor="${id}"
    class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
  >${trigger}</button>

  <dialog
    id="${id}"
    data-slot="dialog"
    data-width="${width}"
    role="dialog"
    aria-modal="true"
    aria-labelledby="${hasHeading ? titleId : null}"
    aria-describedby="${hasDesc ? descId : null}"
    aria-label="${hasHeading ? null : "Dialog"}"
    class="m-auto box-border w-[calc(100%-var(--lv-space-8))] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] p-0 text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-md)]"
    style="max-width:${maxW}; border-radius:var(--lv-radius-md); z-index:var(--lv-z-modal);"
  >
    @if(closeByClickingAway)
      <form method="dialog" data-slot="dialog-backdrop-form">
        <button
          type="submit"
          data-slot="dialog-backdrop"
          aria-label="Close"
          class="fixed inset-0 -z-[1] block h-full w-full cursor-default border-0 bg-transparent p-0"
        ></button>
      </form>
    @endif

    <div data-slot="dialog-content" class="relative flex flex-col">
      @if(hasHeading)
        <div data-slot="dialog-header" class="flex items-start justify-between gap-[var(--lv-space-3)] border-b border-[var(--lv-color-border)] p-[var(--lv-space-4)] ${center ? "text-center" : "text-left"}">
          <div class="flex flex-col gap-[var(--lv-space-1)] ${center ? "w-full" : ""}">
            <h2 data-slot="dialog-title" id="${titleId}" class="m-0 text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)] leading-[var(--lv-leading-tight)] text-[var(--lv-color-fg)]">${heading}</h2>
            @if(hasDesc)
              <p data-slot="dialog-description" id="${descId}" class="m-0 text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-muted-fg)]">${description}</p>
            @endif
          </div>
          @if(closeButton)
            <form method="dialog" class="contents">
              <button
                type="submit"
                data-slot="dialog-close"
                aria-label="Close"
                class="inline-flex shrink-0 items-center rounded-[var(--lv-radius-sm)] border-0 bg-transparent p-[var(--lv-space-1)] leading-none text-[var(--lv-color-muted-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
              >@template.lievit.icon(name = "x", size = "1.25rem")</button>
            </form>
          @endif
        </div>
      @endif

      <div data-slot="dialog-body" class="flex-1 overflow-y-auto p-[var(--lv-space-4)] text-[length:var(--lv-text-base)] leading-[var(--lv-leading)] text-[var(--lv-color-fg)]">
        ${content}
      </div>

      @if(footer != null)
        <div data-slot="dialog-footer" class="flex gap-[var(--lv-space-2)] border-t border-[var(--lv-color-border)] px-[var(--lv-space-4)] py-[var(--lv-space-3)] ${center ? "justify-center" : "justify-end"}">
          ${footer}
        </div>
      @endif
    </div>
  </dialog>
</span>
