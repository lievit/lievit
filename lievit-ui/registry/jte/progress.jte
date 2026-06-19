<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui progress partial -- a determinate or indeterminate progress bar.

  TIER: STATIC presentational -> JTE partial. The former <lv-progress> island computed a width
  and an ARIA value; both are pure functions of the typed `value`, so the server renders them.

  STRUCTURE (scientific decision rule): a token-styled bar with the WAI-ARIA progressbar
  pattern rather than the native <progress> element. The native element's fill cannot be
  themed by the --lv-* tokens cross-browser (its pseudo-elements vary by engine), and an
  indeterminate native bar gives no styling hook for the reduced-motion guard; a div+role
  progressbar (shadcn's Radix Progress approach) themes cleanly and keeps the indeterminate
  animation in CSS (motion-reduce:animate-none). The track + fill read --lv-color tokens.

  A11y (WAI-ARIA progressbar): role="progressbar" + aria-valuemin/max + aria-label; for a
  determinate bar aria-valuenow carries the percent, for indeterminate (value < 0) it is
  omitted (the indeterminate convention) and the fill animates.

  Params:
    int    value    = -1          0..100 determinate; < 0 => indeterminate.
    String label    = "Progress"  accessible name.
    String cssClass = ""          extra utility classes on the track.

  Usage:
    @@template.progress(value = 42, label = "Uploading")
    @@template.progress()   (no value -> indeterminate)
--%>
@param int value = -1
@param String label = "Progress"
@param String cssClass = ""

!{var indeterminate = value < 0;}
!{var pct = indeterminate ? 0 : Math.min(100, Math.max(0, value));}

<div
  data-slot="progress"
  role="progressbar"
  aria-label="${label}"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow="${indeterminate ? null : String.valueOf(pct)}"
  class="block h-[0.5rem] w-full overflow-hidden rounded-[var(--lv-radius-sm)] bg-[var(--lv-color-surface)] ${cssClass}"
>
  @if(indeterminate)
    <div data-slot="progress-bar" class="h-full w-[40%] animate-[lv-progress-slide_1.2s_ease-in-out_infinite] rounded-[var(--lv-radius-sm)] bg-[var(--lv-color-primary)] motion-reduce:animate-none"></div>
  @else
    <div data-slot="progress-bar" class="h-full rounded-[var(--lv-radius-sm)] bg-[var(--lv-color-primary)] transition-[width]" style="width:${pct}%;"></div>
  @endif
</div>
