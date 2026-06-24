@import io.lievit.kit.auth.AuthFormView
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.page.auth - the Filament panel AUTH pages (login / register / password-reset /
  email-verification), rendered from an AuthFormView onto the lievit-ui field + input + button + alert
  + link partials. Unlike the resource pages, an auth page is STANDALONE: a centred card with the
  heading, one labelled input per schema field (text / email / password) with kept values + per-field
  errors, a form-level message (an error or a success banner), the submit button, and the secondary
  navigation links (forgot / already-registered). It does NOT wear the panel shell (no sidebar /
  topbar): the four AuthPage subclasses differ only in their schema, labels, and links, so this ONE
  template renders all four.

  The AuthFormView is produced by AuthPage.mount() / .submit(): heading, one FieldView per declared
  field (its bound name, label, HTML inputType, current value, required flag, submit-time error), the
  form-level message + whether it is an error, the submit label, and the secondary links. The kit
  paints the resolved strings (the silent-slot lesson): no engine knowledge here.

  Server-first / strict-CSP: a real <form method=post> the browser submits (no SPA); the CSRF slot is
  the adopter's hidden _csrf input. The password field is a real type=password input; a failed submit
  re-renders with the values kept (the AuthPage.submit contract). No inline script.

  WHY the field WRAPPER stays the constant root per field: the JTE static-checker rejects an @if/@else
  opening a DIFFERENT root tag per branch, so each field is the constant lievit.field wrapper and only
  the inner INPUT varies (type from the FieldView).

  Params:
    view   - the AuthFormView (heading / fields / formMessage / submitLabel / links).
    action - the form POST target (the auth page route, e.g. "/admin/login").
    csrf   - the hidden CSRF field slot (Spring: @`<input type="hidden" name="${_csrf.parameterName}" value="${_csrf.token}">`).
    brandName - an optional brand line above the card heading; "" omits it.
--%>
@param AuthFormView view
@param String action
@param gg.jte.Content csrf = null
@param String brandName = ""
<main
  data-slot="kit-auth"
  class="flex min-h-[var(--lv-space-screen,100dvh)] w-full items-center justify-center bg-[var(--lv-color-muted-bg)] p-[var(--lv-space-6)]"
  style="font-family:var(--lv-font-sans);"
>
  <div class="w-full max-w-sm">
    <section
      role="region"
      aria-labelledby="kit-auth-title"
      data-slot="kit-auth-card"
      class="overflow-hidden rounded-[var(--lv-radius-xl)] border border-[var(--lv-color-border)] bg-[var(--lv-color-card)] text-[var(--lv-color-card-fg)] shadow-[var(--lv-shadow-sm)]"
    >
      <div class="flex flex-col gap-[var(--lv-space-6)] p-[var(--lv-space-8)]">
        <div data-slot="kit-auth-header" class="flex flex-col gap-[var(--lv-space-2)] text-center">
          @if(brandName != null && !brandName.isBlank())
            <span data-slot="kit-auth-brand" class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-semibold)] text-[var(--lv-color-muted-fg)]">${brandName}</span>
          @endif
          <h1 id="kit-auth-title" class="text-[length:var(--lv-text-2xl)] font-[var(--lv-font-bold)] tracking-tight text-[var(--lv-color-fg)]">${view.heading()}</h1>
        </div>

        <%-- Form-level message: an error banner (destructive) or a success / confirmation banner (success). --%>
        @if(view.hasFormMessage())
          @template.lievit.alert(
            variant = view.messageIsError() ? "destructive" : "success",
            icon = true,
            iconName = view.messageIsError() ? "circle-alert" : "circle-check",
            content = @`${view.formMessage()}`)
        @endif

        <form method="post" action="${action}" data-slot="kit-auth-form" class="flex flex-col gap-[var(--lv-space-5)]">
          @if(csrf != null)${csrf}@endif

          @for(AuthFormView.FieldView field : view.fields())
            !{var fieldId = "kit-auth-" + field.name();}
            @template.lievit.field(
              controlId = fieldId,
              label = field.label(),
              required = field.required(),
              status = field.hasError() ? "error" : null,
              message = field.hasError() ? field.error() : null,
              content = @`
                @template.lievit.input(
                  name = field.name(), id = fieldId, type = field.inputType(),
                  value = field.value(), required = field.required(), invalid = field.hasError())
              `)
          @endfor

          @template.lievit.button(variant = "primary", type = "submit",
            cssClass = "w-full", content = @`${view.submitLabel()}`)
        </form>

        @if(view.hasLinks())
          <div data-slot="kit-auth-links" class="flex flex-col items-center gap-[var(--lv-space-2)] text-[length:var(--lv-text-sm)]">
            @for(AuthFormView.Link link : view.links())
              @template.lievit.link(variant = "muted", href = link.url(), content = @`${link.label()}`)
            @endfor
          </div>
        @endif
      </div>
    </section>
  </div>
</main>
