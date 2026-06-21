@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui alert partial -- an inline message banner whose severity drives colour + role, laid
  out as the shadcn icon + GRID composition.

  TIER: STATIC presentational -> JTE partial. The former <lv-alert> island held no client
  state; severity-to-colour and severity-to-role are both pure functions of the variant, so
  the server renders the whole thing.

  STRUCTURE (scientific decision rule): WAI-ARIA alert / status pattern, shadcn new-york-v4 layout.
  shadcn's Alert is a CSS GRID with an optional leading SVG: grid-cols-[0_1fr] with no icon, and
  grid-cols-[1rem_1fr] + a column gap WHEN an icon is present, so the title + description always
  sit in column 2 (col-start-2) aligned past the icon. The live-region ROLE is the load-bearing
  decision and is taken from the APG: time-sensitive errors (destructive / warning) are assertive
  (role="alert"), informational kinds (info / success) are polite (role="status"), so a screen
  reader interrupts only for the urgent kinds. The tint uses color-mix over the severity token so
  one token drives border + background coherently. The error variant is named "destructive" to
  match shadcn's variant contract.

  SLOTS (shadcn parity): the title + description are now REAL sub-slots (data-slot="alert-title" /
  "alert-description", the alert/title + alert/description partials inlined when passed as `title`
  / `description` Content) instead of the old ad-hoc heading div + raw content; an optional
  `action` slot (data-slot="alert-action") pins a control to the banner's end. Back-compat: the
  `heading` String still renders a plain-text title, and `content` still fills the description
  region when no rich `description` is given.

  CALLOUT (Filament parity): Filament's Callout is a richer alert that adds a FOOTER / CONTROLS
  region below the description -- a place for actions (links/buttons), a collapse control, or
  secondary text -- so the same primitive serves both the bare shadcn alert and gest's repeated
  hand-rolled status_banner (icon + heading + body + a footer row of controls). The optional
  `footer` slot (data-slot="alert-footer") renders that region: full-width in column 2, below the
  description, after any end-pinned `action`. It is purely additive -- an alert with no `footer`
  renders exactly as before, so every existing call site is untouched.

  A11y (WAI-ARIA alert/status): destructive|warning => role="alert" (assertive); info|success =>
  role="status" (polite). The leading icon is decorative (aria-hidden) -- severity is announced by
  the role + the title text, not the glyph.

  Params:
    String variant         = "info"   "info" | "success" | "warning" | "destructive".
    String icon            = ""       optional leading Lucide icon name (the shadcn icon column).
    gg.jte.Content title   = null     rich alert title (data-slot=alert-title); wins over `heading`.
    String heading         = null     plain-text title (back-compat); rendered as alert-title.
    gg.jte.Content description = null  rich description (data-slot=alert-description); wins over content.
    gg.jte.Content action  = null     optional control pinned to the banner end (data-slot=alert-action).
    gg.jte.Content footer  = null     optional footer / controls region below the description
                                      (data-slot=alert-footer); the Filament callout footer slot.
    gg.jte.Content content            the message body (description region) when no `description` slot.
    String cssClass        = ""       extra utility classes on the banner.

  Usage:
    @@template.lievit.alert(variant = "destructive", icon = "circle-alert",
      title = @@`Could not save`, description = @@`The listing was not persisted.`)
    @@template.lievit.alert(variant = "success", heading = "Saved", content = @@`Your changes are live.`)
    @@template.lievit.alert(variant = "warning", icon = "triangle-alert", heading = "Chiave ruotata",
      content = @@`La vecchia chiave non e' piu' valida.`,
      footer = @@`@@template.lievit.link(label = "Aggiorna la configurazione", href = "/settings")`)
--%>
@param String variant = "info"
@param String icon = ""
@param gg.jte.Content title = null
@param String heading = null
@param gg.jte.Content description = null
@param gg.jte.Content action = null
@param gg.jte.Content footer = null
@param gg.jte.Content content
@param String cssClass = ""

!{var urgent = "destructive".equals(variant) || "warning".equals(variant);}
!{var hasIcon = !icon.isEmpty();}
!{var hasTitle = title != null || (heading != null && !heading.isBlank());}
!{var tone = switch (variant) {
    case "success"     -> "var(--lv-color-success)";
    case "warning"     -> "var(--lv-color-warning)";
    case "destructive" -> "var(--lv-color-destructive)";
    default            -> "var(--lv-color-info)";
  };}

<div
  data-slot="alert"
  data-variant="${variant}"
  role="${urgent ? "alert" : "status"}"
  class="relative grid w-full items-start text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-fg)] rounded-[var(--lv-radius-md)] border px-[var(--lv-space-4)] py-[var(--lv-space-3)] ${cssClass}"
  style="font-family:var(--lv-font-sans);border-color:${tone};background:color-mix(in srgb, ${tone} 12%, var(--lv-color-bg));grid-template-columns:${hasIcon ? "1rem 1fr" : "0 1fr"};column-gap:${hasIcon ? "var(--lv-space-3)" : "0"};row-gap:var(--lv-space-1);"
>
  @if(hasIcon)
    <span aria-hidden="true" style="grid-column:1;grid-row:1;display:inline-flex;align-items:center;color:${tone};">@template.lievit.icon(name = icon, size = "1rem")</span>
  @endif
  @if(hasTitle)
    <div data-slot="alert-title" style="grid-column:2;min-height:1rem;font-weight:var(--lv-font-medium);letter-spacing:-0.01em;">@if(title != null)${title}@else${heading}@endif</div>
  @endif
  <div data-slot="alert-description" style="grid-column:2;color:var(--lv-color-muted-fg);">@if(description != null)${description}@else${content}@endif</div>
  @if(action != null)
    <div data-slot="alert-action" style="grid-column:2;margin-top:var(--lv-space-2);">${action}</div>
  @endif
  @if(footer != null)
    <div data-slot="alert-footer" style="grid-column:2;margin-top:var(--lv-space-3);display:flex;flex-wrap:wrap;align-items:center;gap:var(--lv-space-3);color:var(--lv-color-muted-fg);">${footer}</div>
  @endif
</div>
