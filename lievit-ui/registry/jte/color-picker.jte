<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui color-picker partial -- a colour FORM field: a swatch + a native
  <input type="color"> (the canonical no-dep colour picker), with optional preset swatches above
  (Filament's ColorPicker; shadcn has no colour primitive, so this is the native-first take).

  TIER: PARTIAL (+ optional enhancer, ADR-0012 server-first). The native <input type="color"> is
  the form-bound source of truth: it carries the OS colour-picker UI, keyboard + a11y for free, and
  POSTs the chosen hex (e.g. "#ff8800") under `name` with ZERO JavaScript. The visible swatch is the
  live current colour. The optional PRESET swatches are a pure enhancement: rendered as real
  <button>s that the CSP-clean enhancer wires to write the chosen preset into the native input
  (firing native input/change so l:model + forms see it). JS-OFF the presets simply do nothing
  visible beyond being a labelled palette hint, and the user picks via the native control -- no dead
  required control.

  STRUCTURE (scientific decision rule): a custom colour wheel reimplements the entire HSV picker +
  keyboard + a11y in JS and breaks no-JS submit. The native <input type=color> gives the whole
  picker, the value semantics and the POST for free, so it is the base layer; presets are only a
  convenience layered on top, never the control.

  A11y: a real <input type=color> with its own id/name; an external <label for> (or the optional
  `label`) names it, `ariaLabel` when neither is present. The swatch is decorative (aria-hidden).
  Each preset is a real <button type=button> with an aria-label naming its colour (colour is never
  the only signal). `invalid` sets aria-invalid + a danger ring; `describedBy` points at an external
  error element.

  Params:
    String name                       the field name (POSTs the hex value).
    String id          = name         the input's id (for a <label for>); defaults to name.
    String value       = "#000000"    initial colour (a 7-char hex, the native input's format).
    String label       = null         visible <label> text rendered above the control.
    String ariaLabel   = null         aria-label when there is no visible label.
    String describedBy = null         id of an external hint/error element (aria-describedby).
    java.util.List<String> presets = null  optional preset hex swatches (JS-on quick-pick).
    boolean disabled   = false        disables + dims the control.
    boolean required   = false        marks the control required.
    boolean invalid    = false        danger ring + aria-invalid="true".
    String model       = null         l:model expression to bind the native input.
    String cssClass    = ""           extra utility classes on the wrapper.

  Usage:
    @@template.lievit.color-picker(name = "colore", label = "Colore etichetta", value = "#2563eb",
      presets = java.util.List.of("#2563eb", "#16a34a", "#dc2626", "#ca8a04"))
--%>
@param String name
@param String id = null
@param String value = "#000000"
@param String label = null
@param String ariaLabel = null
@param String describedBy = null
@param java.util.List<String> presets = null
@param boolean disabled = false
@param boolean required = false
@param boolean invalid = false
@param String model = null
@param String cssClass = ""

!{var inputId = (id != null && !id.isBlank()) ? id : name;}
!{var hasPresets = presets != null && !presets.isEmpty();}

<div
  data-slot="color-picker"
  data-lievit-color-picker
  data-disabled="${disabled ? "true" : null}"
  data-invalid="${invalid ? "true" : null}"
  class="flex w-fit flex-col gap-[var(--lv-space-2)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(label != null && !label.isBlank())
    <label for="${inputId}" data-slot="color-picker-label" class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]">${label}</label>
  @endif

  @if(hasPresets)
    <div data-slot="color-picker-presets" role="group" aria-label="Color presets" class="flex flex-wrap items-center gap-[var(--lv-space-1)]">
      @for(String preset : presets)
        <button
          type="button"
          data-slot="color-picker-preset"
          data-color-picker-preset="${preset}"
          aria-label="${preset}"
          disabled="${disabled}"
          class="size-[var(--lv-space-6)] shrink-0 rounded-[var(--lv-radius-sm)] border border-[var(--lv-color-border)] shadow-[var(--lv-shadow-xs)] outline-none transition-shadow hover:shadow-[var(--lv-shadow-sm)] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50"
          style="background:${preset};"
        ></button>
      @endfor
    </div>
  @endif

  <div
    data-slot="color-picker-control"
    class="flex items-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] p-[var(--lv-space-1)] shadow-[var(--lv-shadow-xs)] transition-[color,box-shadow] focus-within:border-[var(--lv-color-ring)] focus-within:shadow-[var(--lv-ring)] data-[invalid=true]:border-[var(--lv-color-destructive)] data-[disabled=true]:opacity-50"
    data-invalid="${invalid ? "true" : null}"
    data-disabled="${disabled ? "true" : null}"
  >
    <input
      data-slot="color-picker-input"
      data-color-picker-input
      type="color"
      id="${inputId}"
      name="${name}"
      value="${value}"
      disabled="${disabled}"
      required="${required}"
      aria-label="${ariaLabel}"
      aria-describedby="${describedBy}"
      aria-invalid="${invalid ? "true" : null}"
      l:model="${model}"
      class="size-[var(--lv-space-7)] shrink-0 cursor-pointer rounded-[var(--lv-radius-sm)] border-0 bg-transparent p-0 outline-none disabled:cursor-not-allowed [&::-webkit-color-swatch]:rounded-[var(--lv-radius-sm)] [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-moz-color-swatch]:rounded-[var(--lv-radius-sm)] [&::-moz-color-swatch]:border-0"
    >
    <output data-slot="color-picker-value" data-color-picker-value aria-live="polite" class="text-[length:var(--lv-text-sm)] tabular-nums text-[var(--lv-color-muted-fg)]">${value}</output>
  </div>
</div>
