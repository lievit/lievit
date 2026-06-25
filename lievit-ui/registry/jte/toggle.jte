@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui toggle partial -- a real <button aria-pressed> (WAI-ARIA APG Toggle Button pattern).

  TIER: PARTIAL presentational. The pressed state is a server fact (data down): the controller
  renders `pressed`, the click is wired by the consuming WIRE template via wireClick / attrs.
  The morph patches aria-pressed on re-render; CSS [aria-pressed="true"] drives the visual
  automatically.

  STIMULUS (controlled/uncontrolled doctrine): the button mounts data-controller="lv-toggle"
  with data-action="click->lv-toggle#toggle" (CSP-clean strings, no inline handler). CONTROLLED =
  a non-blank wireClick emits l:click; the runtime rides the click to the wire, the server flips
  `pressed`, the morph reconciles aria-pressed -- the controller defers (no-op, no second call).
  UNCONTROLLED = no wireClick / no l:click: the controller flips aria-pressed + data-pressed purely
  client-side with ZERO wire round-trip. See runtime/stimulus/controllers/lv-toggle-controller.ts.

  STRUCTURE (scientific decision rule): a real native <button> with aria-pressed is the WAI-ARIA
  APG Button Toggle Button variant (https://www.w3.org/WAI/ARIA/apg/patterns/button/).
  The native button gives role + Enter/Space activation + Tab focus + disabled semantics for free.
  Ant Design Button group / Segmented as inventory reference (sizes, variants, icon-only, disabled).
  Styling inspired by Tailwind UI toggle look over --lv-* tokens; original generation, no copy.

  A11y (WAI-ARIA APG Button -- Toggle Button):
    Element: real <button type="button"> -- native role=button, keyboard, disabled for free.
    State: aria-pressed="true|false" reflects current pressed state; CSS [aria-pressed="true"]
    drives the visual fill/text -- no JS, no class mutation, purely declarative.
    Label stability (APG rule): the visible label MUST NOT change between pressed/unpressed states.
    State is communicated by aria-pressed, not label text. Assert in tests.
    Icon-only: ariaLabel REQUIRED when iconOnly=true (no visible text = no accessible name; axe
    accessible-name rule fires without it). Icon is decorative (aria-hidden via icon partial default).
    aria-describedby: optional external description element id.
    aria-busy: set by the lievit runtime beforeCall/afterCall during a wire round-trip (runtime-managed).
    disabled: native disabled attr (removes from tab order + blocks activation).
    Focus: platform. focus-visible ring via --lv-ring token. No trap, no roving.
    No live region (aria-pressed announces state change to AT directly).

  WIRE / ESCAPING (the XSS decision rule, verbatim from button.jte):
    wireClick (SAFE): the wire action name, emitted as l:click="${wireClick}" when non-blank.
    wireArgs (SAFE): per-item args, each emitted as data-<key>="<escaped-value>". A DB-derived
    value goes through wireArgs, NEVER attrs.
    attrs (TRUSTED, raw): $unsafe, STATIC author-typed strings ONLY. Never user/DB data.
    dataAttrs (SAFE, escaped): Map of dynamic data-* (values via Escape.htmlAttribute).

  Params:
    boolean pressed          = false    current pressed state; drives aria-pressed.
    String  variant          = "outline" "outline" | "ghost" | "primary" | "secondary".
    String  size             = "md"     "sm" | "md" | "lg" -- height-based, toolbar-aligned.
    boolean iconOnly         = false    square icon-only control; ariaLabel REQUIRED when true.
    boolean disabled         = false    dims + blocks activation; native disabled on the button.
    String  ariaLabel        = null     aria-label; REQUIRED when iconOnly=true.
    String  ariaDescribedBy  = null     aria-describedby pointing to an external description id.
    String  cssClass         = ""       extra utility classes on the root button.
    String  attrs            = ""       TRUSTED raw ($unsafe) -- STATIC author-typed strings only.
    java.util.Map<String, String> dataAttrs = java.util.Map.of()  SAFE dynamic data-* (escaped).
    String  wireClick        = null     SAFE wire action name; emitted as l:click="${wireClick}".
    java.util.Map<String, String> wireArgs = java.util.Map.of()  SAFE per-item args merged into data-*.
    gg.jte.Content content              the label / icon+label / single icon when iconOnly.
    gg.jte.Content leading   = null     optional icon before the label.
    gg.jte.Content trailing  = null     optional icon/badge after the label.

  Usage:
    @@template.lievit.toggle(pressed = item.starred(), ariaLabel = "Preferito",
      wireClick = "toggleStar", wireArgs = java.util.Map.of("id", item.id()),
      content = @@`Preferito`)
    @@template.lievit.toggle(variant = "outline", pressed = isBold,
      wireClick = "toggleBold", content = @@`Grassetto`)
    @@template.lievit.toggle(variant = "ghost", iconOnly = true, ariaLabel = "Bold",
      pressed = isBold, wireClick = "toggleBold",
      content = @@`@@template.lievit.icon(name = "bold", size = "1rem")`)
--%>
@param boolean pressed = false
@param String variant = "outline"
@param String size = "md"
@param boolean iconOnly = false
@param boolean disabled = false
@param String ariaLabel = null
@param String ariaDescribedBy = null
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param String wireClick = null
@param java.util.Map<String, String> wireArgs = java.util.Map.of()
@param gg.jte.Content content
@param gg.jte.Content leading = null
@param gg.jte.Content trailing = null

!{var sizeClass = switch (size) {
    case "sm" -> iconOnly
        ? "h-[var(--lv-space-8)] w-[var(--lv-space-8)] p-0"
        : "h-[var(--lv-space-8)] px-[var(--lv-space-3)] text-[length:var(--lv-text-xs)]";
    case "lg" -> iconOnly
        ? "h-[var(--lv-space-10)] w-[var(--lv-space-10)] p-0"
        : "h-[var(--lv-space-10)] px-[var(--lv-space-5)] text-[length:var(--lv-text-base)]";
    default -> iconOnly
        ? "h-[var(--lv-space-9)] w-[var(--lv-space-9)] p-0"
        : "h-[var(--lv-space-9)] px-[var(--lv-space-4)] text-[length:var(--lv-text-sm)]";
  };}
!{var variantClass = switch (variant) {
    case "ghost"     -> "bg-transparent border-transparent text-[var(--lv-color-fg)] hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] aria-[pressed=true]:bg-[var(--lv-color-accent)] aria-[pressed=true]:text-[var(--lv-color-accent-fg)] aria-[pressed=true]:border-transparent";
    case "primary"   -> "bg-[var(--lv-color-primary)] border-[var(--lv-color-primary)] text-[var(--lv-color-primary-fg)] hover:brightness-90 aria-[pressed=true]:brightness-90";
    case "secondary" -> "bg-[var(--lv-color-secondary)] border-[var(--lv-color-secondary)] text-[var(--lv-color-secondary-fg)] hover:brightness-95 aria-[pressed=true]:bg-[var(--lv-color-accent)] aria-[pressed=true]:text-[var(--lv-color-accent-fg)] aria-[pressed=true]:border-[var(--lv-color-accent)]";
    default          -> "bg-[var(--lv-color-bg)] border-[var(--lv-color-border)] text-[var(--lv-color-fg)] hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] aria-[pressed=true]:bg-[var(--lv-color-accent)] aria-[pressed=true]:text-[var(--lv-color-accent-fg)] aria-[pressed=true]:border-[var(--lv-color-accent)]";
  };}
!{var dataAttrsMerged = new java.util.LinkedHashMap<String, String>();}
!{dataAttrsMerged.putAll(dataAttrs);}
!{dataAttrsMerged.putAll(wireArgs);}
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrsMerged.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<button
  type="button"
  data-slot="toggle"
  data-controller="lv-toggle"
  data-action="click->lv-toggle#toggle"
  data-variant="${variant}"
  data-size="${size}"
  data-pressed="${pressed ? "true" : "false"}"
  aria-pressed="${pressed ? "true" : "false"}"
  aria-label="${ariaLabel}"
  aria-describedby="${ariaDescribedBy}"
  disabled="${disabled}"
  l:click="${(wireClick != null && !wireClick.isBlank()) ? wireClick : null}"
  class="inline-flex items-center justify-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] border font-[var(--lv-font-medium)] outline-none transition-[color,background-color,box-shadow] focus-visible:shadow-[var(--lv-ring)] disabled:pointer-events-none disabled:opacity-50 ${variantClass} ${sizeClass} ${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>@if(leading != null)${leading}@endif${content}@if(trailing != null)${trailing}@endif</button>
