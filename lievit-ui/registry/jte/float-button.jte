@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui float-button partial -- a floating action button / FAB (Ant FloatButton parity).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012). Zero client state; it is a real
  <button>/<a>. Behaviour (wire action, navigation) rides the existing channels. Zero JS, CSP-clean.

  STRUCTURE (scientific decision rule):
    Ant's FloatButton is a fixed circular action affordance pinned to a screen corner. Server-first
    polymorphism (the badge pattern): a non-blank href renders a real <a> (navigation, middle-click,
    open-in-new-tab) while a blank href renders a <button> (a wire action is wired via `attrs`, e.g.
    a lievit @click directive). The glyph reuses the lievit icon primitive. `floating=true` (default)
    pins it to a corner via a fixed-position inset (chosen by `position`); inside a float-button.group
    the buttons set floating=false and the GROUP owns the fixed positioning + stacking.
    Inventory reference: Ant Design FloatButton (type, shape, position, badge). Original generation
    over --lv-* tokens; no Ant code copied.

  A11y: a real <button>/<a> (platform role, Tab, Enter/Space). The visible content is usually an
    icon, so an accessible name is REQUIRED -- `label` becomes aria-label (and the optional visible
    tooltip). The badge is aria-hidden when purely decorative; pass an accessible count separately.

  Params:
    String icon      = null             lucide icon name for the glyph (via the icon primitive).
    gg.jte.Content content              optional custom inner content (overrides icon).
    String label     = null             accessible name (aria-label) -- REQUIRED for an icon-only FAB.
    String href      = null             non-blank => render as <a href>, else a <button type=button>.
    String type      = "default"        "primary" (filled accent) | "default" (surface).
    String shape     = "circle"         "circle" | "square".
    String position  = "bottom-right"   corner when floating: bottom-right|bottom-left|top-right|top-left.
    boolean floating = true             pin to a fixed corner; false when nested in float-button.group.
    gg.jte.Content badge                optional small badge slot (count / dot) on the top-right.
    String cssClass  = ""               extra utility classes on the button.
    String attrs     = ""               TRUSTED raw ($unsafe) -- STATIC author-typed strings only
                                        (e.g. a lievit wire @click directive on the button).

  Usage:
    @@template.lievit.float-button(icon = "plus", label = "New", type = "primary",
        attrs = "data-lievit-click=\"create\"")
    @@template.lievit.float-button(icon = "house", label = "Home", href = "/")
--%>
@param String icon = null
@param gg.jte.Content content = null
@param String label = null
@param String href = null
@param String type = "default"
@param String shape = "circle"
@param String position = "bottom-right"
@param boolean floating = true
@param gg.jte.Content badge = null
@param String cssClass = ""
@param String attrs = ""

!{var isLink = href != null && !href.isBlank();}
!{var isPrimary = "primary".equals(type);}
!{var radiusClass = "square".equals(shape) ? "rounded-[var(--lv-radius-lg)]" : "rounded-full";}
!{var surface = isPrimary
    ? "background:var(--lv-color-primary);color:var(--lv-color-primary-fg);"
    : "background:var(--lv-color-popover);color:var(--lv-color-popover-fg);border:1px solid var(--lv-color-border);";}
<%-- fixed-corner inset only when floating; nested-in-group buttons are static. --%>
!{var posStyle = !floating ? "" : switch (position) {
    case "bottom-left" -> "position:fixed;left:var(--lv-space-6);bottom:var(--lv-space-6);z-index:50;";
    case "top-right"   -> "position:fixed;right:var(--lv-space-6);top:var(--lv-space-6);z-index:50;";
    case "top-left"    -> "position:fixed;left:var(--lv-space-6);top:var(--lv-space-6);z-index:50;";
    default            -> "position:fixed;right:var(--lv-space-6);bottom:var(--lv-space-6);z-index:50;";
  };}
!{var btnClass = "relative inline-flex h-[var(--lv-space-12)] w-[var(--lv-space-12)] items-center justify-center " + radiusClass + " no-underline transition-[box-shadow,transform] hover:shadow-[var(--lv-shadow-lg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] " + cssClass;}
!{var btnStyle = "font-family:var(--lv-font-sans);box-shadow:var(--lv-shadow-md);" + surface + posStyle;}

@if(isLink)
<a
  href="${href}"
  data-slot="float-button"
  data-type="${type}"
  aria-label="${label}"
  title="${label}"
  class="${btnClass}"
  style="${btnStyle}"
  $unsafe{attrs}
>@if(content != null)${content}@elseif(icon != null)@template.lievit.icon(name = icon, size = "1.25rem")@endif@if(badge != null)<span data-slot="float-button-badge" aria-hidden="true" class="absolute -top-[var(--lv-space-1)] -right-[var(--lv-space-1)]">${badge}</span>@endif</a>
@else
<button
  type="button"
  data-slot="float-button"
  data-type="${type}"
  aria-label="${label}"
  title="${label}"
  class="${btnClass} cursor-pointer"
  style="${btnStyle}"
  $unsafe{attrs}
>@if(content != null)${content}@elseif(icon != null)@template.lievit.icon(name = icon, size = "1.25rem")@endif@if(badge != null)<span data-slot="float-button-badge" aria-hidden="true" class="absolute -top-[var(--lv-space-1)] -right-[var(--lv-space-1)]">${badge}</span>@endif</button>
@endif
