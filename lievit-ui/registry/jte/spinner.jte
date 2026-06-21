<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui spinner partial -- a busy indicator (CSS-animated ring).

  TIER: STATIC presentational -> JTE partial. The former <lv-spinner> island only spun a
  bordered ring with CSS; the animation is pure CSS and carries no client state.

  STRUCTURE (scientific decision rule): a CSS border-spinner (shadcn/MUI both ship the same
  rotating-ring primitive). The rotation is a single @keyframes on a Tailwind animate utility;
  no SVG, no JS. The reduced-motion guard is expressed with motion-reduce:animate-none so the
  whole thing stays in the markup layer.

  A11y (WAI-ARIA status): role="status" + an accessible label via aria-label, so assistive
  tech announces the busy state without seeing the animation. Decorative-only ring uses
  aria-hidden via the surrounding text.

  Params:
    String size     = "sm"        "sm" (16px, shadcn default) | "md" (24px) -- ring diameter via tokens.
    String label    = "Loading"   accessible name announced by assistive tech.
    String cssClass = ""          extra utility classes on the spinner.

  Usage:
    @@template.lievit.spinner()
    @@template.lievit.spinner(size = "md", label = "Saving")
--%>
@param String size = "sm"
@param String label = "Loading"
@param String cssClass = ""

!{var sizeClass = "md".equals(size) ? "size-[1.5rem]" : "size-[1rem]";}

<span
  data-slot="spinner"
  data-size="${size}"
  role="status"
  aria-label="${label}"
  class="inline-block animate-spin rounded-[var(--lv-radius-full)] border-2 border-[var(--lv-color-border)] border-t-[var(--lv-color-primary)] motion-reduce:animate-none ${sizeClass} ${cssClass}"
></span>
