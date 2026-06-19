@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui button partial -- a token-styled button (or link styled as a button).

  TIER: STATIC presentational -> JTE partial. The former <lv-button> island only styled a
  native <button>; it held no state. Crucially the CLICK is NOT the partial's concern: the
  consuming wire template wires the action via l:click on the element (l:click="save"), or a
  plain form submit / <a href> drives navigation. The partial renders only the styled control.

  STRUCTURE (scientific decision rule): a real native <button> (or <a> when href is given),
  which carries the button role, Enter/Space activation and disabled semantics for free
  (WAI-ARIA APG button), so no manual ARIA is needed -- exactly shadcn's Button, whose only
  job is the cva variant styling. Rendering an <a> when href is set keeps a navigational
  action a real link (right-click, middle-click, copy-URL all work) instead of a JS-only button.

  A11y (WAI-ARIA button): native <button> => role + keyboard + disabled for free; <a href> =>
  a real link. focus-visible ring via the --lv-ring token. A disabled link drops href and gets
  aria-disabled (an <a> cannot be natively disabled).

  Params:
    String  variant  = "primary"   "primary" | "ghost" | "danger".
    String  type     = "button"    "button" | "submit" | "reset" (ignored when href is set).
    String  href     = null        when set, render an <a href> styled as a button.
    boolean disabled = false        dims + blocks activation.
    String  cssClass = ""          extra utility classes (e.g. an l:click is added by the caller).
    gg.jte.Content content          the button label / icon + label.

  Usage: the consuming wire template wires the action via l:click on the rendered element.
    @@template.button(variant = "primary", cssClass = "...", content = @@`Save`)
    @@template.button(href = "/listings", variant = "ghost", content = @@`Back`)
--%>
@param String variant = "primary"
@param String type = "button"
@param String href = null
@param boolean disabled = false
@param String cssClass = ""
@param gg.jte.Content content

!{var variantClass = switch (variant) {
    case "ghost"  -> "bg-transparent text-[var(--lv-color-fg)] border-[var(--lv-color-border)]";
    case "danger" -> "bg-[var(--lv-color-danger)] text-[var(--lv-color-danger-fg)]";
    default       -> "bg-[var(--lv-color-primary)] text-[var(--lv-color-primary-fg)]";
  };}
!{var base = "inline-flex items-center justify-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] border border-transparent px-[var(--lv-space-4)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] cursor-pointer outline-none focus-visible:shadow-[var(--lv-ring)] disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:cursor-not-allowed";}

@if(href != null)
  <a
    data-slot="button"
    data-variant="${variant}"
    href="${disabled ? null : href}"
    aria-disabled="${disabled ? "true" : null}"
    class="${base} ${variantClass} ${cssClass}"
    style="font-family:var(--lv-font-sans);"
  >${content}</a>
@else
  <button
    data-slot="button"
    data-variant="${variant}"
    type="${type}"
    disabled="${disabled}"
    class="${base} ${variantClass} ${cssClass}"
    style="font-family:var(--lv-font-sans);"
  >${content}</button>
@endif
