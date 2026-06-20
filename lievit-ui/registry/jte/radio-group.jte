<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui radio-group partial -- a token-styled group of native <input type="radio">.

  TIER: STATIC presentational -> JTE partial. Native radios sharing one `name` give the
  single-selection invariant, roving arrow-key focus, and the radiogroup/radio roles for free
  from the platform; there is no client state and no JS key handler to ship (the Lit island had
  to reimplement all of it). `l:model` on each radio binds the native change event to a wire
  field.

  STRUCTURE (scientific decision rule): shadcn's RadioGroup is a Radix component reimplementing
  the roving-tabindex roaming + selection in JS (and breaks JS-off submit). The native radios in
  a <fieldset> with a shared `name` give the SAME behaviour for free and POST natively, so they
  win on a11y, bundle and no-JS. We style native radios with `appearance-none` + a token dot
  (shadcn's visual), grouped in a <fieldset> with a <legend>.

  A11y (WAI-ARIA APG radio group): a native <fieldset> + <legend> is the platform radiogroup;
  each option is a real <input type=radio> with a <label>. The shared `name` enforces single
  selection and roving focus. `ariaLabel` on the fieldset names the group when there is no
  visible legend.

  OPTIONS: pass a Map<String,String> via `options` (value -> label) for the simple case, OR a
  `content` slot of hand-authored option markup (each composing @@template.radio-group.option) for
  per-option disabled / rich labels. `content` wins.

  INVALID: `invalid` sets aria-invalid="true" on the radiogroup (and each option's radio gets the
  danger ring), shadcn's radio-group error state; pass `describedBy` to point the group at an
  external error element (e.g. `<name>-error` from @@template.field).

  Params:
    String name                       the shared radio name (POSTs the selected value).
    java.util.Map<String,String> options = null  ordered value->label option map.
    gg.jte.Content content = null     hand-authored option markup (wins over options).
    String value      = null          the currently selected value.
    String label      = null          visible <legend> text.
    String ariaLabel  = null          aria-label on the fieldset when no visible legend.
    String describedBy = null         id of an external hint/error element (aria-describedby).
    boolean disabled  = false         disables the whole group.
    boolean required  = false         marks the group required.
    boolean invalid   = false         aria-invalid="true" + danger option rings (error state).
    String orientation = "vertical"   "vertical" | "horizontal" option layout.
    String model      = null          l:model expression bound on each radio.
    String cssClass   = ""            extra utility classes on the fieldset.

  Usage:
    @@template.radio-group(
      name = "stato", label = "Stato", value = contatto.stato(),
      options = java.util.Map.of("attivo", "Attivo", "sospeso", "Sospeso")
    )
--%>
@import gg.jte.Content
@param String name
@param java.util.Map<String, String> options = null
@param gg.jte.Content content = null
@param String value = null
@param String label = null
@param String ariaLabel = null
@param String describedBy = null
@param boolean disabled = false
@param boolean required = false
@param boolean invalid = false
@param String orientation = "vertical"
@param String model = null
@param String cssClass = ""

<fieldset
  data-slot="radio-group"
  aria-label="${ariaLabel}"
  aria-describedby="${describedBy}"
  aria-invalid="${invalid ? "true" : null}"
  data-invalid="${invalid ? "true" : null}"
  disabled="${disabled}"
  class="m-0 min-w-0 border-0 p-0 ${cssClass}"
>
  @if(label != null && !label.isBlank())
    <legend data-slot="radio-group-label" class="mb-[var(--lv-space-2)] p-0 text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]" style="font-family:var(--lv-font-sans);">${label}</legend>
  @endif
  <div data-slot="radio-group-options" data-orientation="${orientation}" class="flex gap-[var(--lv-space-2)] data-[orientation=vertical]:flex-col data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:flex-wrap">
    @if(content != null)
      ${content}
    @elseif(options != null)
      @for(java.util.Map.Entry<String, String> opt : options.entrySet())
        @template.radio-group.option(name = name, value = opt.getKey(), label = opt.getValue(), checked = opt.getKey().equals(value), required = required, invalid = invalid, model = model)
      @endfor
    @endif
  </div>
</fieldset>
