@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui form partial (v-next) -- the server-first Form: a native <form> wrapper that
  owns a form-level validation summary region and stacks its field children.

  TIER: STATIC presentational -> JTE partial. No client state: validation runs server-side,
  the controller passes `errors` (form-level list) or `error` (single back-compat string)
  down, and this partial does the aria wiring. JS-off the form POSTs natively; with the
  wire runtime present the same markup submits over the wire.

  V-NEXT CHANGES vs Wave-1b form:
    - `errors` list param: `java.util.List<java.util.Map<String,String>>` where each map
      carries "fieldId" (nullable, for anchor links) and "message" keys. Replaces the old
      single `error` string for the v-next error summary pattern.
    - `errorSummaryHeading`: customisable heading inside the error summary block.
    - `focusOnError`: adds `data-lv-autofocus` to the summary when there are errors, so
      an enhancer (e.g. the wire submit interceptor) can auto-focus it on failed submit.
    - `layout`: "stacked" | "inline" | "grid" (v-next form-level layout).
    - `labelWidth`: CSS value for `--lv-form-label-width` (passed to fields via CSS cascade).
    - `size`: propagated via `--lv-form-size` custom property for fields to inherit.
    - `autocomplete`, `enctype`, `novalidate`, `headingId`, `ariaLabel` HTML attributes.
    - `footer` slot: rendered below the content in a `data-slot="form-footer"` wrapper.
    - Error summary is ALWAYS in DOM (aria-live pre-registered); `hidden` attr gates visibility.

  BACK-COMPAT LAYER (immutable tests pin these contracts):
    - `error` (single string) back-compat path preserved; maps to a single-entry error
      list internally when the v-next `errors` list is empty/null.
    - `data-slot="form-error"` on the error region (jte-static-partials.test.ts pins this).
    - `role="alert"` + `aria-live="assertive"` on the error region.
    - `id="${errorId}"` derived from `id` param.
    - `aria-describedby="${hasError ? errorId : null}"` on the <form>.
    - `${content}` must appear in the markup.
    - `method="${method}"` on the <form>.

  STRUCTURE:
    <form data-slot="form" data-form-layout>
      <div data-slot="form-error" role="alert" aria-live="assertive" aria-atomic="true" [hidden]>
        [heading when non-empty]
        [error list with fieldId anchor links or plain text]
      </div>
      ${content}
      [<div data-slot="form-footer">${footer}</div> when footer != null]
    </form>

  A11y:
    - Native <form> landmark: no extra role needed.
    - Error summary: `role="alert"` carries implicit aria-live="assertive" aria-atomic="true"
      per the ARIA spec (WAI-ARIA APG Alert pattern). `aria-live="assertive"` is also explicit
      for engine compatibility. The summary is always in the DOM so AT registers it early.
    - `hidden` attribute gates visibility without removing the element (preserves aria-live
      registration on page load; the AT hears the update when `hidden` is removed).
    - `focusOnError` + `data-lv-autofocus`: a JS enhancer focuses the summary after a failed
      submit, so keyboard/SR users land on the error list immediately.
    - `novalidate`: suppresses native browser validation UI (server validates; native popups
      disrupt the custom error pattern). Default true per WAI-ARIA form best practice.
    - `aria-describedby` on the form references the error summary while errors are present
      (back-compat; removed when no errors to avoid spurious SR description).

  Params (v-next surface):
    String id                = null    form id (derives the error summary id `<id>-errors`).
    String action            = null    form action URL.
    String method            = "post"  native method.
    String layout            = "stacked"  "stacked" | "inline" | "grid" form layout.
    String size              = "md"    size tier propagated via CSS custom property.
    String labelWidth        = null    CSS value for `--lv-form-label-width` cascade.
    List<Map<String,String>> errors = []  v-next error list; each entry: "fieldId" + "message".
    String errorSummaryHeading = "Correggi gli errori prima di procedere"  heading text.
    String autocomplete      = null    native autocomplete attribute.
    boolean novalidate       = true    suppress native browser validation UI.
    String enctype           = null    native enctype attribute.
    String cssClass          = ""      extra utility classes on the <form>.
    String attrs             = ""      TRUSTED raw ($unsafe) -- static author-typed strings only.
    String headingId         = null    id for the error summary heading (for aria-labelledby).
    String ariaLabel         = null    aria-label on the <form>.
    boolean focusOnError     = false   adds data-lv-autofocus to the error summary when errors.
    gg.jte.Content content   REQUIRED  the form body (fields, actions).
    gg.jte.Content header    = null    optional header rendered above the error summary.
    gg.jte.Content footer    = null    optional footer rendered below the content.

  Back-compat params:
    String error             = null    single form-level error message (back-compat); used when
                                       `errors` list is null or empty.

  Usage (v-next):
    @@template.lievit.form(id = "login", action = "/login",
      errors = formErrors, focusOnError = true,
      content = @@`
        @@template.lievit.field(controlId = "email", label = "Email", status = "error",
          message = errors.email(), content = @@`@@template.lievit.input(name="email",id="email")`)
        @@template.lievit.button(type = "submit", content = @@`Sign in`)
      `)

  Usage (back-compat, old callers unchanged):
    @@template.lievit.form(id = "login", action = "/login", error = errors.form(), content = @@`
      @@template.lievit.field(forId = "email", label = "Email", error = errors.email(),
        control = @@`@@template.lievit.input(name = "email", id = "email")`)
      @@template.lievit.button(type = "submit", content = @@`Sign in`)
    `)
--%>
@param String id = null
@param String action = null
@param String method = "post"
@param String layout = "stacked"
@param String size = "md"
@param String labelWidth = null
@param java.util.List<java.util.Map<String, String>> errors = java.util.List.of()
@param String errorSummaryHeading = "Correggi gli errori prima di procedere"
@param String autocomplete = null
@param boolean novalidate = true
@param String enctype = null
@param String cssClass = ""
@param String attrs = ""
@param String headingId = null
@param String ariaLabel = null
@param boolean focusOnError = false
@param gg.jte.Content content
@param gg.jte.Content header = null
@param gg.jte.Content footer = null
@param String error = null

<%-- Resolve error state: v-next list wins over back-compat single string. --%>
!{var _hasVnextErrors = errors != null && !errors.isEmpty();}
!{var _hasSingleError = error != null && !error.isBlank();}
!{var hasError = _hasVnextErrors || _hasSingleError;}
!{var formId = (id != null && !id.isBlank()) ? id : null;}
!{var errorId = formId != null ? formId + "-errors" : "form-errors";}

<%-- For back-compat: `id="${errorId}"` and `data-slot="form-error"` are pinned by the
     existing test suite; do not rename these. --%>

<form
  data-slot="form"
  data-form-layout="${layout}"
  id="${formId}"
  action="${action}"
  method="${method}"
  autocomplete="${autocomplete}"
  enctype="${enctype}"
  novalidate="${novalidate}"
  aria-label="${ariaLabel}"
  aria-describedby="${hasError ? errorId : null}"
  class="flex w-full flex-col gap-[var(--lv-space-6)] ${cssClass}"
  style="${"--lv-form-size: " + size + (labelWidth != null && !labelWidth.isBlank() ? "; --lv-form-label-width: " + labelWidth : "")}"
  $unsafe{attrs}
>
  @if(header != null)${header}@endif

  <%-- Error summary: always in DOM for aria-live pre-registration (v-next pattern).
       `hidden` attr gates visibility; aria-live still registered by the browser.
       Back-compat: data-slot="form-error" and id="${errorId}" are pinned by tests. --%>
  <div
    data-slot="form-error"
    id="${errorId}"
    role="alert"
    aria-live="assertive"
    aria-atomic="true"
    tabindex="-1"
    hidden="${!hasError}"
    data-lv-autofocus="${focusOnError && hasError ? "true" : null}"
    class="rounded-[var(--lv-radius-md)] border border-[var(--lv-color-destructive)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[color:var(--lv-color-destructive)]"
    style="font-family:var(--lv-font-sans);"
  >
    @if(hasError)
      @if(errorSummaryHeading != null && !errorSummaryHeading.isBlank())
        <p data-slot="form-error-heading" class="font-[var(--lv-font-medium)] mb-[var(--lv-space-1)]" style="margin:0 0 var(--lv-space-1);">${errorSummaryHeading}</p>
      @endif
      @if(_hasVnextErrors)
        <ul class="ml-[var(--lv-space-4)] flex list-disc flex-col gap-[var(--lv-space-1)]">
          @for(java.util.Map<String, String> err : errors)
            <li>
              @if(err.get("fieldId") != null && !err.get("fieldId").isBlank())
                <a href="#${err.get("fieldId")}" class="underline">${err.get("message")}</a>
              @else
                ${err.get("message")}
              @endif
            </li>
          @endfor
        </ul>
      @elseif(_hasSingleError)
        ${error}
      @endif
    @endif
  </div>

  ${content}

  @if(footer != null)
    <div data-slot="form-footer">${footer}</div>
  @endif
</form>
