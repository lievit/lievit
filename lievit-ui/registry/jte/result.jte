@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui result partial -- a status / result page (Ant Design Result parity).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012). Zero client state; the server renders a
  centred status block (icon + title + subtitle + action slot). Zero JS, zero enhancer, CSP-clean.

  STRUCTURE (scientific decision rule):
    Ant's Result is the full-page feedback block for an operation outcome or an HTTP status
    (success / error / info / warning / 403 / 404 / 500). The status drives a glyph + a colour
    intent; the rest is content the caller supplies. The glyph reuses the lievit icon primitive
    (one icon system, no bespoke SVG). `extra` is a content slot for the recovery actions
    (buttons / links). The illustrations are intentionally the token-tinted lucide glyph rather
    than Ant's bespoke artwork (shadcn visual language, not Ant's).
    Inventory reference: Ant Design Result. Original generation over --lv-* tokens; no Ant code copied.

  A11y: the block is a <section> with role="status" + aria-live="polite" so a result rendered into
    a live region (after a wire action) is announced. The glyph is aria-hidden (the title text
    states the outcome; colour is never the sole signal -- WCAG 1.4.1).

  Params:
    String status   = "info"            success|error|info|warning|403|404|500 (glyph + colour).
    String title    = null              the headline (HTML-escaped via ${}).
    String subTitle = null              the secondary explanation line.
    gg.jte.Content extra                optional action slot (buttons / links) under the text.
    gg.jte.Content content              optional extra content (e.g. an error detail list) below extra.
    String cssClass = ""                extra utility classes on the root.
    String attrs    = ""                TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.result(status = "success", title = "Salvato",
        subTitle = "Le modifiche sono state applicate.",
        extra = @@`@@template.lievit.button(label = "Torna alla lista", href = "/list")`)
    @@template.lievit.result(status = "404", title = "Pagina non trovata")
--%>
@param String status = "info"
@param String title = null
@param String subTitle = null
@param gg.jte.Content extra = null
@param gg.jte.Content content = null
@param String cssClass = ""
@param String attrs = ""

!{var iconName = switch (status) {
    case "success" -> "circle-check";
    case "error"   -> "circle-x";
    case "warning" -> "triangle-alert";
    case "403"     -> "lock";
    case "404"     -> "circle-question-mark";
    case "500"     -> "triangle-alert";
    default        -> "info";
  };}
!{var iconColor = switch (status) {
    case "success" -> "var(--lv-color-success)";
    case "error"   -> "var(--lv-color-danger)";
    case "500"     -> "var(--lv-color-danger)";
    case "warning" -> "var(--lv-color-warning)";
    case "403"     -> "var(--lv-color-warning)";
    case "404"     -> "var(--lv-color-muted-fg)";
    default        -> "var(--lv-color-info)";
  };}

<section
  data-slot="result"
  data-status="${status}"
  role="status"
  aria-live="polite"
  class="flex flex-col items-center text-center px-[var(--lv-space-6)] py-[var(--lv-space-12)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{attrs}
>
  <div data-slot="result-icon" aria-hidden="true" class="mb-[var(--lv-space-5)]" style="color:${iconColor};">
    @template.lievit.icon(name = iconName, size = "4rem")
  </div>
  @if(title != null && !title.isBlank())
    <h2 data-slot="result-title" class="m-0 text-[length:var(--lv-text-2xl)] font-[var(--lv-font-semibold)] leading-[var(--lv-leading-tight)]" style="color:var(--lv-color-fg);">${title}</h2>
  @endif
  @if(subTitle != null && !subTitle.isBlank())
    <p data-slot="result-subtitle" class="mt-[var(--lv-space-2)] mb-0 text-[length:var(--lv-text-base)] leading-[var(--lv-leading-relaxed)]" style="color:var(--lv-color-muted-fg);">${subTitle}</p>
  @endif
  @if(extra != null)
    <div data-slot="result-extra" class="mt-[var(--lv-space-6)] flex flex-wrap items-center justify-center gap-[var(--lv-space-3)]">${extra}</div>
  @endif
  @if(content != null)
    <div data-slot="result-content" class="mt-[var(--lv-space-6)] w-full text-left">${content}</div>
  @endif
</section>
