<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui input partial -- a token-styled single-line native <input>.

  TIER: STATIC presentational -> JTE partial. The control state lives in the native <input>;
  the partial is the token styling + the focus ring, no client behaviour. The Lit island it
  replaces was never form-associated (the FormData dogfood bug), so the native element is a
  strict improvement: a real `name` that POSTs JS-off, and `l:model` binds the native
  input/change events directly on the element.

  STRUCTURE (scientific decision rule): shadcn/MUI/Radix were compared. shadcn's Input is the
  native <input> with a border + focus ring driven by tokens; MUI/Radix add a wrapper component
  with JS for floating labels / adornments that the native element does not need for the plain
  case. On a11y and bundle size the bare native control wins outright, so we style the native
  <input> directly (shadcn's exact approach): `appearance` untouched, `aria-invalid` from the
  `invalid` flag (WAI-ARIA), the focus ring is `--lv-ring` raised by `focus-visible`.

  A11y (shadcn / WAI-ARIA model): a real <input> with its own id/name so a <label for> and
  validation bind to it directly. `ariaLabel` provides an accessible name when there is no
  visible label. `invalid` toggles `aria-invalid="true"` + a danger border so assistive tech is
  told about validation state. `describedBy` points at an external hint/error element; when the
  built-in `hint` is used instead, the input auto-references it via id `<inputId>-hint`.

  FILE INPUTS: `type="file"` gets shadcn's file affordance (the `file:` pseudo styles the native
  "Choose file" button as a token-styled inline chip, no border/shadow on the field itself), so a
  file picker reads as part of the family without a custom widget.

  HELPER TEXT (built-in): pass `hint` to render a muted helper line below the input wired into the
  control's aria-describedby automatically (id `<inputId>-hint`). For the field's full
  label+error orchestration use @@template.lievit.field instead; `hint` is the standalone shorthand.

  SIZE (toolbar parity with @@template.lievit.button + @@template.lievit.native-select). `size` is
  HEIGHT-based so the input sits flush next to a button / native-select of the matching size in a
  toolbar row. Each size pins the SAME --lv-space height token the other form controls use:
    sm -> h-[var(--lv-space-8)]  (2rem)   ; compact toolbar
    md -> h-[var(--lv-space-10)] (2.5rem) ; THE default, the row baseline
    lg -> h-[var(--lv-space-12)] (3rem)   ; tall

  Params:
    String name                   the input's name attribute (POSTs under this name).
    String id          = name     the input's id (for a <label for>); defaults to name.
    String type        = "text"   native input type (text, search, email, password, number, file...).
    String size        = "md"     "sm" | "md" | "lg" control height (aligns to button / native-select).
    String value       = null     current value.
    String placeholder = null     placeholder text.
    String hint        = null     built-in muted helper text below the input (auto aria-describedby).
    String accept      = null     file-input accept filter (only meaningful for type="file").
    boolean multiple   = false    allow multiple files (only meaningful for type="file").
    String ariaLabel   = null     aria-label when there is no visible <label for>.
    String describedBy = null     id of an external hint/error element (aria-describedby).
    String autocomplete = null    native autocomplete hint.
    boolean invalid    = false    danger border + aria-invalid="true".
    boolean disabled   = false    disables + dims the control.
    boolean required   = false    marks the control required.
    boolean readonly   = false    marks the control read-only.
    String model       = null     l:model expression to bind this input to a wire field.
    String cssClass    = ""       extra utility classes on the input.

  Usage:
    @@template.lievit.input(name = "nome", type = "text", value = contatto.nome())
    @@template.lievit.input(name = "q", type = "search", placeholder = "Cerca...", model = "query")
    @@template.lievit.input(name = "q", type = "search", size = "sm", placeholder = "Cerca...")
    @@template.lievit.input(name = "avatar", type = "file", accept = "image/*", hint = "PNG or JPG, max 2MB")
--%>
@param String name
@param String id = null
@param String type = "text"
@param String size = "md"
@param String value = null
@param String placeholder = null
@param String hint = null
@param String accept = null
@param boolean multiple = false
@param String ariaLabel = null
@param String describedBy = null
@param String autocomplete = null
@param boolean invalid = false
@param boolean disabled = false
@param boolean required = false
@param boolean readonly = false
@param String model = null
@param String cssClass = ""

!{var inputId = (id != null && !id.isBlank()) ? id : name;}
!{var hasHint = hint != null && !hint.isBlank();}
!{var isFile = "file".equals(type);}
!{var describedByValue = (describedBy != null && !describedBy.isBlank()) ? describedBy : (hasHint ? inputId + "-hint" : null);}
!{var fileClasses = isFile ? " file:mr-[var(--lv-space-3)] file:h-full file:border-0 file:bg-transparent file:text-[length:var(--lv-text-sm)] file:font-[var(--lv-font-medium)] file:text-[var(--lv-color-fg)] py-0 cursor-pointer file:cursor-pointer" : "";}
<%-- height per size; md is the toolbar baseline and matches button md + native-select default --%>
!{var sizeClass = switch (size) {
    case "sm" -> "h-[var(--lv-space-8)]";
    case "lg" -> "h-[var(--lv-space-12)]";
    default   -> "h-[var(--lv-space-10)]";
  };}

<input
  data-slot="input"
  data-size="${size}"
  id="${inputId}"
  name="${name}"
  type="${type}"
  value="${value}"
  placeholder="${placeholder}"
  accept="${isFile ? accept : null}"
  multiple="${isFile && multiple}"
  aria-label="${ariaLabel}"
  aria-describedby="${describedByValue}"
  aria-invalid="${invalid ? "true" : null}"
  autocomplete="${autocomplete}"
  disabled="${disabled}"
  required="${required}"
  readonly="${readonly}"
  l:model="${model}"
  class="flex ${sizeClass} w-full min-w-0 items-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-xs)] transition-shadow outline-none placeholder:text-[var(--lv-color-muted-fg)] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-[var(--lv-color-danger)]${fileClasses} ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
@if(hasHint)
  <p data-slot="input-hint" id="${inputId}-hint" class="mt-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]" style="font-family:var(--lv-font-sans);">${hint}</p>
@endif
