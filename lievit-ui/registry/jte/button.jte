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

  SIZE (Filament parity, the toolbar-alignment decision). The button is HEIGHT-based, not
  padding-based, so it sits flush next to the form controls in a toolbar row. Each size pins the
  SAME height token the form controls use, so a button lines up pixel-exact with an input /
  native-select of the matching size:
    sm  -> height token [var(--lv-space-8)]  (2rem)   == native-select size="sm"      ; compact toolbar
    md  -> height token [var(--lv-space-10)] (2.5rem) == input + native-select default ; THE default, the row baseline
    lg  -> height token [var(--lv-space-12)] (3rem)   == native-select size="lg"      ; prominent CTA
  Horizontal padding + text size scale with the height; the gap-[var(--lv-space-2)] spaces an
  icon from its label. md matches `@template.input` and `@template.native-select` (default) so a
  toolbar of [input][native-select][button] aligns with no per-call height hacks (the bug this
  fixes: adopters hand-rolling fixed-height buttons with ad-hoc padding that never lined up with
  the inputs).

  ICON-ONLY (toolbar icon actions + per-row action icons). Set iconOnly=true to render a SQUARE
  icon-only control: width == height for the chosen size (h/w = the same --lv-space token), zero
  horizontal padding, the content is a single @template.icon(...). It is the SAME real
  <button>/<a> element, so role/keyboard/disabled/focus-ring are unchanged. Because there is no
  visible text label, ariaLabel is REQUIRED for the accessible name (WAI-ARIA): an icon-only
  control with no name is unusable to assistive tech, so it is a first-class param here.

  A11y (WAI-ARIA button): native <button> => role + keyboard + disabled for free; <a href> =>
  a real link. focus-visible ring via the --lv-ring token. A disabled link drops href and gets
  aria-disabled (an <a> cannot be natively disabled). ariaLabel sets aria-label (mandatory for
  iconOnly, optional otherwise).

  Params:
    String  variant  = "primary"   "primary" | "secondary" | "danger" | "ghost" | "outline".
    String  size     = "md"        "sm" | "md" | "lg" (height-based, aligns to the form controls).
    boolean iconOnly = false        square icon-only button; content is a single @@template.icon.
    String  type     = "button"    "button" | "submit" | "reset" (ignored when href is set).
    String  href     = null        when set, render an <a href> styled as a button.
    boolean disabled = false        dims + blocks activation.
    String  ariaLabel = null       aria-label; REQUIRED when iconOnly is true.
    String  cssClass = ""          extra utility classes (e.g. an l:click is added by the caller).
    gg.jte.Content content          the button label / icon + label (a single icon when iconOnly).

  Usage: the consuming wire template wires the action via l:click on the rendered element.
    @@template.button(variant = "primary", cssClass = "...", content = @@`Save`)
    @@template.button(size = "sm", variant = "secondary", content = @@`Filter`)
    @@template.button(href = "/listings", variant = "ghost", content = @@`Back`)
    @@template.button(iconOnly = true, size = "sm", variant = "ghost", ariaLabel = "Open calendar",
        content = @@`@@template.icon(name = "calendar", size = "1rem")`)
--%>
@param String variant = "primary"
@param String size = "md"
@param boolean iconOnly = false
@param String type = "button"
@param String href = null
@param boolean disabled = false
@param String ariaLabel = null
@param String cssClass = ""
@param gg.jte.Content content

!{var variantClass = switch (variant) {
    case "secondary" -> "bg-[var(--lv-color-secondary)] text-[var(--lv-color-secondary-fg)]";
    case "danger"    -> "bg-[var(--lv-color-danger)] text-[var(--lv-color-danger-fg)]";
    case "ghost"     -> "bg-transparent text-[var(--lv-color-fg)] border-transparent";
    case "outline"   -> "bg-transparent text-[var(--lv-color-fg)] border-[var(--lv-color-border)]";
    default          -> "bg-[var(--lv-color-primary)] text-[var(--lv-color-primary-fg)]";
  };}

<%-- height + text-size per size; horizontal padding is added separately so iconOnly can drop it for a square --%>
!{var sizeClass = switch (size) {
    case "sm" -> "h-[var(--lv-space-8)] text-[length:var(--lv-text-xs)]";
    case "lg" -> "h-[var(--lv-space-12)] text-[length:var(--lv-text-base)]";
    default   -> "h-[var(--lv-space-10)] text-[length:var(--lv-text-sm)]";
  };}
<%-- square (w == h) + no horizontal padding for the icon-only control; otherwise size-scaled px --%>
!{var shapeClass = iconOnly
    ? (switch (size) {
        case "sm" -> "w-[var(--lv-space-8)] p-0";
        case "lg" -> "w-[var(--lv-space-12)] p-0";
        default   -> "w-[var(--lv-space-10)] p-0";
      })
    : (switch (size) {
        case "sm" -> "px-[var(--lv-space-3)]";
        case "lg" -> "px-[var(--lv-space-6)]";
        default   -> "px-[var(--lv-space-4)]";
      });}

!{var base = "inline-flex items-center justify-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] border border-transparent leading-[var(--lv-leading)] cursor-pointer outline-none focus-visible:shadow-[var(--lv-ring)] disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:cursor-not-allowed";}

@if(href != null)
  <a
    data-slot="button"
    data-variant="${variant}"
    data-size="${size}"
    data-icon-only="${iconOnly}"
    href="${disabled ? null : href}"
    aria-disabled="${disabled ? "true" : null}"
    aria-label="${ariaLabel}"
    class="${base} ${sizeClass} ${shapeClass} ${variantClass} ${cssClass}"
    style="font-family:var(--lv-font-sans);"
  >${content}</a>
@else
  <button
    data-slot="button"
    data-variant="${variant}"
    data-size="${size}"
    data-icon-only="${iconOnly}"
    type="${type}"
    disabled="${disabled}"
    aria-label="${ariaLabel}"
    class="${base} ${sizeClass} ${shapeClass} ${variantClass} ${cssClass}"
    style="font-family:var(--lv-font-sans);"
  >${content}</button>
@endif
