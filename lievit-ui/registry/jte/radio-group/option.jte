<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui radio-group/option partial -- one native <input type="radio"> + its <label>.

  TIER: STATIC presentational -> JTE partial. A single native radio styled by tokens; part of the
  radio-group family (use it directly only for the `content` slot of @@template.lievit.radio-group when
  you need per-option disabled or rich labels). The shared `name` (passed by the group) ties the
  options into one native single-selection group.

  STRUCTURE: native <input type=radio> with `appearance-none` and a token dot revealed via
  `checked` (shadcn's visual), wrapped in a <label> for click-to-select.

  A11y: a real radio with its own id; the wrapping <label> names it. Inherits the group's
  fieldset legend/aria-label as the group name.

  Params:
    String name                 the shared radio name (from the group).
    String value                this option's submitted value.
    String label    = null      visible label text.
    String id       = value     the radio's id; defaults to the value.
    boolean checked  = false    initial selected state.
    boolean disabled = false    disables this option.
    boolean required = false    marks the radio required.
    boolean invalid  = false    danger ring + aria-invalid="true" (group error state).
    String model    = null      l:model expression bound on the radio.

  Usage:
    @@template.lievit.radio-group.option(name = "stato", value = "attivo", label = "Attivo", checked = true)
--%>
@param String name
@param String value
@param String label = null
@param String id = null
@param boolean checked = false
@param boolean disabled = false
@param boolean required = false
@param boolean invalid = false
@param String model = null

!{var radioId = (id != null && !id.isBlank()) ? id : name + "-" + value;}

<label
  for="${radioId}"
  data-slot="radio-group-option"
  data-disabled="${disabled}"
  class="inline-flex items-center gap-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] select-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50"
  style="font-family:var(--lv-font-sans);"
>
  <span class="relative inline-flex size-[var(--lv-space-4)] shrink-0 items-center justify-center">
    <input
      data-slot="radio-group-control"
      type="radio"
      id="${radioId}"
      name="${name}"
      value="${value}"
      checked="${checked}"
      disabled="${disabled}"
      required="${required}"
      aria-invalid="${invalid ? "true" : null}"
      l:model="${model}"
      class="peer size-full cursor-pointer appearance-none rounded-full border-2 border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] shadow-[var(--lv-shadow-xs)] outline-none transition-shadow checked:border-[var(--lv-color-primary)] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed aria-[invalid=true]:border-[var(--lv-color-danger)] aria-[invalid=true]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--lv-color-destructive)_20%,transparent)]"
    >
    <span data-slot="radio-group-indicator" aria-hidden="true" class="pointer-events-none absolute hidden size-[0.5rem] rounded-full bg-[var(--lv-color-primary)] peer-checked:block"></span>
  </span>
  @if(label != null && !label.isBlank())
    <span data-slot="radio-group-option-label">${label}</span>
  @endif
</label>
