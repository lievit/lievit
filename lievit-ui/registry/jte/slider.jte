<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui slider partial -- a token-styled native <input type="range">.

  TIER: STATIC presentational -> JTE partial. The native range input carries role=slider,
  aria-valuemin/max/now and full keyboard navigation (Arrow/Home/End/PageUp-Down) for free; there
  is no client state and no JS key handler (the Lit island wrapped exactly this native element).
  It POSTs its numeric value under `name`; `l:model` binds the native input/change events.

  STRUCTURE (scientific decision rule): shadcn's Slider is a Radix multi-thumb component (JS for
  the thumb math) that breaks JS-off submit. For a single-thumb control the native
  <input type=range> gives the slider role, value semantics and keyboard for free and POSTs
  natively, so it wins on a11y, bundle and no-JS. We style the native track + thumb via the
  webkit/moz pseudo-elements (shadcn's visual), focus ring `--lv-ring`.

  A11y (WAI-ARIA APG slider): a real <input type=range> with its own id/name; min/max/step and
  the value semantics come from the platform. `ariaLabel` names it when there is no visible
  <label for>. The optional value readout is `aria-live="polite"`.

  Params:
    String name                 the slider's name (POSTs the numeric value).
    String id          = name   the input's id (for a <label for>); defaults to name.
    int value          = 0      current value.
    int min            = 0      minimum value.
    int max            = 100    maximum value.
    int step           = 1      step increment.
    boolean disabled   = false  disables + dims the control.
    String ariaLabel   = null   aria-label when there is no visible label.
    boolean showValue  = false  render the current value beside the track.
    String model       = null   l:model expression to bind this slider to a wire field.
    String cssClass    = ""      extra utility classes on the wrapper.

  Usage:
    @@template.slider(name = "prezzo", min = 0, max = 1000, step = 50, value = 250, showValue = true)
    @@template.slider(name = "raggio", ariaLabel = "Raggio km", model = "raggio")
--%>
@param String name
@param String id = null
@param int value = 0
@param int min = 0
@param int max = 100
@param int step = 1
@param boolean disabled = false
@param String ariaLabel = null
@param boolean showValue = false
@param String model = null
@param String cssClass = ""

!{var rangeId = (id != null && !id.isBlank()) ? id : name;}

<div data-slot="slider" class="flex items-center gap-[var(--lv-space-3)] ${cssClass}">
  <input
    data-slot="slider-control"
    type="range"
    id="${rangeId}"
    name="${name}"
    value="${value}"
    min="${min}"
    max="${max}"
    step="${step}"
    disabled="${disabled}"
    aria-label="${ariaLabel}"
    l:model="${model}"
    class="h-[0.375rem] flex-1 cursor-pointer appearance-none rounded-[var(--lv-radius-sm)] bg-[var(--lv-color-input)] outline-none transition-shadow focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-slider-thumb]:size-[1.125rem] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--lv-color-bg)] [&::-webkit-slider-thumb]:bg-[var(--lv-color-primary)] [&::-webkit-slider-thumb]:shadow-[var(--lv-shadow-sm)] [&::-moz-range-thumb]:size-[1.125rem] [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--lv-color-bg)] [&::-moz-range-thumb]:bg-[var(--lv-color-primary)] [&::-moz-range-thumb]:shadow-[var(--lv-shadow-sm)]"
  >
  @if(showValue)
    <output data-slot="slider-value" aria-live="polite" class="min-w-[2.5rem] text-right text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)] tabular-nums" style="font-family:var(--lv-font-sans);">${value}</output>
  @endif
</div>
