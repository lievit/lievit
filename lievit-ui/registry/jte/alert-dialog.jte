@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui alert-dialog-static partial -- the STATIC shadcn Alert Dialog: a trigger-driven
  confirmation prompt with ZERO shipped JS. It is the static sibling of the WIRE alert-dialog
  (registry/wire/alert-dialog/): that one holds `open` + `confirmed` server-side (a @Wire boolean,
  the server decides + re-renders); THIS partial is the trigger-driven static case -- the open-state
  is the browser's native <dialog> element, opened declaratively by the trigger and closed only by an
  explicit footer button, with no round-trip. Use the wire alert-dialog when the server owns the
  open/confirm flow; use this when a button on the page opens an in-page confirm whose Action posts a
  plain form (the kit's io.lievit.kit.component.ConfirmationModal render path).

  TIER: STATIC presentational -> JTE partial. Built on the SAME native <dialog> seam as the modal
  partial (registry/jte/modal.jte): the browser renders it in the TOP LAYER (escapes overflow /
  stacking, no z-index war), traps focus inside it, paints the ::backdrop, and exposes it to AT, so
  the partial is CSP-clean by construction with no enhancer.

  ALERT DIALOG vs DIALOG (the interruptive-prompt decision rule, WAI-ARIA APG Alert Dialog, Radix
  AlertDialog as the a11y source): an alert dialog is an INTERRUPTIVE prompt that REQUIRES a
  response, so unlike the modal it has NO backdrop-dismiss and NO header close (x): the ONLY exits
  are the explicit Cancel / Action buttons. role="alertdialog" (not role="dialog") tells AT exactly
  this. Escape still cancels for free (the native <dialog> modal default routes to a method="dialog"
  close); we accept that as the platform's interruptible escape (matching shadcn AlertDialogCancel),
  there is no JS-free way to forbid it without an enhancer and the prompt is recoverable (Escape ==
  Cancel, never == confirm).

  SHOW/HIDE (native, zero JS), mirrored from the modal partial:
    - OPEN  = the native invoker command API: a real <button command="show-modal" commandfor="${id}">
      opens the <dialog> as a modal (showModal()) with no script, exactly as popovertarget opens a
      popover. CSP-clean.
    - CANCEL = a <form method="dialog"> wrapping the Cancel button; a submit inside a method="dialog"
      form closes the <dialog> natively, no JS. Escape closes for free (the modal default).
    - ACTION (confirm) = a real <button> that submits the adopter's destructive/confirm form via
      `actionForm` + `actionUrl` (formaction), so the confirmed action POSTs without inline JS. When
      no form is given the Action button is itself a method="dialog" submit (it just closes), so the
      shell renders standalone; the adopter wires the real effect with actionForm/actionUrl.

  WIDTH (kit Width / ModalWidth, same mapping as the modal partial): data-width carries the token;
  the panel max-width maps the token to a --lv-* sizing.

  A11y (WAI-ARIA APG Alert Dialog via native <dialog>): the <dialog> opened with showModal() IS a
  modal dialog to AT; we stamp role="alertdialog" + aria-modal="true" + aria-labelledby (the title
  id) + aria-describedby (the description id when present) so the contract is explicit + testable on
  source. Focus enters the dialog + is trapped by the browser; close returns focus to the trigger.
  Cancel is the first focusable affordance (shadcn AlertDialog default focus, the safe choice).

  Params:
    String         id = "lv-alert-dialog"    the <dialog> id (the commandfor target). Unique per page.
    gg.jte.Content trigger                    the trigger CONTENT (label / icon) inside the <button>.
    String         title                      the prompt headline; wires aria-labelledby (required).
    String         description = null         supporting explanation; wires aria-describedby when set.
    String         actionLabel = "Continue"   the confirm button label (shadcn AlertDialogAction).
    String         cancelLabel = "Cancel"     the cancel button label (shadcn AlertDialogCancel).
    boolean        destructive = false        destructive styling: red Action button + a triangle-alert
                                              icon on the title (shadcn destructive AlertDialog).
    String         actionForm = ""            a <form> id the Action button submits (the real effect).
    String         actionUrl = ""             a formaction URL the Action button posts to.
    String         width = "md"               kit Width / ModalWidth token: xs|sm|md|lg|xl|2xl..7xl|full|screen.
    String         cssClass = ""              extra utility classes on the wrapper.

  Usage:
    @@template.lievit.alert-dialog-static(
      id = "delete-contact",
      trigger = @@`Delete`,
      title = "Delete the contact?",
      description = "This cannot be undone.",
      actionLabel = "Delete",
      destructive = true,
      actionForm = "delete-form",
      actionUrl = "/contacts/42/delete"
    )
--%>
@param String id = "lv-alert-dialog"
@param gg.jte.Content trigger
@param String title
@param String description = null
@param String actionLabel = "Continue"
@param String cancelLabel = "Cancel"
@param boolean destructive = false
@param String actionForm = ""
@param String actionUrl = ""
@param String width = "md"
@param String cssClass = ""
!{var titleId = id + "-title";}
!{var descId = id + "-description";}
!{var hasDesc = description != null && !description.isEmpty();}
!{var hasAction = !actionForm.isEmpty() || !actionUrl.isEmpty();}
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

<span data-slot="alert-dialog" class="inline-block ${cssClass}" style="font-family:var(--lv-font-sans);">
  <button
    type="button"
    data-slot="alert-dialog-trigger"
    command="show-modal"
    commandfor="${id}"
    class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
  >${trigger}</button>

  <dialog
    id="${id}"
    data-slot="alert-dialog"
    data-width="${width}"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="${titleId}"
    aria-describedby="${hasDesc ? descId : null}"
    class="m-auto box-border w-[calc(100%-var(--lv-space-8))] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] p-0 text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-md)]"
    style="max-width:${maxW}; border-radius:var(--lv-radius-md); z-index:var(--lv-z-modal);"
  >
    <div data-slot="alert-dialog-content" class="relative flex flex-col gap-[var(--lv-space-4)] p-[var(--lv-space-6)]">
      <div data-slot="alert-dialog-header" class="flex flex-col gap-[var(--lv-space-2)] text-left">
        <h2 data-slot="alert-dialog-title" id="${titleId}" class="m-0 flex items-center gap-[var(--lv-space-2)] text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)] leading-[var(--lv-leading-tight)] text-[var(--lv-color-fg)]">
          @if(destructive)
            <span aria-hidden="true" class="inline-flex shrink-0 items-center text-[var(--lv-color-destructive)]">@template.lievit.icon(name = "triangle-alert", size = "1.25rem")</span>
          @endif
          ${title}
        </h2>
        @if(hasDesc)
          <p data-slot="alert-dialog-description" id="${descId}" class="m-0 text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-muted-fg)]">${description}</p>
        @endif
      </div>

      <div data-slot="alert-dialog-footer" class="flex flex-col-reverse gap-[var(--lv-space-2)] sm:flex-row sm:justify-end">
        <form method="dialog" class="contents">
          <button
            type="submit"
            data-slot="alert-dialog-cancel"
            class="inline-flex h-[var(--lv-space-10)] items-center justify-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] px-[var(--lv-space-4)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-xs)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
          >${cancelLabel}</button>
        </form>
        @if(hasAction)
          <button
            type="submit"
            data-slot="alert-dialog-action"
            data-destructive="${destructive ? "true" : "false"}"
            form="${actionForm.isEmpty() ? null : actionForm}"
            formaction="${actionUrl.isEmpty() ? null : actionUrl}"
            class="inline-flex h-[var(--lv-space-10)] items-center justify-center rounded-[var(--lv-radius-md)] border-0 px-[var(--lv-space-4)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] shadow-[var(--lv-shadow-xs)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
            style="background:${destructive ? "var(--lv-color-destructive)" : "var(--lv-color-primary)"}; color:${destructive ? "var(--lv-color-destructive-fg)" : "var(--lv-color-primary-fg)"};"
          >${actionLabel}</button>
        @else
          <form method="dialog" class="contents">
            <button
              type="submit"
              data-slot="alert-dialog-action"
              data-destructive="${destructive ? "true" : "false"}"
              class="inline-flex h-[var(--lv-space-10)] items-center justify-center rounded-[var(--lv-radius-md)] border-0 px-[var(--lv-space-4)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] shadow-[var(--lv-shadow-xs)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
              style="background:${destructive ? "var(--lv-color-destructive)" : "var(--lv-color-primary)"}; color:${destructive ? "var(--lv-color-destructive-fg)" : "var(--lv-color-primary-fg)"};"
            >${actionLabel}</button>
          </form>
        @endif
      </div>
    </div>
  </dialog>
</span>
