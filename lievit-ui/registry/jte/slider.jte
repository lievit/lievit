<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui slider partial -- a token-styled native <input type="range">; single-thumb by
  default, an optional two-thumb RANGE variant, horizontal or vertical.

  TIER: STATIC presentational -> JTE partial. The native range input carries role=slider,
  aria-valuemin/max/now and full keyboard navigation (Arrow/Home/End/PageUp-Down) for free; there
  is no client state and no JS key handler (the Lit island wrapped exactly this native element).
  It POSTs its numeric value under `name`; `l:model` binds the native input/change events.

  STRUCTURE (scientific decision rule): shadcn's Slider is a Radix multi-thumb component (JS for
  the thumb math) that breaks JS-off submit. For a single-thumb control the native
  <input type=range> gives the slider role, value semantics and keyboard for free and POSTs
  natively, so it wins on a11y, bundle and no-JS. The RANGE (two-thumb) case is shadcn's Slider
  with two values: we render TWO native ranges, one per bound (POSTing `<name>Min` / `<name>Max`),
  overlaid on a shared track so both thumbs are real native sliders with real keyboard + a11y, no
  JS thumb math. VERTICAL uses the platform's native vertical range (writing-mode: vertical), not
  a rotate hack, so the keyboard arrows map to the visual axis.

  A11y (WAI-ARIA APG slider): each thumb is a real <input type=range> with its own id/name; min/
  max/step and the value semantics come from the platform. `ariaLabel` (single) or
  `ariaLabelMin`/`ariaLabelMax` (range) name the thumbs when there is no visible <label for>. The
  optional value readout is `aria-live="polite"`.

  Params:
    String name                 the slider's name (single: POSTs value; range: POSTs <name>Min/<name>Max).
    String id          = name   the input's id (for a <label for>); defaults to name.
    int value          = 0      current value (single-thumb).
    int valueMin       = min    lower thumb value (range variant).
    int valueMax       = max    upper thumb value (range variant).
    int min            = 0      minimum value.
    int max            = 100    maximum value.
    int step           = 1      step increment.
    boolean range      = false  two-thumb range variant (lower + upper bound).
    String orientation = "horizontal"  "horizontal" | "vertical".
    boolean disabled   = false  disables + dims the control.
    String ariaLabel   = null   aria-label for the single thumb (or the lower thumb in range).
    String ariaLabelMax = null  aria-label for the upper thumb (range variant).
    boolean showValue  = false  render the current value(s) beside the track.
    String model       = null   l:model expression to bind the single thumb to a wire field.
    String cssClass    = ""      extra utility classes on the wrapper.

  Usage:
    @@template.lievit.slider(name = "prezzo", min = 0, max = 1000, step = 50, value = 250, showValue = true)
    @@template.lievit.slider(name = "fascia", range = true, min = 0, max = 1000, valueMin = 200, valueMax = 800, showValue = true)
    @@template.lievit.slider(name = "volume", orientation = "vertical", value = 60, ariaLabel = "Volume")
--%>
@param String name
@param String id = null
@param int value = 0
@param Integer valueMin = null
@param Integer valueMax = null
@param int min = 0
@param int max = 100
@param int step = 1
@param boolean range = false
@param String orientation = "horizontal"
@param boolean disabled = false
@param String ariaLabel = null
@param String ariaLabelMax = null
@param boolean showValue = false
@param String model = null
@param String cssClass = ""

!{var rangeId = (id != null && !id.isBlank()) ? id : name;}
!{var isVertical = "vertical".equals(orientation);}
!{var lo = (valueMin != null) ? valueMin.intValue() : min;}
!{var hi = (valueMax != null) ? valueMax.intValue() : max;}
!{var thumbBase = "appearance-none cursor-pointer rounded-[var(--lv-radius-sm)] bg-transparent outline-none transition-shadow focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-slider-thumb]:size-[1.125rem] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--lv-color-bg)] [&::-webkit-slider-thumb]:bg-[var(--lv-color-primary)] [&::-webkit-slider-thumb]:shadow-[var(--lv-shadow-sm)] [&::-moz-range-thumb]:size-[1.125rem] [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--lv-color-bg)] [&::-moz-range-thumb]:bg-[var(--lv-color-primary)] [&::-moz-range-thumb]:shadow-[var(--lv-shadow-sm)]";}
!{var trackSize = isVertical ? "h-[10rem] w-[0.375rem] flex-col" : "h-[0.375rem] w-full flex-1";}
!{var inputAxis = isVertical ? "h-full w-[0.375rem]" : "h-[0.375rem] w-full";}
!{var verticalStyle = isVertical ? "writing-mode: vertical-lr; direction: rtl;" : "";}

<div data-slot="slider" data-orientation="${orientation}" data-range="${range ? "true" : null}" class="flex items-center gap-[var(--lv-space-3)] data-[orientation=vertical]:flex-col ${cssClass}">
  @if(range)
    <div data-slot="slider-track" class="relative flex items-center rounded-[var(--lv-radius-sm)] bg-[var(--lv-color-input)] ${trackSize}">
      <input
        data-slot="slider-control"
        data-thumb="min"
        type="range"
        id="${rangeId}-min"
        name="${name}Min"
        value="${lo}"
        min="${min}"
        max="${max}"
        step="${step}"
        disabled="${disabled}"
        aria-label="${ariaLabel}"
        class="absolute ${inputAxis} ${thumbBase}"
        style="${verticalStyle}font-family:var(--lv-font-sans);"
      >
      <input
        data-slot="slider-control"
        data-thumb="max"
        type="range"
        id="${rangeId}-max"
        name="${name}Max"
        value="${hi}"
        min="${min}"
        max="${max}"
        step="${step}"
        disabled="${disabled}"
        aria-label="${ariaLabelMax}"
        class="absolute ${inputAxis} ${thumbBase}"
        style="${verticalStyle}font-family:var(--lv-font-sans);"
      >
    </div>
    @if(showValue)
      <output data-slot="slider-value" aria-live="polite" class="min-w-[4.5rem] text-right text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)] tabular-nums" style="font-family:var(--lv-font-sans);">${lo} - ${hi}</output>
    @endif
  @else
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
      class="rounded-[var(--lv-radius-sm)] bg-[var(--lv-color-input)] ${trackSize} ${thumbBase}"
      style="${verticalStyle}font-family:var(--lv-font-sans);"
    >
    @if(showValue)
      <output data-slot="slider-value" aria-live="polite" class="min-w-[2.5rem] text-right text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)] tabular-nums" style="font-family:var(--lv-font-sans);">${value}</output>
    @endif
  @endif
</div>
