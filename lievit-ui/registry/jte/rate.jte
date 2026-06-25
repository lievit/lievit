<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui rate partial -- a star-rating control (Ant Design Rate parity).

  TIER: PARTIAL + client controller. The SELECTION is a native radio group (one radio per star,
  sr-only, form-submitting); the SERVER renders the painted fill from the initial value; the
  `lv-rate` Stimulus controller adds the hover preview and keeps the fill in sync. Progressive
  enhancement: with JS off the radios still select + submit and the fill is correct. CSP-clean
  (behaviour in the controller module; data-action / data-*-value are plain strings).

  STRUCTURE (scientific decision rule):
    Ant's Rate is a row of stars with single selection + hover preview. The accessible, no-JS-safe
    base is a radiogroup of N radios (platform single-selection, arrow-key roving, Tab, submit); the
    visible stars reuse the lievit "star" icon. The initial fill is computed SERVER-SIDE (star i is
    active when i <= value), so the rating renders correctly before (and without) JS; the controller
    only enriches it with the live hover preview, painting via element.style (controller JS, not an
    inline handler). Half-stars are intentionally out of scope for this first cut (full stars only).
    Inventory reference: Ant Design Rate. Original generation over --lv-* tokens; no Ant code copied.

  A11y (WAI-ARIA radiogroup via native radios): a <fieldset role="radiogroup"> with an accessible
    name; each star is a real radio with an accessible per-star label ("N stars") so AT announces the
    value, not just a glyph. Colour is never the sole signal (the radio's checked state + label text
    carry the rating). The glyphs are aria-hidden decoration.

  Params:
    String name                          the submitted field name.
    int count        = 5                 number of stars.
    Integer value    = null              the initial rating (1..count), or null for none.
    String label     = null              optional visible legend.
    String ariaLabel = null              accessible name when there is no visible legend.
    boolean disabled = false             disable the whole control.
    String size      = "1.5rem"          star glyph size (any CSS length).
    String activeColor = "var(--lv-color-warning)"  filled-star colour (token or raw).
    String emptyColor  = "var(--lv-color-muted)"     empty-star colour (token or raw).
    String cssClass  = ""                extra utility classes on the root.
    String attrs     = ""                TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.rate(name = "quality", value = 4)
    @@template.lievit.rate(name = "score", count = 10, value = 7, ariaLabel = "Score")
--%>
@param String name
@param int count = 5
@param Integer value = null
@param String label = null
@param String ariaLabel = null
@param boolean disabled = false
@param String size = "1.5rem"
@param String activeColor = "var(--lv-color-warning)"
@param String emptyColor = "var(--lv-color-muted)"
@param String cssClass = ""
@param String attrs = ""

!{var current = value == null ? 0 : value.intValue();}
!{var clampedCount = Math.max(1, Math.min(20, count));}

<fieldset
  data-slot="rate"
  data-controller="lv-rate"
  data-lv-rate-active-color-value="${activeColor}"
  data-lv-rate-empty-color-value="${emptyColor}"
  role="radiogroup"
  aria-label="${ariaLabel}"
  data-disabled="${disabled ? "true" : null}"
  disabled="${disabled}"
  class="m-0 inline-flex flex-col border-0 p-0 ${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{attrs}
>
  @if(label != null && !label.isBlank())
    <legend data-slot="rate-label" class="mb-[var(--lv-space-2)] p-0 text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]">${label}</legend>
  @endif
  <div data-slot="rate-stars" class="inline-flex items-center gap-[var(--lv-space-1)]">
    @for(int i = 1; i <= clampedCount; i++)
      !{var active = i <= current;}
      !{var starId = name + "-" + i;}
      <label
        for="${starId}"
        data-slot="rate-item"
        data-value="${i}"
        data-action="mouseenter->lv-rate#preview mouseleave->lv-rate#reset"
        class="relative inline-flex cursor-pointer select-none peer-disabled:cursor-not-allowed"
      >
        <input
          type="radio"
          data-slot="rate-control"
          data-lv-rate-target="input"
          data-action="change->lv-rate#onChange"
          id="${starId}"
          name="${name}"
          value="${i}"
          checked="${i == current}"
          disabled="${disabled}"
          aria-label="${i + (i == 1 ? " star" : " stars")}"
          class="peer absolute h-px w-px overflow-hidden opacity-0"
        >
        <span
          data-slot="rate-star"
          data-lv-rate-target="star"
          data-active="${active ? "true" : "false"}"
          aria-hidden="true"
          class="inline-flex transition-[color,transform] peer-focus-visible:rounded-[var(--lv-radius-sm)] peer-focus-visible:shadow-[var(--lv-ring)] peer-disabled:opacity-50 hover:scale-110"
          style="color:${active ? activeColor : emptyColor};"
        >@template.lievit.icon(name = "star", size = size)</span>
      </label>
    @endfor
  </div>
</fieldset>
