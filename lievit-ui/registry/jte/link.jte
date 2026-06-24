@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui link partial (v-next) -- a standalone styled anchor (navigation affordance,
  distinct from the button's action affordance).

  TIER: STATIC presentational -> JTE partial (ADR-0012 server-first pivot). A link carries
  no client state: it is a plain <a> the browser navigates. CSP-clean, zero JS.

  STRUCTURE: always renders <a>. When disabled, href is null-dropped via a JTE smart
  attribute so the anchor stays in the DOM (for aria-disabled) but has no navigation target.
  An external link adds target/_blank + rel/noopener + a sr-only hint and a trailing Unicode
  glyph. The external icon is an inline Unicode character (no dependency on the icon partial).

  VARIANT (v-next vocabulary -- BREAKING from v0.x):
    default     primary-coloured text, underlines on hover (shadcn "link" affordance).
    muted       muted-fg text, underlines on hover.
    destructive destructive-coloured text, underlines on hover.
    ghost       full fg text, underlines on hover (the transparent link).
  Old `muted` hover-to-fg-darkening replaced with uniform underline-on-hover.

  SIZE (v-next, new param -- not in v0.x):
    inherit  no font-size class (inherits the surrounding typographic context). Default.
    sm       text-xs
    md       text-sm
    lg       text-base

  DISABLED (v-next, new param -- not in v0.x):
    href is dropped, aria-disabled="true" is set, opacity-50 + cursor-not-allowed added.

  EXTERNAL LINK (replaces `newTab` from v0.x):
    external = true sets target=_blank + rel=noopener noreferrer, a sr-only "(opens in new
    tab)" hint inside the <a>, and a trailing Unicode glyph. No dependency on the icon
    partial (hard rule 5).

  EXTRA ATTRIBUTES -- two channels, by trust:
    attrs     (TRUSTED, raw $unsafe) -- STATIC author-typed strings only.
    dataAttrs (SAFE, escaped)        -- Map<String,String> of dynamic data-*, each value
                                       escaped via Escape.htmlAttribute.

  A11y: a real focusable <a> with platform anchor semantics. focus-visible ring via
  --lv-ring. aria-disabled when disabled. The external glyph is aria-hidden (decorative);
  the sr-only text provides the screen-reader hint.

  Params:
    gg.jte.Content content            REQUIRED: the link's visible label.
    String href                       REQUIRED: the link target.
    String variant   = "default"     "default" | "muted" | "destructive" | "ghost".
    String size      = "inherit"     "sm" | "md" | "lg" | "inherit".
    boolean external = false          target=_blank + rel + sr-only + trailing glyph.
    boolean disabled = false          aria-disabled + no href + dims visually.
    String download  = null          adds download="${download}" (omitted when null).
    String ariaLabel = null          aria-label on the <a> (omitted when null).
    String cssClass  = ""            extra utility classes.
    String attrs     = ""            TRUSTED raw ($unsafe) -- STATIC strings only.
    Map<String,String> dataAttrs = {} SAFE dynamic data-* (Escape.htmlAttribute on each value).

  Usage:
    @@template.lievit.link(href = "/attivita", content = @@`Vedi tutti`)
    @@template.lievit.link(href = "/export", variant = "muted", content = @@`Esporta`)
    @@template.lievit.link(href = "https://docs", external = true, content = @@`Documentazione`)
    @@template.lievit.link(href = "/report.pdf", download = "report.pdf", content = @@`Scarica`)
    @@template.lievit.link(href = "/annulla", variant = "ghost", disabled = true, content = @@`Annulla`)
    @@template.lievit.link(href = "/elimina", variant = "destructive", content = @@`Elimina account`)
--%>
@param gg.jte.Content content
@param String href
@param String variant = "default"
@param String size = "inherit"
@param boolean external = false
@param boolean disabled = false
@param String download = null
@param String ariaLabel = null
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

!{var variantClass = switch (variant) {
    case "muted"       -> "text-[var(--lv-color-muted-fg)] hover:underline hover:underline-offset-4";
    case "destructive" -> "text-[var(--lv-color-destructive)] hover:underline hover:underline-offset-4";
    case "ghost"       -> "text-[var(--lv-color-fg)] hover:underline hover:underline-offset-4";
    default            -> "text-[var(--lv-color-primary)] hover:underline hover:underline-offset-4 focus-visible:underline focus-visible:underline-offset-4";
  };}
!{var sizeClass = switch (size) {
    case "sm" -> "text-[length:var(--lv-text-xs)] font-[var(--lv-font-sans)]";
    case "md" -> "text-[length:var(--lv-text-sm)] font-[var(--lv-font-sans)]";
    case "lg" -> "text-[length:var(--lv-text-base)] font-[var(--lv-font-sans)]";
    default   -> "";
  };}
!{var disabledClass = disabled ? " opacity-50 cursor-not-allowed" : "";}
!{var base = "inline-flex items-center gap-[var(--lv-space-1)] underline-offset-4 outline-none transition-colors focus-visible:shadow-[var(--lv-ring)]";}
!{var fullClass = (base + " " + variantClass + (sizeClass.isEmpty() ? "" : " " + sizeClass) + disabledClass + " " + cssClass).strip();}

<%-- SAFE dynamic data-* attributes: each value escaped via Escape.htmlAttribute. --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<a
  data-slot="link"
  data-variant="${variant}"
  data-size="${size}"
  href="${disabled ? null : href}"
  target="${external ? "_blank" : null}"
  rel="${external ? "noopener noreferrer" : null}"
  download="${download}"
  aria-label="${ariaLabel}"
  aria-disabled="${disabled ? "true" : null}"
  class="${fullClass}"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>${content}@if(external)<span class="sr-only">(opens in new tab)</span><span aria-hidden="true" class="inline-block align-middle text-[length:0.75em]">↗</span>@endif</a>
