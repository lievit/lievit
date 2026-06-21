<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui textarea partial -- a token-styled multi-line native <textarea>.

  TIER: STATIC presentational -> JTE partial. The control state lives in the native <textarea>;
  the partial is the token styling + the focus ring, no client behaviour. The Lit island it
  replaces was never form-associated (the FormData dogfood bug), so the native element is a
  strict improvement: a real `name` that POSTs JS-off, and `l:model` binds the native
  input/change events directly on the element.

  STRUCTURE (scientific decision rule): shadcn's Textarea is the native <textarea> styled with
  the same border + focus ring as Input, vertically resizable. MUI/Radix wrap it for autosize /
  adornments that the plain case does not need. The bare native control wins on a11y + bundle,
  so we style it directly (shadcn's approach): `resize-y`, the `--lv-ring` focus ring raised by
  `focus-visible`, `aria-invalid` from the `invalid` flag (WAI-ARIA).

  A11y (shadcn / WAI-ARIA model): a real <textarea> with its own id/name so a <label for> and
  validation bind to it directly. `ariaLabel` provides an accessible name when there is no
  visible label; `invalid` toggles `aria-invalid="true"` + a danger border; `describedBy` points
  at an external hint/error element. The built-in `hint` renders a muted helper line below and is
  auto-wired into aria-describedby via id `<areaId>-hint`.

  Params:
    String name                   the textarea's name attribute (POSTs under this name).
    String id          = name     the textarea's id (for a <label for>); defaults to name.
    String value       = null     current value (rendered as the element's text content).
    String placeholder = null     placeholder text.
    int rows           = 3        visible rows.
    String hint        = null     built-in muted helper text below the textarea (auto aria-describedby).
    String ariaLabel   = null     aria-label when there is no visible <label for>.
    String describedBy = null     id of an external hint/error element (aria-describedby).
    boolean invalid    = false    danger border + aria-invalid="true".
    boolean disabled   = false    disables + dims the control.
    boolean required   = false    marks the control required.
    boolean readonly   = false    marks the control read-only.
    String model       = null     l:model expression to bind this textarea to a wire field.
    String cssClass    = ""       extra utility classes on the textarea.

  Usage:
    @@template.lievit.textarea(name = "note", rows = 5, value = contatto.note())
    @@template.lievit.textarea(name = "bio", placeholder = "Raccontaci...", hint = "Max 280 chars")
--%>
@param String name
@param String id = null
@param String value = null
@param String placeholder = null
@param int rows = 3
@param String hint = null
@param String ariaLabel = null
@param String describedBy = null
@param boolean invalid = false
@param boolean disabled = false
@param boolean required = false
@param boolean readonly = false
@param String model = null
@param String cssClass = ""

!{var areaId = (id != null && !id.isBlank()) ? id : name;}
!{var hasHint = hint != null && !hint.isBlank();}
!{var describedByValue = (describedBy != null && !describedBy.isBlank()) ? describedBy : (hasHint ? areaId + "-hint" : null);}

<textarea
  data-slot="textarea"
  id="${areaId}"
  name="${name}"
  rows="${rows}"
  placeholder="${placeholder}"
  aria-label="${ariaLabel}"
  aria-describedby="${describedByValue}"
  aria-invalid="${invalid ? "true" : null}"
  disabled="${disabled}"
  required="${required}"
  readonly="${readonly}"
  l:model="${model}"
  class="flex min-h-[calc(var(--lv-space-10)*1.6)] w-full min-w-0 resize-y rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-xs)] transition-shadow outline-none placeholder:text-[var(--lv-color-muted-fg)] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-[var(--lv-color-danger)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>${value}</textarea>
@if(hasHint)
  <p data-slot="textarea-hint" id="${areaId}-hint" class="mt-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]" style="font-family:var(--lv-font-sans);">${hint}</p>
@endif
