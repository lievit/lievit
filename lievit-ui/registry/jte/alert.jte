@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui alert partial -- a contextual message banner whose variant drives the ARIA live-region
  role, the icon, and the colour token pair (surface + foreground + border). Static presentational:
  no enhancer, no client state.

  TIER: PARTIAL -- pure server-rendered presentation. The dismiss button (closable=true) is a real
  native <button>; the consuming template wires the action via l:click on it through `attrs`.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA APG Alert pattern (https://www.w3.org/WAI/ARIA/apg/patterns/alert/): the role IS the
      entire a11y contract for a passive notification. No interactive focus management; no focus trap;
      the dismiss button is platform-native.
    - Inventory reference: Ant Design Alert (info/success/warning/error variants, icon, closable,
      description, banner mode) mapped to the lievit variant vocabulary (destructive = error).
    - Layout: shadcn new-york-v4 icon + CSS GRID composition (icon column 1, body column 2).
    - Styling: ORIGINAL generation over --lv-* tokens, look inspired by Tailwind UI (no code copied).

  A11y (WAI-ARIA alert / status):
    - role by INTENT: info/success → role="status" (polite, not urgent); warning/destructive →
      role="alert" (assertive, interrupt). Both carry implicit aria-live + aria-atomic="true" per
      the ARIA spec; the browser enforces these, so they are NOT emitted explicitly.
    - Icon (when rendered): aria-hidden="true" -- purely decorative; text conveys the meaning.
    - Dismiss button (closable=true): real <button type="button"> with aria-label="Dismiss".
      Icon-only, so the accessible name is mandatory (architecture contract §5.d).
    - title (when set): <p> element, NOT a heading. Alert banners are not document sections.
    - role="none" override: suppresses the role attribute entirely (purely decorative display).
    - The alert root is NOT focusable (tabindex is never added).

  Params:
    String  variant   = "info"    "info" | "success" | "warning" | "destructive".
    String  title     = null      optional bold heading (rendered as a <p>); when set the content
                                  is the supporting description beneath it.
    boolean icon      = true      show the variant-default icon; set false to suppress.
    String  iconName  = null      override the default variant icon with a named Lucide icon slug.
    boolean closable  = false     render the dismiss <button> (X); the consuming template wires
                                  l:click="dismiss" on it via `attrs`.
    boolean banner    = false     full-bleed layout: no border-radius, thick left-border stripe.
    String  role      = null      override the auto-derived live-region role; pass "none" to
                                  suppress the role entirely.
    String  cssClass  = ""        extra utility classes on the root.
    String  attrs     = ""        TRUSTED raw ($unsafe) -- STATIC author-typed strings only
                                  (data-testid, wire directives on the root or dismiss button).
    Map<String,String> dataAttrs = {}  SAFE escaped dynamic data-* on the root (key w/o "data-",
                                  simple identifier); each value via Escape.htmlAttribute.
    gg.jte.Content content        the primary message body.
    gg.jte.Content action = null  optional inline action slot after the body.

  Usage:
    @@template.lievit.alert(variant = "destructive", title = "Could not save",
      content = @@`The listing was not persisted.`)
    @@template.lievit.alert(variant = "success", icon = true, closable = true,
      attrs = "l:click=\"dismissAlert\"",
      content = @@`Your changes have been saved.`)
    @@template.lievit.alert(variant = "warning", banner = true,
      title = "Maintenance window",
      content = @@`The system will be unavailable from 02:00 to 04:00.`)
    @@template.lievit.alert(variant = "info", role = "none",
      content = @@`This is a decorative note already announced elsewhere.`)
--%>
@param String variant = "info"
@param String title = null
@param boolean icon = true
@param String iconName = null
@param boolean closable = false
@param boolean banner = false
@param String role = null
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param gg.jte.Content content
@param gg.jte.Content action = null

<%-- Derived: effectiveRole -- role override wins; "none" suppresses the attribute. --%>
!{var _autoRole = ("warning".equals(variant) || "destructive".equals(variant)) ? "alert" : "status";}
!{var _effectiveRole = (role != null && !role.isBlank()) ? role : _autoRole;}
!{var _emitRole = !"none".equals(_effectiveRole);}

<%-- Derived: defaultIconName per variant; resolvedIconName = iconName override or default. --%>
!{var _defaultIconName = switch (variant) {
    case "success"     -> "circle-check";
    case "warning"     -> "triangle-alert";
    case "destructive" -> "circle-x";
    default            -> "info";
  };}
!{var _resolvedIconName = (iconName != null && !iconName.isBlank()) ? iconName : _defaultIconName;}

<%-- Derived: token mapping for surface bg + foreground text/icon + border/stripe.
     The EXISTING tokens have two tiers:
       --lv-color-{variant}     = the saturated intent colour (e.g. success green #16a34a)
       --lv-color-{variant}-fg  = intended foreground ON a SOLID fill of the above (= white)
     The alert uses a 10% tint of the base colour as the surface background; on that pale
     wash the solid-fill-fg (white) would be invisible. Correct approach: use the BASE
     token as both border/stripe AND as the icon/text colour against the pale tint. This is
     exactly what the existing alert.jte does and is the standard alert pattern (Tailwind UI,
     shadcn). The spec's §5 darker fg values (e.g. oklch(0.35 0.12 240)) were net-new tokens
     rejected by D4; without them, the base tone IS the fg against the tint. --%>
!{var _tone = switch (variant) {
    case "success"     -> "var(--lv-color-success)";
    case "warning"     -> "var(--lv-color-warning)";
    case "destructive" -> "var(--lv-color-destructive)";
    default            -> "var(--lv-color-info)";
  };}

<%-- Layout: grid columns depend on icon + closable.
     col 1: icon (1.25rem when icon, 0 otherwise)
     col 2: body (flex fill)
     col 3: dismiss button (var(--lv-space-6) when closable, 0 otherwise) --%>
!{var _hasIcon = icon;}
!{var _iconCol  = _hasIcon ? "1.25rem" : "0";}
!{var _dismissCol = closable ? "var(--lv-space-6)" : "0";}
!{var _gridCols = _iconCol + " 1fr " + _dismissCol;}
!{var _colGap   = (_hasIcon || closable) ? "var(--lv-space-2)" : "0";}

<%-- Banner layout: no radius, thick left stripe instead of full border. --%>
!{var _radiusStyle = banner ? "border-radius:0;" : "border-radius:var(--lv-radius-md);";}
!{var _borderStyle = banner
    ? "border:0;border-left:4px solid " + _tone + ";"
    : "border:1px solid " + _tone + ";";}

<%-- SAFE dynamic data-* attributes (mirrors button.jte exactly).
     JTE's HTML parser forbids a raw @for in attribute-NAME position, so the fragment is built
     once here -- each entry becomes data-<key>="<value>" with the VALUE escaped through JTE's
     OWN attribute escaper (Escape.htmlAttribute), then emitted with $unsafe.
     Keys must be simple identifiers ([A-Za-z][A-Za-z0-9-]*). --%>
!{var _dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      _dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), _dataAttrs_);
      _dataAttrs_.writeContent("\"");
    }
  }}
!{var _dataAttrsMarkup = _dataAttrs_.toString();}

<div
  data-slot="alert"
  data-variant="${variant}"
  role="${_emitRole ? _effectiveRole : null}"
  $unsafe{_dataAttrsMarkup}
  class="relative grid w-full items-start text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] ${cssClass}"
  style="font-family:var(--lv-font-sans);color:${_tone};background:color-mix(in srgb,${_tone} 10%,var(--lv-color-bg));${_borderStyle}${_radiusStyle}padding:var(--lv-space-3) var(--lv-space-4);grid-template-columns:${_gridCols};column-gap:${_colGap};row-gap:var(--lv-space-1);"
  $unsafe{attrs}
>
  @if(_hasIcon)
    <span
      aria-hidden="true"
      style="grid-column:1;grid-row:1;display:inline-flex;align-items:center;color:${_tone};"
    >@template.lievit.icon(name = _resolvedIconName, size = "1rem")</span>
  @endif
  <div data-slot="alert-body" style="grid-column:2;grid-row:1;display:flex;flex-direction:column;gap:var(--lv-space-1);">
    @if(title != null && !title.isBlank())
      <p data-slot="alert-title" style="margin:0;font-size:var(--lv-text-sm);font-weight:var(--lv-font-medium);letter-spacing:-0.01em;line-height:var(--lv-leading);">${title}</p>
    @endif
    <div data-slot="alert-content" style="font-size:var(--lv-text-sm);line-height:var(--lv-leading);">${content}</div>
    @if(action != null)
      <div data-slot="alert-action" style="margin-top:var(--lv-space-1);display:flex;align-items:center;gap:var(--lv-space-2);">${action}</div>
    @endif
  </div>
  @if(closable)
    <button
      type="button"
      aria-label="Dismiss"
      data-slot="alert-dismiss"
      style="grid-column:3;grid-row:1;align-self:start;display:inline-flex;align-items:center;justify-content:center;width:var(--lv-space-6);height:var(--lv-space-6);border:0;background:transparent;cursor:pointer;border-radius:var(--lv-radius-sm);color:var(--lv-color-fg);flex-shrink:0;outline:none;transition:box-shadow var(--lv-duration-fast) var(--lv-ease);"
      class="focus-visible:shadow-[var(--lv-ring)]"
    >@template.lievit.icon(name = "x", size = "1rem")</button>
  @endif
</div>
