@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui form partial -- the server-first Form: a native <form> wrapper that owns a form-level
  validation message region and stacks its @@template.field children. The server-rendered analogue
  of shadcn's Form (FormProvider) + a top-level FormMessage for the error that is not tied to one
  field (e.g. "Invalid email or password").

  TIER: STATIC presentational -> JTE partial. No client state: validation runs server-side, the
  controller passes `error` (form-level) + each field's error down, and this partial does the aria
  wiring. JS-off the form POSTs natively; with the wire runtime present the same markup submits
  over the wire. This is why shadcn's Form has no real counterpart here beyond layout-only Field:
  the missing piece was the server validation->message orchestration, which is this + field.jte.

  STRUCTURE (scientific decision rule): shadcn's Form is react-hook-form's FormProvider (pure JS
  context). A server-first stack has no client form context to provide: the truth is the POST and
  the controller's validation result. So the "Form" here is the native <form> + a form-level
  message slot. Field-level wiring (id/aria-describedby/aria-invalid) is auto-derived in
  @@template.field from the per-field error; the form-level error gets its own role=alert region
  whose id (`<formId>-error`) the form references via aria-describedby when present.

  A11y (WAI-ARIA): a native <form> (the platform form landmark). The form-level error is a
  `role="alert" aria-live="assertive"` region with id `<formId>-error`, referenced by the form's
  aria-describedby only while present, so a screen reader announces the submit failure. Each field
  carries its own message via @@template.field.

  Params:
    String id        = null     the form id (derives the form-level message id `<id>-error`).
    String action    = null     the form action URL (native POST target).
    String method    = "post"   native method.
    String error     = null     form-level validation message (not tied to a single field).
    gg.jte.Content content      the form body (fields, field groups, actions).
    gg.jte.Content header = null optional header content rendered above the error region.
    String cssClass  = ""       extra utility classes on the <form>.

  Usage:
    @@template.form(id = "login", action = "/login", error = errors.form(), content = @@`
      @@template.field(forId = "email", label = "Email", error = errors.email(),
        control = @@`@@template.input(name = "email", id = "email",
          describedBy = "email-error", invalid = errors.email() != null)`)
      @@template.button(type = "submit", content = @@`Sign in`)
    `)
--%>
@param String id = null
@param String action = null
@param String method = "post"
@param String error = null
@param gg.jte.Content content
@param gg.jte.Content header = null
@param String cssClass = ""

!{var hasError = error != null && !error.isBlank();}
!{var formId = (id != null && !id.isBlank()) ? id : null;}
!{var errorId = formId != null ? formId + "-error" : "form-error";}

<form
  data-slot="form"
  id="${formId}"
  action="${action}"
  method="${method}"
  aria-describedby="${hasError ? errorId : null}"
  class="flex w-full flex-col gap-[var(--lv-space-6)] ${cssClass}"
>
  @if(header != null)${header}@endif
  @if(hasError)
    <div data-slot="form-error" id="${errorId}" role="alert" aria-live="assertive" class="rounded-[var(--lv-radius-md)] border border-[var(--lv-color-danger)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-danger)]" style="font-family:var(--lv-font-sans);">${error}</div>
  @endif
  ${content}
</form>
