@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui field partial -- a label + control + hint/error wrapper (composition only).

  TIER: STATIC presentational -> JTE partial. Pure layout + the accessible label/error wiring;
  no client state. The control is supplied by the caller as a `control` Content slot (data down):
  the field owns only the surrounding label, hint and error, exactly like the Lit island it
  replaces, but as markup the strict CSP can never silently drop.

  STRUCTURE (scientific decision rule): shadcn's Field/FormItem is a vertical stack of a Label,
  the control, and a description/message, with the error region carrying role="alert". We
  reproduce that: a <label for> composed from the `label` partial, the `control` slot, then a
  hint (muted) OR an error (danger, role=alert, aria-live=polite). The error element's id is
  `<controlId>-error`; the CALLER passes `describedBy="<controlId>-error"` to its control so
  assistive tech reads the error after the control (JTE has no DOM, so the wiring is by
  convention, documented here).

  A11y (shadcn / WAI-ARIA model): the label binds to the control by `forId`. When `error` is set
  it renders in a `role="alert" aria-live="polite"` region with id `<forId>-error`; pass that id
  as the control's `aria-describedby`. The required marker on the label is `aria-hidden`.

  Params:
    String forId                id of the control (binds the label + derives the error id).
    String label    = null      visible label text rendered above the control.
    gg.jte.Content control      the form control markup (e.g. an @@template.input(...) call).
    String hint     = null      muted helper text below the control (hidden when error is set).
    String error    = null      validation error message; when set, shown in a role=alert region.
    boolean required = false    renders a required marker on the label.
    String cssClass = ""        extra utility classes on the wrapper.

  Usage:
    @@template.field(
      forId = "email", label = "Email", required = true, error = errors.email(),
      control = @@`@@template.input(name = "email", id = "email", describedBy = "email-error")`
    )
--%>
@param String forId
@param String label = null
@param gg.jte.Content control
@param String hint = null
@param String error = null
@param boolean required = false
@param String cssClass = ""

!{var hasError = error != null && !error.isBlank();}
!{var hasHint = hint != null && !hint.isBlank();}

<div data-slot="field" class="flex flex-col gap-[var(--lv-space-2)] ${cssClass}">
  @if(label != null && !label.isBlank())
    @template.label(forId = forId, text = label, required = required)
  @endif
  ${control}
  @if(hasHint && !hasError)
    <p data-slot="field-hint" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]" style="font-family:var(--lv-font-sans);">${hint}</p>
  @endif
  @if(hasError)
    <p data-slot="field-error" id="${forId}-error" role="alert" aria-live="polite" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-danger)]" style="font-family:var(--lv-font-sans);">${error}</p>
  @endif
</div>
