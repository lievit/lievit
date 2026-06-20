@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui label partial -- a token-styled native <label> with an optional required marker.

  TIER: STATIC presentational -> JTE partial. A native <label for> is the whole control: the
  platform gives click-to-focus and the accessible-name association for free; there is no client
  state. The Lit island it replaces only wrapped a native <label>, so this is a pure markup win.

  STRUCTURE (scientific decision rule): shadcn's Label is the native <label> with a small
  utility class (font-medium, peer-disabled dimming). Radix's Label adds a component only to
  forward refs in React; in JTE the native element needs nothing extra. We style the native
  <label> directly (shadcn's approach): the required asterisk is `aria-hidden` so it is not read
  as literal punctuation.

  A11y (shadcn / WAI-ARIA model): a real <label for> names the control by id, so clicking the
  label focuses the control and screen readers announce the control's name. The required marker
  is decorative (`aria-hidden="true"`); convey "required" to assistive tech on the control itself
  (the input's `required` attribute).

  Params:
    String forId               id of the control this label names (the native `for`).
    String text     = null     label text (when no content slot is given).
    gg.jte.Content content = null  rich label content (wins over text).
    boolean required = false   renders a danger asterisk after the text.
    boolean error    = false   sets data-error + a destructive label colour (shadcn's invalid cue).
    String cssClass = ""       extra utility classes on the label.

  Usage:
    @@template.label(forId = "email", text = "Email", required = true)
    @@template.label(forId = "note", content = @@`Note <small>(opzionali)</small>`)
--%>
@param String forId
@param String text = null
@param gg.jte.Content content = null
@param boolean required = false
@param boolean error = false
@param String cssClass = ""

<label
  for="${forId}"
  data-slot="label"
  data-error="${error ? "true" : null}"
  class="inline-flex items-center gap-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] select-none data-[error=true]:text-[var(--lv-color-danger)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(content != null)${content}@else${text}@endif
  @if(required)
    <span aria-hidden="true" class="text-[var(--lv-color-danger)]">*</span>
  @endif
</label>
