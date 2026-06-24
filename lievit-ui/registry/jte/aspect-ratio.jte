@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui aspect-ratio partial -- a CSS layout wrapper that constrains its content to a fixed
  width-to-height ratio. Single responsibility: maintain the declared ratio regardless of available
  width. Composable for responsive images, embedded videos, maps, skeleton placeholders, or any
  block content that must not reflow into an unwanted aspect.

  TIER: PARTIAL -- purely presentational CSS layout wrapper. No client state, no enhancer, no wire
  round-trip, no JavaScript. The content defines the accessible semantics; the wrapper is transparent.

  STRUCTURE (scientific decision rule): the CSS `aspect-ratio` property is the correct modern
  mechanism (Baseline in all evergreen browsers since 2022; verified against caniuse.com). The
  legacy padding-top hack (padding-top: 56.25% + absolutely-positioned child) required non-semantic
  markup and extra positioning context -- rejected on ergonomics and readability. shadcn/ui
  AspectRatio consulted as inventory reference (wrapper + ratio mechanism); output is original
  generation over --lv-* tokens (no code copied). Two-element pattern (outer: visual framing --
  border-radius, border, overflow clip at the correct layer; inner: ratio enforcement via
  aspect-ratio + size-full fill) is the idiomatic approach used by every major CSS framework for
  this component: it gives the adopter a clean hook for overflow control without clipping the
  border-radius at the wrong element. A single element with aspect-ratio on it does not allow
  clean overflow:hidden at the frame while keeping the content unclipped.

  A11y: NONE on the wrapper (negative confirmation verified against WAI-ARIA APG patterns index
  at https://www.w3.org/WAI/ARIA/apg/patterns/). This wrapper is semantically transparent: screen
  readers and assistive technologies see through it to the content inside. Adding any role or
  aria-* attribute to the wrapper would interfere with the content's own landmark, role, or name.
  The outer div carries NO role, NO aria-*. The inner div carries NO role, NO aria-*.
  Accessible semantics belong entirely to the content:
    - an img inside carries alt (mandatory; supplied by the adopter's content slot);
    - a video inside carries its own accessible controls;
    - an iframe inside carries title;
    - a skeleton inside may carry aria-busy="true" (see the loading-section spec).
  The outer div MUST NOT carry role="img" even when the content is an image -- the img itself
  carries role=img and alt; adding it to the wrapper double-announces.

  CREDITS:
    - Inventory: shadcn/ui AspectRatio used as inventory reference (wrapper + padding-top trick vs
      modern aspect-ratio property baseline); Ant Design has no equivalent (delegates to CSS utils).
    - Styling: original generation over --lv-* tokens; no code copied from any source.
    - A11y: negative confirmation against WAI-ARIA APG patterns index + HTML spec transparent
      content model concept (https://www.w3.org/WAI/ARIA/apg/patterns/).

  Params:
    int ratioX       = 16   width part of the ratio (e.g. 16 in 16:9). Typed int: type-safe, no
                            format validation needed, template owns formatting into CSS.
    int ratioY       = 9    height part of the ratio (e.g. 9 in 16:9). Any positive integer pair valid.
    String overflow  = "hidden"  CSS overflow on the inner content element: "hidden" | "visible" |
                            "auto". Emitted as an inline overflow style on the outer element (matching
                            the layer that clips the border-radius).
    String rounded   = ""   token-driven corner radius: "" (none) | "sm" | "md" | "lg" | "xl" |
                            "full" -- mapped to --lv-radius-* via inline style on the outer element.
    boolean border   = false  renders a 1px border using --lv-color-border on the outer element.
    String cssClass  = ""   extra utility classes appended to the outer element.
    String innerClass = ""  extra utility classes appended to the inner content element.
    String attrs     = ""   TRUSTED raw ($unsafe) -- STATIC author-typed strings only (id, data-testid).
                            Never feed user-supplied or per-row DB values through this channel.
    gg.jte.Content content  (required) the child content: image, video, iframe, skeleton, or any block.

  Usage:
    @@template.lievit.aspect-ratio(content = @@`
      <img src="/cover.jpg" alt="Mountain landscape" style="width:100%;height:100%;object-fit:cover;">
    `)
    @@template.lievit.aspect-ratio(ratioX = 1, ratioY = 1, rounded = "full", cssClass = "max-w-xs",
      content = @@`<img src="/avatar.jpg" alt="User avatar" style="width:100%;height:100%;object-fit:cover;">`)
--%>
@param int ratioX = 16
@param int ratioY = 9
@param String overflow = "hidden"
@param String rounded = ""
@param boolean border = false
@param String cssClass = ""
@param String innerClass = ""
@param String attrs = ""
@param gg.jte.Content content

<%-- Compute the CSS custom property value. Java string concatenation, not ${} inside a Java string
     literal (only valid in HTML template position). The ratio is authored as two typed ints so the
     call-site is type-safe and the partial owns the CSS formatting. --%>
!{var _ratio = ratioX + " / " + ratioY;}
!{var _dataRatio = ratioX + ":" + ratioY;}
<%-- border-radius: mapped from rounded param to --lv-radius-* token. Empty = no radius. --%>
!{var _radiusStyle = switch (rounded) {
    case "sm"   -> "border-radius:var(--lv-radius-sm);";
    case "md"   -> "border-radius:var(--lv-radius-md);";
    case "lg"   -> "border-radius:var(--lv-radius-lg);";
    case "xl"   -> "border-radius:var(--lv-radius-xl);";
    case "full" -> "border-radius:var(--lv-radius-full);";
    default     -> "";
  };}
<%-- border: 1px solid --lv-color-border when true; empty string otherwise. --%>
!{var _borderStyle = border ? "border:1px solid var(--lv-color-border);" : "";}
<%-- overflow: controls whether content clips at the outer framing element. --%>
!{var _overflowStyle = "overflow:" + overflow + ";";}
<%-- outer element inline style: --lv-ar-ratio CSS custom property + radius + border + overflow.
     --lv-ar-ratio is a per-instance runtime value (not a design-constant token in lievit-tokens.css)
     namespaced --lv- to stay within the library's CSS custom property namespace and to be
     overridable via CSS by an adopter who needs to dynamically change the ratio. --%>
!{var _outerStyle = "--lv-ar-ratio:" + _ratio + ";" + _overflowStyle + _radiusStyle + _borderStyle;}
<%-- inner element: enforces the numeric ratio; size-full fills the constrained box. --%>
!{var _innerStyle = "aspect-ratio:var(--lv-ar-ratio);width:100%;height:100%;";}

<div
  data-slot="aspect-ratio"
  data-ratio="${_dataRatio}"
  class="w-full ${cssClass}"
  style="${_outerStyle}"
  $unsafe{attrs}
><div
  data-slot="aspect-ratio-inner"
  class="${innerClass}"
  style="${_innerStyle}"
>${content}</div></div>
