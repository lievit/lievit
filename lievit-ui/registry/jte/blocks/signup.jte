@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui SIGNUP block (#459) -- a registration card composed from the existing lievit-ui
  partials: a titled card, name + email + password (+ confirm) fields built on the
  input-group partial with leading Lucide icons, a native terms-acceptance checkbox, a
  submit button, a "already have an account? sign in" link, and optional social-signup
  buttons. Server-rendered: a real <form method="post" action="${action}"> that the browser
  posts; NO SPA, NO client framework.

  TIER: BLOCK (composition). It is a JTE template that arranges existing components; it owns
  no client behaviour of its own. The interactivity that exists (show/hide password, wire
  binding) belongs to the islands the adopter may drop in, not to this markup.

  STRUCTURE (scientific decision rule): compared against shadcn's signup-01..05 (Card +
  Field + Input + Button), MUI, and Web Awesome, shadcn's card-of-fields + a separated social
  section + a footer "sign in" link is the cleanest, most accessible registration pattern, so
  it is the one reproduced. The server-rendered tier (ADR-0012): every control is a NATIVE form
  element with a real `name` so the browser submits it on POST; there are no custom-element
  tags. The fields reuse the input-group partial so the look stays identical to the rest of the
  library; the terms checkbox is a native `input[type=checkbox][required]` so the browser
  enforces acceptance with zero JS. An adopter may progressively enhance these later with their
  own enhancer without changing the posted shape. The field row is inlined per-field (a `@for`
  over a small list) rather than a shared partial, so this block stays self-contained and merges
  cleanly alongside the sibling login block.

  TWO VARIANTS via `variant`:
    "card"     (default) the form inside a single bordered card, centred -- shadcn signup-01.
    "split"    a two-column card: the form on one side, a decorative `image` panel on the other
               (collapses to one column on small screens) -- shadcn signup-04. `image` is the
               URL of the side visual; omit it and the panel shows a muted placeholder.

  A11y (Radix / WAI-ARIA model):
    - A single <h1>-level heading (the card title) + a <section aria-labelledby> so the block is
      one labelled landmark region; the title id labels it.
    - Every field is a real <label for> bound to a real input id (input-group default id = name),
      so the label, the validation, and AT all bind to the same control.
    - Errors are wired with aria-describedby + role="alert": pass `errors` as a Map<String,String>
      (field name -> message); a present message marks its input aria-invalid="true" and is
      announced. The form-level `formError` is a role="alert" banner at the top.
    - The password requirement ("at least 8 characters") is a persistent <p> referenced by the
      password input's aria-describedby, so it is announced, not just shown.
    - Focus order is DOM order: name -> email -> password -> confirm -> terms -> submit -> social
      -> sign-in link. The focus-visible ring is the token ring (input-group focus-within, button
      focus-visible) so keyboard users always see the active control.

  Params:
    String action                   the form POST target (required). Rendered as method="post".
    String title       = "Create your account"        card heading (the labelled-region label).
    String description = "Enter your information below to get started"   sub-heading line.
    String variant     = "card"     "card" (single column) | "split" (two-column with `image`).
    String image       = null       split-variant side visual URL; null => muted placeholder.
    boolean confirmPassword = true   render the confirm-password field.
    boolean terms      = true       render the required terms-acceptance checkbox.
    String termsContent = null      the checkbox label markup (links to terms/privacy); a plain
                                     default is used when null. Carries its own <a href>.
    String signInHref  = "/login"   target of the "Already have an account? Sign in" footer link.
    gg.jte.Content csrf = null      CSRF hidden-input slot, rendered first inside the form
                                     (e.g. @`<input type="hidden" name="_csrf" value="${token}">`).
    gg.jte.Content social = null    optional social-signup buttons slot; when present it renders
                                     under an "Or continue with" separator. The adopter supplies
                                     the brand buttons (Lucide has no brand marks); see Usage.
    java.util.Map<String, String> errors = null   per-field error messages keyed by input name
                                     (name|email|password|confirmPassword|terms).
    String formError   = null       a form-level error banner (role="alert") above the fields.
    String submitLabel = "Create account"   the submit button text.
    String cssClass    = ""         extra utility classes on the root.

  Usage (single-column card, Spring + JTE):
    @template.blocks.signup(
      action = "/signup",
      csrf = @`<input type="hidden" name="${_csrf.parameterName}" value="${_csrf.token}">`,
      errors = errors,
      signInHref = "/login"
    )

  Usage (split, with social buttons -- brand marks are the adopter's own SVG, NOT Lucide):
    @template.blocks.signup(
      action = "/signup", variant = "split", image = "/img/welcome.jpg",
      social = @`
        <button type="submit" formaction="/oauth2/authorization/google"
                class="inline-flex h-[var(--lv-space-10)] w-full items-center justify-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] hover:bg-[var(--lv-color-muted-bg)] focus-visible:shadow-[var(--lv-ring)] focus-visible:outline-none">
          @template.icon(name = "log-in") Sign up with Google
        </button>`
    )
--%>
@param String action
@param String title = "Create your account"
@param String description = "Enter your information below to get started"
@param String variant = "card"
@param String image = null
@param boolean confirmPassword = true
@param boolean terms = true
@param String termsContent = null
@param String signInHref = "/login"
@param gg.jte.Content csrf = null
@param gg.jte.Content social = null
@param java.util.Map<String, String> errors = null
@param String formError = null
@param String submitLabel = "Create account"
@param String cssClass = ""

!{var isSplit = "split".equals(variant);}
!{var titleId = "lv-signup-title";}
!{var descId = "lv-signup-desc";}
!{var pwHelpId = "lv-signup-pw-help";}
!{var hasFormError = formError != null && !formError.isBlank();}
!{var hasDescription = description != null && !description.isBlank();}

<section
  data-slot="signup"
  data-variant="${variant}"
  aria-labelledby="${titleId}"
  class="mx-auto w-full ${isSplit ? "max-w-3xl" : "max-w-sm"} overflow-hidden rounded-[var(--lv-radius-xl)] border border-[var(--lv-color-border)] bg-[var(--lv-color-card)] text-[var(--lv-color-card-fg)] shadow-[var(--lv-shadow-md)] ${cssClass}"
>
  <div class="grid ${isSplit ? "md:grid-cols-2" : "grid-cols-1"}">
    <div data-slot="signup-body" class="flex flex-col gap-[var(--lv-space-6)] p-[var(--lv-space-8)]">

      <div data-slot="signup-header" class="flex flex-col gap-[var(--lv-space-1)] text-center">
        <h1 id="${titleId}" class="text-[length:var(--lv-text-2xl)] font-[var(--lv-font-bold)] tracking-tight text-[var(--lv-color-fg)]">${title}</h1>
        @if(hasDescription)
          <p id="${descId}" class="text-[length:var(--lv-text-sm)] leading-[var(--lv-leading-relaxed)] text-[var(--lv-color-muted-fg)]">${description}</p>
        @endif
      </div>

      <form
        method="post"
        action="${action}"
        data-slot="signup-form"
        aria-describedby="${hasDescription ? descId : null}"
        class="flex flex-col gap-[var(--lv-space-5)]"
      >
        @if(csrf != null)
          ${csrf}
        @endif

        @if(hasFormError)
          <div role="alert" data-slot="signup-form-error" class="flex items-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-danger)] bg-[var(--lv-color-danger)]/10 px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-danger)]">
            @template.icon(name = "circle-alert", size = "1rem")
            <span>${formError}</span>
          </div>
        @endif

        <%-- one inlined field row per credential; the input-group partial gives the icon +
            shared-focus box, a real <label for> binds to the input (id defaults to name). --%>
        @for(var f : new String[][]{
              {"name", "Full name", "text", "user", "Jane Doe", "name"},
              {"email", "Email", "email", "mail", "you@example.com", "email"},
              {"password", "Password", "password", "lock", "", "new-password"},
              confirmPassword ? new String[]{"confirmPassword", "Confirm password", "password", "lock", "", "new-password"} : null
            })
          @if(f != null)
            !{var fName = f[0];}
            !{var fErr = errors == null ? null : errors.get(fName);}
            !{var hasErr = fErr != null && !fErr.isBlank();}
            !{var isPassword = "password".equals(fName);}
            !{var errId = "lv-signup-" + fName + "-error";}
            !{var placeholder = (f[4] != null && !f[4].isEmpty()) ? f[4] : null;}
            <div data-slot="signup-field" class="flex flex-col gap-[var(--lv-space-2)]">
              <label for="${fName}" class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]">${f[1]}</label>
              <div
                role="group"
                data-slot="input-group"
                class="relative flex h-[var(--lv-space-10)] w-full min-w-0 items-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] border ${hasErr ? "border-[var(--lv-color-danger)]" : "border-[var(--lv-color-input)]"} bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] shadow-[var(--lv-shadow-xs)] transition-shadow outline-none focus-within:border-[var(--lv-color-ring)] focus-within:shadow-[var(--lv-ring)] [&_svg]:pointer-events-none [&_svg]:text-[var(--lv-color-muted-fg)]"
              >
                <span data-slot="input-group-addon" data-align="inline-start" class="flex shrink-0 items-center text-[var(--lv-color-muted-fg)] select-none">
                  @template.icon(name = f[3])
                </span>
                <input
                  data-slot="input-group-control"
                  id="${fName}"
                  name="${fName}"
                  type="${f[2]}"
                  required
                  autocomplete="${f[5]}"
                  placeholder="${placeholder}"
                  aria-invalid="${hasErr ? "true" : "false"}"
                  aria-describedby="${hasErr ? errId : (isPassword ? pwHelpId : null)}"
                  class="min-w-0 flex-1 border-0 bg-transparent text-[var(--lv-color-fg)] placeholder:text-[var(--lv-color-muted-fg)] outline-none focus:outline-none focus-visible:outline-none"
                >
              </div>
              @if(isPassword && !hasErr)
                <p id="${pwHelpId}" class="text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)]">Must be at least 8 characters long.</p>
              @endif
              @if(hasErr)
                <p id="${errId}" role="alert" class="text-[length:var(--lv-text-xs)] text-[var(--lv-color-danger)]">${fErr}</p>
              @endif
            </div>
          @endif
        @endfor

        @if(terms)
          !{var termsErr = errors == null ? null : errors.get("terms");}
          !{var hasTermsErr = termsErr != null && !termsErr.isBlank();}
          <div data-slot="signup-terms" class="flex flex-col gap-[var(--lv-space-1)]">
            <label class="flex items-start gap-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)]">
              <input
                type="checkbox"
                name="terms"
                value="on"
                required
                aria-invalid="${hasTermsErr ? "true" : "false"}"
                aria-describedby="${hasTermsErr ? "lv-signup-terms-error" : null}"
                class="mt-[var(--lv-space-px)] size-[var(--lv-space-4)] shrink-0 appearance-none rounded-[var(--lv-radius-sm)] border-2 border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] checked:border-[var(--lv-color-primary)] checked:bg-[var(--lv-color-primary)] focus-visible:shadow-[var(--lv-ring)] focus-visible:outline-none"
              >
              <span>
                @if(termsContent != null)
                  ${termsContent}
                @else
                  I agree to the <a href="/terms" class="font-[var(--lv-font-medium)] text-[var(--lv-color-primary)] underline-offset-4 hover:underline">Terms</a> and <a href="/privacy" class="font-[var(--lv-font-medium)] text-[var(--lv-color-primary)] underline-offset-4 hover:underline">Privacy Policy</a>.
                @endif
              </span>
            </label>
            @if(hasTermsErr)
              <p id="lv-signup-terms-error" role="alert" class="text-[length:var(--lv-text-xs)] text-[var(--lv-color-danger)]">${termsErr}</p>
            @endif
          </div>
        @endif

        <button
          type="submit"
          data-slot="signup-submit"
          class="inline-flex h-[var(--lv-space-10)] w-full items-center justify-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] bg-[var(--lv-color-primary)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-primary-fg)] transition-colors hover:opacity-90 focus-visible:shadow-[var(--lv-ring)] focus-visible:outline-none disabled:opacity-50"
        >${submitLabel}</button>

        @if(social != null)
          <div data-slot="signup-separator" role="separator" aria-orientation="horizontal" class="relative flex items-center justify-center text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)] after:absolute after:inset-x-0 after:top-1/2 after:-z-10 after:border-t after:border-[var(--lv-color-border)]">
            <span class="bg-[var(--lv-color-card)] px-[var(--lv-space-2)]">Or continue with</span>
          </div>
          <div data-slot="signup-social" class="flex flex-col gap-[var(--lv-space-2)]">
            ${social}
          </div>
        @endif
      </form>

      <p data-slot="signup-footer" class="text-center text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">
        Already have an account?
        <a href="${signInHref}" class="font-[var(--lv-font-medium)] text-[var(--lv-color-primary)] underline-offset-4 hover:underline">Sign in</a>
      </p>
    </div>

    @if(isSplit)
      <div data-slot="signup-aside" aria-hidden="true" class="relative hidden bg-[var(--lv-color-muted-bg)] md:block">
        @if(image != null && !image.isBlank())
          <img src="${image}" alt="" class="absolute inset-0 size-full object-cover">
        @endif
      </div>
    @endif
  </div>
</section>
