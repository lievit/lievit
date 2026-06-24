<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui toast/region partial -- the live-region stack container. Render ONCE in the page
  layout immediately before </body>, outside any aria-modal surface.

  TIER: PARTIAL. Zero client state: the two sub-containers are always present in the DOM
  (the live-region pre-existence invariant -- a dynamically-created live region is unreliable
  across AT; the containers MUST exist before any toast fires).

  STRUCTURE (scientific decision rule):
    - WAI-ARIA: two sub-containers, one role="status" aria-live="polite" (info/success) and
      one role="alert" aria-live="assertive" (warning/destructive). aria-atomic="false" so
      each inserted child is announced individually, not the full container.
    - The enhancer (toast.enhancer.ts) inserts toast-item.jte fragments into the correct
      sub-container based on data-variant. This partial only provides the structural seam.
    - placement maps to CSS fixed positioning utilities.

  A11y (WAI-ARIA live region):
    - role="status" aria-live="polite" aria-atomic="false": info + success toasts.
      AT announces when the user is idle. Appropriate for non-urgent confirmations.
    - role="alert" aria-live="assertive" aria-atomic="false": warning + destructive toasts.
      AT interrupts immediately. Appropriate for errors requiring immediate attention.
    - aria-relevant="additions" (the default for live regions) is left implicit.
    - Both sub-containers are rendered at page load; never created dynamically.

  Params:
    String placement     = "bottom-end"  "top-start" | "top-center" | "top-end" |
                                         "bottom-start" | "bottom-center" | "bottom-end".
    int maxVisible       = 5             Max items shown simultaneously (read by enhancer).
    String sseUrl        = null          If set, enhancer opens an EventSource on this URL.
    String bellId        = null          If set, enhancer increments the bell badge counter.
    String attrs         = ""            TRUSTED raw ($unsafe) -- STATIC author-typed only.

  Usage:
    @@template.lievit.toast.region()
    @@template.lievit.toast.region(placement = "top-end", maxVisible = 3)
--%>
@param String placement = "bottom-end"
@param int maxVisible = 5
@param String sseUrl = null
@param String bellId = null
@param String attrs = ""

!{var posStyle = switch (placement) {
    case "top-start"    -> "top:var(--lv-space-4);left:var(--lv-space-4);align-items:flex-start;";
    case "top-center"   -> "top:var(--lv-space-4);left:50%;transform:translateX(-50%);align-items:center;";
    case "top-end"      -> "top:var(--lv-space-4);right:var(--lv-space-4);align-items:flex-end;";
    case "bottom-start" -> "bottom:var(--lv-space-4);left:var(--lv-space-4);align-items:flex-start;";
    case "bottom-center"-> "bottom:var(--lv-space-4);left:50%;transform:translateX(-50%);align-items:center;";
    default             -> "bottom:var(--lv-space-4);right:var(--lv-space-4);align-items:flex-end;";
  };}
!{var flexDir = placement.startsWith("bottom") ? "column-reverse" : "column";}

<div
  data-slot="toast-region"
  data-toast-placement="${placement}"
  data-toast-max-visible="${maxVisible}"
  data-toast-sse-url="${sseUrl}"
  data-toast-bell-id="${bellId}"
  style="position:fixed;z-index:var(--lv-z-toast,1500);display:flex;flex-direction:${flexDir};gap:var(--lv-space-2);pointer-events:none;${posStyle}"
  $unsafe{attrs}
>
  <div
    role="status"
    aria-live="polite"
    aria-atomic="false"
    data-slot="toast-live-polite"
    style="display:contents;"
  ></div>
  <div
    role="alert"
    aria-live="assertive"
    aria-atomic="false"
    data-slot="toast-live-assertive"
    style="display:contents;"
  ></div>
</div>
