@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui switch partial -- a native <button role="switch"> (or <input type="checkbox" role="switch">)
  styled as a sliding toggle control.

  TIER: STATIC presentational -> JTE partial. The control holds NO state of its own: the consuming
  WIRE template owns the checked state and wires the toggle via `wireClick`. Server-first works
  trivially here -- there is nothing irreducibly client about a binary toggle.

  STRUCTURE (scientific decision rule): a real native <button role="switch"> is the primary variant,
  following the WAI-ARIA APG Switch button-based example
  (https://www.w3.org/WAI/ARIA/apg/patterns/switch/examples/switch-button/).
  The native <button> gives role + Enter/Space activation + focus for free; no JS enhancer is needed.
  The asCheckbox=true variant uses <input type="checkbox" role="switch"> for form submission.
  Both are CSP-clean: the thumb slide is driven entirely by CSS with zero JS.
  Button variant: data-checked on the button element drives data-[checked=true]: selectors on the thumb.
  Checkbox variant: the `peer` class on the input drives peer-checked: selectors on the sibling thumb.
  All Tailwind utility classes in !{var ...} blocks are COMPLETE static strings so the scanner picks them up.

  A11y (WAI-ARIA APG Switch, https://www.w3.org/WAI/ARIA/apg/patterns/switch/):
    - button variant: <button role="switch" aria-checked="true|false">; Enter + Space toggle via platform.
    - checkbox variant: <input type="checkbox" role="switch">; Space toggles via platform; Enter submits form.
    - accessible name: ariaLabel > ariaLabelledBy > visible adjacent label (leading/trailing slot).
      A switch WITHOUT an accessible name is an a11y violation; the axe-core acceptance test asserts it.
    - on/off inner labels: aria-hidden="true" to avoid "On On" / "Off Off" double-announcement.
    - loading: aria-busy="true" on the interactive element; spinner inside the thumb.
    - disabled: native `disabled` attribute on <button>/<input> (NOT aria-disabled, which is for <a>).
    - aria-invalid: applied by the consuming `field` partial on the wrapper; the switch inherits via
      a CSS [aria-invalid] selector; the switch itself never emits aria-invalid.
    - focus-visible ring via --lv-ring on the interactive element (:focus-visible, NOT :focus).
    - No focus trap; no roving tabindex; no enhancer needed.

  SIZE (toolbar-aligned per architecture contract §5.b):
    sm  -> track 32x18px, thumb 14px (--lv-space-5)
    md  -> track 40x22px, thumb 18px (--lv-space-6) -- default + shadcn baseline
    lg  -> track 50x28px, thumb 22px (--lv-space-7)
  Track sizes are design invariants; thumb diameters use --lv-space-* tokens for on-grid sizing.
  Thumb translate = track-width - thumb-diameter - (track-height - thumb-diameter):
    sm: 32 - 14 - (18-14) = 14px; md: 40 - 18 - (22-18) = 18px; lg: 50 - 22 - (28-22) = 22px.

  WIRE / ESCAPING (verbatim from button.jte; the XSS decision rule):
    attrs     = TRUSTED raw ($unsafe) -- STATIC, author-typed strings ONLY (wire directives, form attr).
                NEVER interpolate a user/DB-derived value into attrs.
    dataAttrs = SAFE escaped Map<String,String>: each value through Escape.htmlAttribute.
    wireClick = SAFE wire action name, emitted as l:click="${wireClick}" (JTE escapes the attribute value).
    wireArgs  = SAFE per-row wire args: each emitted as data-<key>="<escaped-value>", merged with dataAttrs.
    A per-row, DB-derived value (e.g. entity id) goes through wireArgs, NEVER attrs.

  Params:
    boolean checked          = false   current on/off state (server truth; always a WIRE field reflection).
    String  size             = "md"    sm | md | lg -- height-based, toolbar-aligned.
    boolean disabled         = false   dims + blocks activation; native disabled on the element.
    boolean loading          = false   spinner in the thumb, aria-busy="true", blocks activation.
    boolean asCheckbox       = false   render <input type="checkbox" role="switch"> instead of <button>.
    String  name             = null    name attribute when asCheckbox=true.
    String  value            = "on"    value attribute when asCheckbox=true.
    String  ariaLabel        = null    aria-label; REQUIRED when no visible adjacent label exists.
    String  ariaLabelledBy   = null    aria-labelledby referencing an external label/heading element.
    String  ariaDescribedBy  = null    aria-describedby referencing a hint/description element.
    String  onLabel          = null    text inside the track when checked (Ant Design inner-label style);
                                       aria-hidden -- does NOT provide the accessible name.
    String  offLabel         = null    text inside the track when NOT checked; likewise aria-hidden.
    String  cssClass         = ""      extra utility classes appended to the root wrapper element.
    String  attrs            = ""      TRUSTED raw attribute string ($unsafe) -- STATIC strings only.
    java.util.Map<String, String> dataAttrs = java.util.Map.of()  SAFE dynamic data-* (each value escaped).
    String  wireClick        = null    SAFE wire action name; emitted as l:click="${wireClick}" when set.
    java.util.Map<String, String> wireArgs = java.util.Map.of()  SAFE per-row args merged into escaped data-*.
    gg.jte.Content leading   = null    slot rendered BEFORE the track (icon or label text).
    gg.jte.Content trailing  = null    slot rendered AFTER the track (most common visible label position).

  Usage:
    @@template.lievit.switch(checked = prefs.notifications(), ariaLabelledBy = "notifications-label",
        wireClick = "toggleNotifications", wireArgs = java.util.Map.of("userId", _instance.userId()))
    @@template.lievit.switch(checked = settings.darkMode(), ariaLabel = "Dark mode",
        trailing = @@`<span>Dark mode</span>`)
    @@template.lievit.switch(asCheckbox = true, name = "subscribe", checked = user.subscribed(),
        trailing = @@`<span>Subscribe to newsletter</span>`)
--%>
@param boolean checked = false
@param String size = "md"
@param boolean disabled = false
@param boolean loading = false
@param boolean asCheckbox = false
@param String name = null
@param String value = "on"
@param String ariaLabel = null
@param String ariaLabelledBy = null
@param String ariaDescribedBy = null
@param String onLabel = null
@param String offLabel = null
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param String wireClick = null
@param java.util.Map<String, String> wireArgs = java.util.Map.of()
@param gg.jte.Content leading = null
@param gg.jte.Content trailing = null

<%-- Track dimensions -- COMPLETE static strings (Tailwind scanner requirement).
     sm: h-[18px] w-[32px];  md: h-[22px] w-[40px];  lg: h-[28px] w-[50px] --%>
!{var trackClass = switch (size) {
    case "sm" -> "h-[18px] w-[32px]";
    case "lg" -> "h-[28px] w-[50px]";
    default   -> "h-[22px] w-[40px]";
  };}

<%-- Thumb size using the spacing token (on-grid diameter). --%>
!{var thumbClass = switch (size) {
    case "sm" -> "size-[var(--lv-space-5)]";
    case "lg" -> "size-[var(--lv-space-7)]";
    default   -> "size-[var(--lv-space-6)]";
  };}

<%-- Button variant: [[data-checked=true]_&]: targets an ANCESTOR with data-checked=true (the <button>).
     This drives translate + colour on the thumb child. All class strings are COMPLETE + static. --%>
!{var thumbButtonCheckedClass = switch (size) {
    case "sm" -> "[[data-checked=true]_&]:translate-x-[14px] [[data-checked=true]_&]:bg-[var(--lv-color-primary-fg)]";
    case "lg" -> "[[data-checked=true]_&]:translate-x-[22px] [[data-checked=true]_&]:bg-[var(--lv-color-primary-fg)]";
    default   -> "[[data-checked=true]_&]:translate-x-[18px] [[data-checked=true]_&]:bg-[var(--lv-color-primary-fg)]";
  };}

<%-- Checkbox variant: peer-checked: from the <input class="peer"> sibling drives translate + colour. --%>
!{var thumbCheckboxCheckedClass = switch (size) {
    case "sm" -> "peer-checked:translate-x-[14px] peer-checked:bg-[var(--lv-color-primary-fg)]";
    case "lg" -> "peer-checked:translate-x-[22px] peer-checked:bg-[var(--lv-color-primary-fg)]";
    default   -> "peer-checked:translate-x-[18px] peer-checked:bg-[var(--lv-color-primary-fg)]";
  };}

<%-- Inner on-label left offset = 2px gap + thumb-diameter; COMPLETE static strings. --%>
!{var onLabelLeft = switch (size) {
    case "sm" -> "left-[18px]";
    case "lg" -> "left-[26px]";
    default   -> "left-[22px]";
  };}

!{var innerLabelSize = "sm".equals(size)
    ? "text-[length:var(--lv-text-xs)]"
    : "text-[length:var(--lv-text-sm)]";}

!{boolean isBlocked = disabled || loading;}

<%-- SAFE dynamic data-* fragment (wireArgs win on key collision; pattern from button.jte).
     JTE's HTML parser forbids a raw @for in attribute-NAME position, so we build the fragment
     once and emit it with $unsafe -- safe because every dynamic VALUE is already escaped. --%>
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

<%-- Root wrapper: data-slot + data-size for test selectors and styling hooks. --%>
<div
  data-slot="switch-root"
  data-size="${size}"
  class="inline-flex shrink-0 items-center gap-[var(--lv-space-2)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(leading != null)
    ${leading}
  @endif

  @if(asCheckbox)
    <%-- CHECKBOX VARIANT: <input type="checkbox" role="switch"> for form submission.
         Focus ring is expressed with has-[:focus-visible] on the outer span so it wraps
         the styled track; the input itself is sr-only (positioned off-screen) to preserve
         the native accessibility tree while allowing the custom track + thumb styling.
         Track colour: data-checked on this span mirrors the checked param for CSS targeting. --%>
    <span
      data-checked="${checked}"
      class="relative inline-flex shrink-0 ${trackClass} cursor-pointer items-center rounded-[var(--lv-radius-full)] border border-[var(--lv-color-border)] bg-[var(--lv-color-input)] data-[checked=true]:border-[var(--lv-color-primary)] data-[checked=true]:bg-[var(--lv-color-primary)] transition-colors has-[:focus-visible]:shadow-[var(--lv-ring)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-[var(--lv-opacity-disabled)]"
    >
      <input
        data-slot="switch"
        type="checkbox"
        role="switch"
        name="${name}"
        value="${value}"
        checked="${checked}"
        disabled="${isBlocked}"
        aria-label="${ariaLabel}"
        aria-labelledby="${ariaLabelledBy}"
        aria-describedby="${ariaDescribedBy}"
        aria-busy="${loading ? "true" : null}"
        l:click="${(wireClick != null && !wireClick.isBlank()) ? wireClick : null}"
        $unsafe{dataAttrsMarkup}
        class="peer sr-only"
        $unsafe{attrs}
      >
      <%-- Thumb: peer-checked: from the sibling input drives translate + colour. --%>
      <span
        data-slot="switch-thumb"
        aria-hidden="true"
        class="pointer-events-none absolute left-[2px] top-1/2 -translate-y-1/2 inline-flex shrink-0 items-center justify-center ${thumbClass} rounded-[var(--lv-radius-full)] bg-[var(--lv-color-fg)] shadow-[var(--lv-shadow-xs)] translate-x-0 ${thumbCheckboxCheckedClass} transition-[transform] duration-[var(--lv-duration-fast)] motion-reduce:transition-none"
      >
        @if(loading)
          @template.lievit.spinner(size = "sm", label = "Loading")
        @endif
      </span>
      <%-- Inner on/off labels (Ant Design style); aria-hidden avoids double-announcement. --%>
      @if(onLabel != null)
        <span
          class="switch-on-label pointer-events-none absolute ${onLabelLeft} hidden peer-checked:inline ${innerLabelSize} font-[var(--lv-font-medium)] text-[var(--lv-color-primary-fg)] select-none"
          aria-hidden="true"
        >${onLabel}</span>
      @endif
      @if(offLabel != null)
        <span
          class="switch-off-label pointer-events-none absolute left-[4px] inline peer-checked:hidden ${innerLabelSize} font-[var(--lv-font-medium)] text-[var(--lv-color-muted)] select-none"
          aria-hidden="true"
        >${offLabel}</span>
      @endif
    </span>
  @else
    <%-- BUTTON VARIANT: <button role="switch"> -- the primary APG pattern.
         aria-checked="true|false" reflects the checked state for AT.
         Track colour + thumb translate: data-checked on this button drives
         data-[checked=true]: selectors on itself (track) and its children (thumb, labels).
         Destructive context: consumer adds `lv-switch--destructive` via cssClass; the
         [.lv-switch--destructive_&] selector overrides the checked track to the destructive token
         pair. --%>
    <button
      data-slot="switch"
      data-checked="${checked}"
      role="switch"
      type="button"
      aria-checked="${checked ? "true" : "false"}"
      aria-label="${ariaLabel}"
      aria-labelledby="${ariaLabelledBy}"
      aria-describedby="${ariaDescribedBy}"
      aria-busy="${loading ? "true" : null}"
      disabled="${isBlocked}"
      l:click="${(wireClick != null && !wireClick.isBlank()) ? wireClick : null}"
      $unsafe{dataAttrsMarkup}
      class="relative inline-flex shrink-0 ${trackClass} cursor-pointer items-center rounded-[var(--lv-radius-full)] border border-[var(--lv-color-border)] bg-[var(--lv-color-input)] data-[checked=true]:border-[var(--lv-color-primary)] data-[checked=true]:bg-[var(--lv-color-primary)] transition-colors outline-none focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-[var(--lv-opacity-disabled)]"
      $unsafe{attrs}
    >
      <%-- Thumb: data-[checked=true] on the parent <button> drives translate + colour. --%>
      <span
        data-slot="switch-thumb"
        aria-hidden="true"
        class="pointer-events-none absolute left-[2px] top-1/2 -translate-y-1/2 inline-flex shrink-0 items-center justify-center ${thumbClass} rounded-[var(--lv-radius-full)] bg-[var(--lv-color-fg)] shadow-[var(--lv-shadow-xs)] translate-x-0 ${thumbButtonCheckedClass} transition-[transform] duration-[var(--lv-duration-fast)] motion-reduce:transition-none"
      >
        @if(loading)
          @template.lievit.spinner(size = "sm", label = "Loading")
        @endif
      </span>
      <%-- Inner on/off labels (Ant Design style); aria-hidden avoids double-announcement.
           [[data-checked=true]_&]: targets an ancestor with data-checked=true (the parent button). --%>
      @if(onLabel != null)
        <span
          class="switch-on-label pointer-events-none absolute ${onLabelLeft} hidden [[data-checked=true]_&]:inline ${innerLabelSize} font-[var(--lv-font-medium)] text-[var(--lv-color-primary-fg)] select-none"
          aria-hidden="true"
        >${onLabel}</span>
      @endif
      @if(offLabel != null)
        <span
          class="switch-off-label pointer-events-none absolute left-[4px] inline [[data-checked=true]_&]:hidden ${innerLabelSize} font-[var(--lv-font-medium)] text-[var(--lv-color-muted)] select-none"
          aria-hidden="true"
        >${offLabel}</span>
      @endif
    </button>
  @endif

  @if(trailing != null)
    ${trailing}
  @endif
</div>
