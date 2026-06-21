@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui alert partial -- an inline message banner whose severity drives colour + role.

  TIER: STATIC presentational -> JTE partial. The former <lv-alert> island held no client
  state; severity-to-colour and severity-to-role are both pure functions of the variant, so
  the server renders the whole thing.

  STRUCTURE (scientific decision rule): WAI-ARIA alert / status pattern. shadcn renders a
  bordered tinted panel keyed on variant; the live-region ROLE is the load-bearing decision
  and is taken from the APG: time-sensitive errors (danger / warning) are assertive
  (role="alert"), informational kinds (info / success) are polite (role="status"), so a
  screen reader interrupts only for the urgent kinds. The tint uses color-mix over the
  severity token so one token drives border + background coherently.

  A11y (WAI-ARIA alert/status): danger|warning => role="alert" (assertive); info|success =>
  role="status" (polite). An optional heading is rendered first; the message is the content slot.

  Params:
    String variant         = "info"   "info" | "success" | "warning" | "danger".
    String heading         = null     optional bold heading rendered above the message.
    gg.jte.Content content            the message body.
    String cssClass        = ""       extra utility classes on the banner.

  Usage:
    @@template.lievit.alert(variant = "danger", content = @@`Could not save the listing.`)
    @@template.lievit.alert(variant = "success", heading = "Saved", content = @@`Your changes are live.`)
--%>
@param String variant = "info"
@param String heading = null
@param gg.jte.Content content
@param String cssClass = ""

!{var urgent = "danger".equals(variant) || "warning".equals(variant);}
!{var tone = switch (variant) {
    case "success" -> "var(--lv-color-success)";
    case "warning" -> "var(--lv-color-warning)";
    case "danger"  -> "var(--lv-color-danger)";
    default        -> "var(--lv-color-info)";
  };}

<div
  data-slot="alert"
  data-variant="${variant}"
  role="${urgent ? "alert" : "status"}"
  class="block rounded-[var(--lv-radius-md)] border px-[var(--lv-space-4)] py-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-fg)] ${cssClass}"
  style="font-family:var(--lv-font-sans);border-color:${tone};background:color-mix(in srgb, ${tone} 12%, var(--lv-color-bg));"
>
  @if(heading != null && !heading.isBlank())
    <div data-slot="alert-heading" class="mb-[var(--lv-space-1)] font-[var(--lv-font-semibold)]">${heading}</div>
  @endif
  ${content}
</div>
