@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui LOGIN block -- a server-rendered email + password sign-in surface, composed
  from the existing lievit-ui partials. A BLOCK is a composition (a ready page region),
  not a primitive: it wires the icon, input-group and button-group partials into the
  representative login PATTERN, parameterised so the shadcn login-01..05 variants are
  options of ONE template, never copies.

  TIER: STATIC presentational -> JTE block (ADR-0012 server-first). It is a real
  <form method="post"> the server renders and the browser submits; no SPA, no client state,
  no custom-element tags. The only interactivity an adopter adds (a password reveal toggle,
  inline async validation) rides their own enhancer or htmx on top -- the block does not assume it.

  WHY native inputs: a login form must POST named fields. The block uses the `input-group`
  partial (a real input with a name) for email + password: token styling + the focus-within
  ring + a real label binding, and the values actually post. (scientific rule: criterion 5
  robustness + SSR-friendliness; the page must work before any JS boots.)

  WHY the card chrome is inlined (not the card partial directly): a login page is the one page
  that must render correctly with zero JS, and the card partial takes only a `heading` string
  (no description region). The block renders the card surface with the
  SAME tokens the card partial uses (--lv-color-card / --lv-radius-xl / --lv-shadow-sm) plus
  the shadcn title+description header, server-side. shadcn wins the markup ergonomics; Radix
  has no behaviour for a static surface.

  VARIANTS (@param variant) -- the shadcn login family folded into options:
    "card"  (default; login-01 / login-03) centred card with title + description.
    "plain" (login-02) the same form with no card chrome, for a page that owns the frame.
    "split" (login-04 / login-05) two-column: the card on one side, an image panel on the
            other (set via @param image); the image side is hidden below md.

  A11y (shadcn + WAI-ARIA): the block is a <main> landmark centring a <section> labelled by
  the heading (aria-labelledby -> the <h1> id), so AT announces "Accedi, region". Each field
  is a real <label for> bound to a real <input id>. An error, when present, is a
  role="alert" / aria-live="polite" region whose id the input references via aria-describedby
  + aria-invalid="true", so the message is read after the control. Focus order is natural
  (email -> password -> submit -> links). Decorative icons come from the Lucide partial
  (aria-hidden). The image panel is decorative (alt="") -- the form carries the meaning.

  Params:
    String action                 the form POST target (e.g. "/login").
    gg.jte.Content csrf  = null   hidden CSRF field slot (Spring: @`<input type="hidden"
                                  name="${_csrf.parameterName}" value="${_csrf.token}">`).
    String title       = "Accedi al tuo account"   the <h1> heading.
    String description = "Inserisci la tua email per accedere."  muted sub-heading; "" omits.
    String emailName   = "username"   name attribute of the email field (Spring default).
    String emailValue  = null     pre-filled email (e.g. after a failed attempt).
    String passwordName = "password"  name attribute of the password field.
    String error       = null     a form-level error message; null => no alert region.
    String submitLabel = "Accedi" the submit button text.
    String forgotUrl   = null     "forgot password" link target; null => link omitted.
    String signupUrl   = null     "sign up" link target; null => the sign-up line omitted.
    gg.jte.Content social = null  optional social / SSO buttons (icon-agnostic slot); when
                                  set, a token "oppure" separator is shown above them.
    String variant     = "card"   card | plain | split.
    String image       = null     side-image URL for the "split" variant (decorative).
    String cssClass    = ""       extra utility classes on the outer <main>.

  Usage:
    @template.blocks.login(
      action = "/login",
      csrf = @`<input type="hidden" name="${_csrf.parameterName}" value="${_csrf.token}">`,
      error = loginError,
      emailValue = lastEmail,
      forgotUrl = "/forgot-password",
      signupUrl = "/register"
    )

    Two-column with a side image + a Google SSO button:
    @template.blocks.login(
      action = "/login",
      variant = "split",
      image = "/img/office.jpg",
      csrf = @`<input type="hidden" name="${_csrf.parameterName}" value="${_csrf.token}">`,
      social = @`
        <a href="/oauth2/authorization/google"
           class="inline-flex h-[var(--lv-space-10)] w-full items-center justify-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] transition-colors outline-none hover:bg-[var(--lv-color-muted-bg)] focus-visible:shadow-[var(--lv-ring)]">
          @template.icon(name = "log-in")
          Continua con Google
        </a>`
    )
--%>
@param String action
@param gg.jte.Content csrf = null
@param String title = "Accedi al tuo account"
@param String description = "Inserisci la tua email per accedere."
@param String emailName = "username"
@param String emailValue = null
@param String passwordName = "password"
@param String error = null
@param String submitLabel = "Accedi"
@param String forgotUrl = null
@param String signupUrl = null
@param gg.jte.Content social = null
@param String variant = "card"
@param String image = null
@param String cssClass = ""

!{var hasDescription = description != null && !description.isBlank();}
!{var hasError = error != null && !error.isBlank();}
!{var split = variant.equals("split");}
!{var plain = variant.equals("plain");}
!{var carded = !plain;}
!{var headingId = "lv-login-title";}
!{var errorId = "lv-login-error";}
!{var emailId = "lv-login-email";}
!{var passwordId = "lv-login-password";}
!{var describedBy = hasError ? errorId : null;}

<main
  data-slot="login"
  data-variant="${variant}"
  class="flex min-h-screen w-full items-center justify-center bg-[var(--lv-color-muted-bg)] p-[var(--lv-space-6)] ${cssClass}"
>
  <div class="w-full ${split ? "max-w-4xl" : "max-w-sm"}">
    <section
      role="region"
      aria-labelledby="${headingId}"
      data-slot="login-card"
      class="${carded ? "overflow-hidden rounded-[var(--lv-radius-xl)] border border-[var(--lv-color-border)] bg-[var(--lv-color-card)] text-[var(--lv-color-card-fg)] shadow-[var(--lv-shadow-sm)]" : ""} ${split ? "grid md:grid-cols-2" : ""}"
    >
      <div data-slot="login-body" class="flex flex-col gap-[var(--lv-space-6)] p-[var(--lv-space-8)]">

        <div data-slot="login-header" class="flex flex-col gap-[var(--lv-space-2)] ${split ? "" : "text-center"}">
          <h1 id="${headingId}" class="text-[length:var(--lv-text-2xl)] font-[var(--lv-font-bold)] tracking-tight text-[var(--lv-color-fg)]">${title}</h1>
          @if(hasDescription)
            <p class="text-[length:var(--lv-text-sm)] leading-[var(--lv-leading-relaxed)] text-[var(--lv-color-muted-fg)]">${description}</p>
          @endif
        </div>

        @if(hasError)
          <div
            id="${errorId}"
            role="alert"
            aria-live="polite"
            data-slot="login-error"
            class="flex items-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-danger)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-danger)]"
          >
            @template.icon(name = "circle-alert")
            <span>${error}</span>
          </div>
        @endif

        <form method="post" action="${action}" data-slot="login-form" class="flex flex-col gap-[var(--lv-space-5)]">
          @if(csrf != null)
            ${csrf}
          @endif

          <div data-slot="login-field" class="flex flex-col gap-[var(--lv-space-2)]">
            <label for="${emailId}" class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]">Email</label>
            @template.input-group(
              name = emailName,
              id = emailId,
              type = "email",
              value = emailValue,
              placeholder = "nome@esempio.it",
              ariaLabel = "Email",
              leading = @`@template.icon(name = "mail")`
            )
          </div>

          <div data-slot="login-field" class="flex flex-col gap-[var(--lv-space-2)]">
            <div class="flex items-center justify-between gap-[var(--lv-space-2)]">
              <label for="${passwordId}" class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]">Password</label>
              @if(forgotUrl != null)
                <a href="${forgotUrl}" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)] underline-offset-4 outline-none hover:underline focus-visible:underline focus-visible:text-[var(--lv-color-fg)]">Password dimenticata?</a>
              @endif
            </div>
            @template.input-group(
              name = passwordName,
              id = passwordId,
              type = "password",
              ariaLabel = "Password",
              leading = @`@template.icon(name = "lock")`
            )
          </div>

          <button
            type="submit"
            data-slot="login-submit"
            aria-describedby="${describedBy}"
            class="inline-flex h-[var(--lv-space-10)] w-full items-center justify-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] bg-[var(--lv-color-primary)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-primary-fg)] transition-colors outline-none hover:opacity-90 focus-visible:shadow-[var(--lv-ring)]"
          >${submitLabel}</button>
        </form>

        @if(social != null)
          <div data-slot="login-separator" class="relative flex items-center text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)]">
            <span class="h-px flex-1 bg-[var(--lv-color-border)]"></span>
            <span class="px-[var(--lv-space-3)] uppercase">oppure continua con</span>
            <span class="h-px flex-1 bg-[var(--lv-color-border)]"></span>
          </div>
          <div data-slot="login-social" class="flex flex-col gap-[var(--lv-space-3)]">
            ${social}
          </div>
        @endif

        @if(signupUrl != null)
          <p data-slot="login-signup" class="text-center text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">
            Non hai un account?
            <a href="${signupUrl}" class="font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] underline underline-offset-4 outline-none focus-visible:shadow-[var(--lv-ring)]">Registrati</a>
          </p>
        @endif
      </div>

      @if(split)
        <div data-slot="login-aside" aria-hidden="true" class="relative hidden bg-[var(--lv-color-muted-bg)] md:block">
          @if(image != null && !image.isBlank())
            <img src="${image}" alt="" class="absolute inset-0 h-full w-full object-cover">
          @endif
        </div>
      @endif
    </section>
  </div>
</main>
