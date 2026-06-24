@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui field partial -- the FormField + FieldError orchestration (label + control +
  description/error) with the accessible wiring auto-derived from the error, server-side.

  TIER: STATIC presentational -> JTE partial. Pure layout + the accessible label/error wiring;
  no client state. The control is supplied by the caller as a `control` Content slot (data down).
  This is the server-first analogue of shadcn's FormField/FormControl/FormMessage: validation
  runs server-side, the controller passes `error` down, and the partial does the aria wiring the
  React `useFormField()` hook does (compute the description + message ids, set aria-describedby +
  aria-invalid), so the adopter stops hand-wiring error ids.

  AUTO-WIRING (the Form gap this closes): shadcn's FormControl sets `id`, `aria-describedby`
  (description id, plus the message id when there is an error) and `aria-invalid` on the control.
  JTE Content slots cannot receive computed params, so the wiring values are DETERMINISTIC from
  `forId` and the partial both (1) renders the description/message regions with those exact ids
  and (2) exposes them through the `controlDescribedBy` / `controlInvalid` doc contract below so
  the caller threads them into its control once. The ids never have to be guessed:
    description id = "<forId>-description"   (rendered only when `description` is set)
    message id     = "<forId>-error"          (rendered only when `error` is set, role=alert)
    aria-describedby the control must carry = the space-joined present ids
    aria-invalid the control must carry      = (error is set)

  STRUCTURE (scientific decision rule): shadcn v4 converged Form* onto the Field primitives, so
  the Field IS the form orchestration: a vertical (or horizontal/responsive) stack of a Label,
  the control, an optional muted FieldDescription and a FieldError region carrying role="alert".
  We reproduce that exactly, token-styled. `orientation` mirrors shadcn's Field orientation
  (vertical default, horizontal label-beside-control, responsive container-query switch); the
  optional `content` slot is shadcn's FieldContent (keeps descriptions aligned in horizontal).

  INVALID CASCADE (shadcn parity): the Field ROOT carries `data-[invalid=true]:text-[var(--lv-color-destructive)]`
  (shadcn's `data-[invalid=true]:text-destructive`), so when the field is invalid its descendant labels /
  titles tint destructive from the root, not just the per-element data-error cue.

  MULTI-ERROR (shadcn's FieldError errors array): pass `errors` (a List<String>) to render several
  messages; they are deduped (first occurrence wins, like shadcn's Map-by-message) and shown as a
  <ul> INSIDE the same single role=alert region (one live region, not one per message). The single
  `error` String path is unchanged for back-compat. `errors` (non-empty) wins over `error`.

  A11y (shadcn / WAI-ARIA model): the label binds to the control by `forId` and carries
  `data-error` when invalid (shadcn's destructive-label cue). The description is a muted <p> with
  id `<forId>-description`; the error is a `role="alert"` <p> with id `<forId>-error` (role=alert
  already implies an assertive live region, so no extra aria-live). The control must point its
  `aria-describedby` at those ids and set
  `aria-invalid` when `error` is set. The required marker on the label is `aria-hidden`.

  Params:
    String forId                  id of the control (binds the label + derives the description/error ids).
    String label    = null        visible label text rendered for the control.
    gg.jte.Content control        the form control markup (e.g. an @@template.lievit.input(...) call).
    gg.jte.Content content = null FieldContent slot: label + control side-by-side helper text (horizontal).
    String description = null     muted helper text (FieldDescription); shown alongside the error.
    String hint     = null        deprecated alias for `description` (kept for back-compat).
    String error    = null        single validation error message; when set, shown in a role=alert region + data-invalid.
    java.util.List<String> errors = null  MULTI-error list (shadcn's FieldError errors array); deduped + rendered as a
                                  <ul> inside the same role=alert region. Wins over `error` when non-empty. The single
                                  `error` String path stays for back-compat (one message).
    boolean required = false      renders a required marker on the label.
    String orientation = "vertical"  "vertical" | "horizontal" | "responsive" field layout.
    String cssClass = ""          extra utility classes on the wrapper.

  Usage:
    @@template.lievit.field(
      forId = "email", label = "Email", required = true,
      description = "We never share it.", error = errors.email(),
      control = @@`@@template.lievit.input(name = "email", id = "email",
        describedBy = "email-description email-error", invalid = errors.email() != null)`
    )

    @@template.lievit.field(orientation = "horizontal", forId = "remember", label = "Remember me",
      control = @@`@@template.lievit.switch(name = "remember", id = "remember")`)
--%>
@param String forId
@param String label = null
@param gg.jte.Content control
@param gg.jte.Content content = null
@param String description = null
@param String hint = null
@param String error = null
@param java.util.List<String> errors = null
@param boolean required = false
@param String orientation = "vertical"
@param String cssClass = ""

<%-- dedupe the multi-error list (first occurrence wins, shadcn's Map-by-message), drop blanks --%>
!{var errorList = errors == null ? java.util.List.<String>of()
    : errors.stream().filter(e -> e != null && !e.isBlank()).distinct().collect(java.util.stream.Collectors.toList());}
!{var hasErrorList = !errorList.isEmpty();}
!{var hasSingleError = error != null && !error.isBlank();}
!{var hasError = hasErrorList || hasSingleError;}
!{var desc = (description != null && !description.isBlank()) ? description : hint;}
!{var hasDesc = desc != null && !desc.isBlank();}

<div
  data-slot="field"
  role="group"
  data-orientation="${orientation}"
  data-invalid="${hasError ? "true" : null}"
  class="group/field flex gap-[var(--lv-space-3)] data-[invalid=true]:text-[var(--lv-color-destructive)] data-[orientation=vertical]:flex-col data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:items-center data-[orientation=responsive]:flex-col @md/field-group:data-[orientation=responsive]:flex-row @md/field-group:data-[orientation=responsive]:items-center ${cssClass}"
>
  @if(label != null && !label.isBlank())
    @template.lievit.label(forId = forId, content = @`${label}`, required = required)
  @endif
  @if(content != null)
    <div data-slot="field-content" class="flex flex-1 flex-col gap-[var(--lv-space-1)]">
      ${content}
    </div>
  @endif
  ${control}
  @if(hasDesc)
    <p data-slot="field-description" id="${forId}-description" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]" style="font-family:var(--lv-font-sans);">${desc}</p>
  @endif
  @if(hasErrorList)
    <div data-slot="field-error" id="${forId}-error" role="alert" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-destructive)]" style="font-family:var(--lv-font-sans);">
      @if(errorList.size() == 1)
        ${errorList.get(0)}
      @else
        <ul class="ml-[var(--lv-space-4)] flex list-disc flex-col gap-[var(--lv-space-1)]">
          @for(String msg : errorList)
            <li>${msg}</li>
          @endfor
        </ul>
      @endif
    </div>
  @elseif(hasSingleError)
    <p data-slot="field-error" id="${forId}-error" role="alert" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-destructive)]" style="font-family:var(--lv-font-sans);">${error}</p>
  @endif
</div>
