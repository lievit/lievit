@import gg.jte.Content
@import dev.lievit.kit.AdminAction
@import dev.lievit.kit.ConfirmationModal
@import dev.lievit.kit.ModalConfig
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.action.modal - the action-as-MODAL flow: the native <dialog> a confirmed or
  form-bearing action opens, rendered onto the lievit-ui modal / slide-over partials (both native
  <dialog>, top-layer, browser focus-trap + ::backdrop + Escape, CSP-clean, zero JS). Pairs with
  kit/action.jte (which renders the TRIGGER under the SAME `modalId`); here is the modal itself.

  TWO CONTENTS, ONE SHELL (Filament's CanRequireConfirmation vs the action form modal):
    - a CONFIRMATION action (DeleteAction et al.): the body is the ConfirmationModal heading +
      description; the footer is Confirm (runs the action) + Cancel (closes). No form fields.
    - a FORM action (FormAction): the caller passes the embedded form markup as `body` (a real
      <form> / fieldset the host server-rendered); the footer is Submit + Cancel. The form's own
      submit button (form=...) drives the POST, or the footer Submit fires the action over the wire.

  CONFIRM PATTERN (server-first, no inline script). Confirm is a real activation:
    - WIRE: an l:click="<action name>" button carrying the per-row id via the button partial's SAFE
      wireArgs channel (escaped data-id), exactly as kit/action.jte's plain wire path. The runtime
      runs the action + closes the modal on the redirect effect.
    - the modal is a native <dialog>: opened by the trigger's command="show-modal", the Cancel /
      close (x) / backdrop submit a <form method="dialog"> and close it with no round-trip (the
      lievit-ui modal/slide-over partials own this).

  SLIDE-OVER vs CENTRED (ModalConfig.asSlideOver()). When a ModalConfig is supplied and slideOver()
  is set, the shell is @@template.lievit.slide-over (right-anchored sheet); otherwise the centred
  @@template.lievit.modal. The width / alignment / close affordances flow from the ModalConfig; a
  bare confirmation (no ModalConfig) uses the centred modal at the confirm width.

  CRITICAL JTE RULE: the modal vs slide-over choice picks a WHOLE partial per branch (each renders a
  complete <dialog>); we never split one element across @if. The trigger lives in kit/action.jte, so
  this template renders ONLY the dialog -- the modal partials expose a `trigger` slot we leave inert
  (an empty span) because our invoker is the kit-action button, addressed by the shared id.

  Params:
    action   - the AdminAction the modal confirms / submits (its name is the wire action).
    confirm  - the ConfirmationModal (heading / description / submit + cancel labels / icon); defaults
               to action.confirmationModal(). Used for the confirmation body + footer labels.
    modal    - the ModalConfig (width / slideOver / alignment / close affordances); null => a centred
               confirm modal at the default width.
    modalId  - the <dialog> id (MUST match the kit/action.jte trigger's commandfor for this action).
    recordId - the row id carried into the confirm/submit wire action as the SAFE wireArgs `id` (or "").
    body     - the embedded form markup for a FORM action (server-rendered); null => a pure
               confirmation (the confirm.description() is the body instead).
--%>
@param AdminAction<?> action
@param ConfirmationModal confirm = null
@param ModalConfig modal = null
@param String modalId = "lv-action-modal"
@param String recordId = ""
@param Content body = null
!{ConfirmationModal cm = confirm != null ? confirm : action.confirmationModal();}
!{boolean slideOver = modal != null && modal.slideOver();}
!{String width = modal != null ? modal.widthToken() : "sm";}
!{String alignment = modal != null ? modal.alignment() : "start";}
!{boolean closeButton = modal == null || modal.closeButton();}
!{boolean closeAway = modal == null || modal.closeByClickingAway();}
!{String heading = modal != null && modal.heading() != null && !modal.heading().isEmpty()
    ? modal.heading() : cm.heading();}
!{String description = modal != null && modal.description() != null && !modal.description().isEmpty()
    ? modal.description() : cm.description();}
!{String submitLabel = modal != null ? modal.submitLabel() : cm.submitLabel();}
!{String cancelLabel = modal != null ? modal.cancelLabel() : cm.cancelLabel();}
!{boolean destructive = action.isDestructive();}
!{var submitVariant = destructive ? "destructive" : "primary";}
!{var wireArgs = recordId == null || recordId.isBlank()
    ? java.util.Map.<String, String>of()
    : java.util.Map.of("id", recordId);}
<%-- whether the body is the embedded form (a FORM action) or the confirmation description text. --%>
!{boolean hasFormBody = body != null;}
!{boolean hasDescription = description != null && !description.isBlank();}

<%-- The body + footer markup is identical for the centred modal and the slide-over, so each branch
     inlines the SAME @`` blocks (a Content local cannot be assigned a @`` block in !{}). The body is
     the embedded form when given, else the confirmation description; the footer is Cancel (a native
     <form method="dialog"> close) + the Submit that fires the action over the wire with the SAFE id. --%>
@if(slideOver)
  @template.lievit.slide-over(
    id = modalId,
    side = "right",
    trigger = @`<span data-kit-action-modal-trigger hidden></span>`,
    heading = heading,
    description = hasFormBody ? description : null,
    closeButton = closeButton,
    closeByClickingAway = closeAway,
    content = @`
      @if(hasFormBody)
        ${body}
      @elseif(hasDescription)
        <p data-kit-action-confirm-text class="m-0 text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-muted-fg)]">${description}</p>
      @endif
    `,
    footer = @`
      <form method="dialog" class="contents">
        @template.lievit.button(variant = "ghost", size = "sm", type = "submit", content = @`${cancelLabel}`)
      </form>
      @template.lievit.button(variant = submitVariant, size = "sm",
        wireClick = action.name(), wireArgs = wireArgs,
        dataAttrs = java.util.Map.of("kit-action-submit", action.name()),
        content = @`${submitLabel}`)
    `)
@else
  @template.lievit.modal(
    id = modalId,
    size = width,
    trigger = @`<span data-kit-action-modal-trigger hidden></span>`,
    heading = heading,
    description = hasFormBody ? description : null,
    closable = closeButton,
    content = @`
      @if(hasFormBody)
        ${body}
      @elseif(hasDescription)
        <p data-kit-action-confirm-text class="m-0 text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-muted-fg)]">${description}</p>
      @endif
    `,
    footer = @`
      <form method="dialog" class="contents">
        @template.lievit.button(variant = "ghost", size = "sm", type = "submit", content = @`${cancelLabel}`)
      </form>
      @template.lievit.button(variant = submitVariant, size = "sm",
        wireClick = action.name(), wireArgs = wireArgs,
        dataAttrs = java.util.Map.of("kit-action-submit", action.name()),
        content = @`${submitLabel}`)
    `)
@endif
