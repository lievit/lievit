@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
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
  padding-based, so it sits flush next to the form controls in a toolbar row. The baseline is
  shadcn's 36px control height; each size pins the SAME height token the form controls use, so a
  button lines up pixel-exact with an input / native-select of the matching size:
    sm  -> height token [var(--lv-space-8)]  (2rem,   32px) == native-select size="sm"      ; compact toolbar
    md  -> height token [var(--lv-space-9)]  (2.25rem,36px) == input + native-select default ; THE default, the shadcn 36px row baseline
    lg  -> height token [var(--lv-space-10)] (2.5rem, 40px) == native-select size="lg"      ; prominent CTA
  Horizontal padding + text size scale with the height; the gap-[var(--lv-space-2)] spaces an
  icon from its label. md matches `@template.lievit.input` and `@template.lievit.native-select` (default) so a
  toolbar of [input][native-select][button] aligns with no per-call height hacks (the bug this
  fixes: adopters hand-rolling fixed-height buttons with ad-hoc padding that never lined up with
  the inputs).

  ICON-ONLY (toolbar icon actions + per-row action icons). Set iconOnly=true to render a SQUARE
  icon-only control: width == height for the chosen size (h/w = the same --lv-space token), zero
  horizontal padding, the content is a single @template.lievit.icon(...). It is the SAME real
  <button>/<a> element, so role/keyboard/disabled/focus-ring are unchanged. Because there is no
  visible text label, ariaLabel is REQUIRED for the accessible name (WAI-ARIA): an icon-only
  control with no name is unusable to assistive tech, so it is a first-class param here.

  A11y (WAI-ARIA button): native <button> => role + keyboard + disabled for free; <a href> =>
  a real link. focus-visible ring via the --lv-ring token. A disabled link drops href and gets
  aria-disabled (an <a> cannot be natively disabled). ariaLabel sets aria-label (mandatory for
  iconOnly, optional otherwise).

  EXTRA ATTRIBUTES -- two channels, by trust (the XSS decision rule). The control often needs
  more than the typed params: wire directives (l:click, l:keydown), data-*, target/rel. There
  are TWO ways in, split by who controls the value, because escaping is not optional for the
  dynamic case:
    * attrs (TRUSTED, raw) -- a raw attribute string output with $unsafe, so it lands as markup
      and is NOT escaped. Use it ONLY for STATIC, author-controlled strings: wire directives and
      fixed attributes whose every character you typed yourself, e.g.
      attrs = "l:click=\"$set('open','')\" target=\"_blank\" rel=\"noopener\"". NEVER interpolate
      a user/DB-derived value into attrs: a payload that closes the quote and opens a script tag
      ( the classic [quote][gt][script...] breakout ) would escape the tag and inject markup.
    * dataAttrs (SAFE, escaped) -- a Map<String,String> of DYNAMIC data-* attributes. Each entry
      renders as data-<key>="<value>" where the VALUE is escaped with JTE's OWN attribute escaper
      gg.jte.html.escape.Escape.htmlAttribute (the exact routine ContentType.Html uses for a
      ${} in attribute-value position), so a hostile value (the same [quote][gt][script...]
      breakout payload) renders inert: the quote and angle brackets become entities, so it stays
      attribute text and never becomes a tag. (We escape-then-$unsafe rather than write a bare
      @for in the open tag because JTE's HTML parser forbids a loop in attribute-NAME position;
      routing every value through Escape.htmlAttribute keeps the SAME escaping guarantee.) This
      is the ONLY safe way to carry user/DB-derived data on the button. Keys are the
      data-attribute name WITHOUT the leading "data-" (key "confirm" -> data-confirm); keep keys
      to simple identifiers ([A-Za-z][A-Za-z0-9-]*) -- the key sits in
      attribute-NAME position, which JTE does not escape, so a non-identifier key is the caller's
      bug, not an injection the partial absorbs. Empty by default; left empty nothing is added.

  Params:
    String  variant  = "primary"   "primary" | "secondary" | "destructive" | "ghost" | "outline".
    String  size     = "md"        "sm" | "md" | "lg" (height-based, aligns to the form controls).
    boolean iconOnly = false        square icon-only button; content is a single @@template.lievit.icon.
    String  type     = "button"    "button" | "submit" | "reset" (ignored when href is set).
    String  href     = null        when set, render an <a href> styled as a button.
    boolean disabled = false        dims + blocks activation.
    String  ariaLabel = null       aria-label; REQUIRED when iconOnly is true.
    String  cssClass = ""          extra utility classes (e.g. an l:click is added by the caller).
    String  attrs    = ""          TRUSTED raw attribute string ($unsafe) -- STATIC strings only.
    Map<String,String> dataAttrs = {}  SAFE dynamic data-* (key w/o "data-", simple identifier);
                                      each value escaped via Escape.htmlAttribute.
    gg.jte.Content content          the button label / icon + label (a single icon when iconOnly).

  Usage: the consuming wire template wires the action via l:click on the rendered element.
    @@template.lievit.button(variant = "primary", cssClass = "...", content = @@`Save`)
    @@template.lievit.button(size = "sm", variant = "secondary", content = @@`Filter`)
    @@template.lievit.button(href = "/listings", variant = "ghost", content = @@`Back`)
    @@template.lievit.button(iconOnly = true, size = "sm", variant = "ghost", ariaLabel = "Open calendar",
        content = @@`@@template.lievit.icon(name = "calendar", size = "1rem")`)
    (trusted STATIC directive via attrs -- $unsafe, author-typed only):
    @@template.lievit.button(variant = "destructive", attrs = "l:click=\"$set('confirmOpen','')\"", content = @@`Delete`)
    (DYNAMIC user-derived value carried SAFELY -- HTML-escaped -- via dataAttrs):
    @@template.lievit.button(variant = "destructive", dataAttrs = java.util.Map.of("confirm", userSuppliedText),
        attrs = "l:click=\"armReset\"", content = @@`Reset`)
--%>
@param String variant = "primary"
@param String size = "md"
@param boolean iconOnly = false
@param String type = "button"
@param String href = null
@param boolean disabled = false
@param String ariaLabel = null
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param gg.jte.Content content

<%-- per-variant resting colours + the shadcn hover (hover:bg-<tone>/90, secondary /80, ghost+outline
     hover to accent). destructive also pins the aria-invalid destructive ring (shadcn). --%>
!{var variantClass = switch (variant) {
    case "secondary"   -> "bg-[var(--lv-color-secondary)] text-[var(--lv-color-secondary-fg)] hover:bg-[color-mix(in_srgb,var(--lv-color-secondary)_80%,transparent)]";
    case "destructive" -> "bg-[var(--lv-color-destructive)] text-[var(--lv-color-destructive-fg)] hover:bg-[color-mix(in_srgb,var(--lv-color-destructive)_90%,transparent)] aria-invalid:shadow-[var(--lv-ring)]";
    case "ghost"       -> "bg-transparent text-[var(--lv-color-fg)] border-transparent hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)]";
    case "outline"     -> "bg-transparent text-[var(--lv-color-fg)] border-[var(--lv-color-border)] shadow-[var(--lv-shadow-xs)] hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)]";
    default            -> "bg-[var(--lv-color-primary)] text-[var(--lv-color-primary-fg)] hover:bg-[color-mix(in_srgb,var(--lv-color-primary)_90%,transparent)]";
  };}

<%-- height + text-size per size; horizontal padding is added separately so iconOnly can drop it for a square --%>
!{var sizeClass = switch (size) {
    case "sm" -> "h-[var(--lv-space-8)] text-[length:var(--lv-text-xs)]";
    case "lg" -> "h-[var(--lv-space-10)] text-[length:var(--lv-text-base)]";
    default   -> "h-[var(--lv-space-9)] text-[length:var(--lv-text-sm)]";
  };}
<%-- square (w == h) + no horizontal padding for the icon-only control; otherwise size-scaled px --%>
!{var shapeClass = iconOnly
    ? (switch (size) {
        case "sm" -> "w-[var(--lv-space-8)] p-0";
        case "lg" -> "w-[var(--lv-space-10)] p-0";
        default   -> "w-[var(--lv-space-9)] p-0";
      })
    : (switch (size) {
        case "sm" -> "px-[var(--lv-space-3)]";
        case "lg" -> "px-[var(--lv-space-6)]";
        default   -> "px-[var(--lv-space-4)]";
      });}

<%-- shadcn base: shrink-0 + whitespace-nowrap keep the control intact in a flex toolbar; the
     transition animates only colour + box-shadow (hover + focus ring); aria-invalid recolours
     the border to the destructive token (the per-variant ring is added in variantClass). --%>
!{var base = "inline-flex shrink-0 items-center justify-center gap-[var(--lv-space-2)] whitespace-nowrap rounded-[var(--lv-radius-md)] border border-transparent leading-[var(--lv-leading)] cursor-pointer outline-none transition-[color,box-shadow] focus-visible:shadow-[var(--lv-ring)] aria-invalid:border-[var(--lv-color-destructive)] disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:cursor-not-allowed";}

<%-- SAFE dynamic data-* attributes. JTE's HTML parser forbids a raw @for in attribute-NAME
     position, so we build the fragment once here: each entry becomes data-<key>="<value>"
     with the VALUE escaped through JTE's OWN attribute escaper (Escape.htmlAttribute, the same
     routine ContentType.Html applies to a ${} in attribute-value position). The result is then
     emitted with $unsafe in the open tag -- safe because every dynamic value is already escaped.
     Keys must be simple identifiers (the key sits in attribute-NAME position, which is NOT
     escaped); a non-identifier key is dropped so it can never inject markup. --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

@if(href != null)
  <a
    data-slot="button"
    data-variant="${variant}"
    data-size="${size}"
    data-icon-only="${iconOnly}"
    href="${disabled ? null : href}"
    aria-disabled="${disabled ? "true" : null}"
    aria-label="${ariaLabel}"
    $unsafe{dataAttrsMarkup}
    class="${base} ${sizeClass} ${shapeClass} ${variantClass} ${cssClass}"
    style="font-family:var(--lv-font-sans);"
    $unsafe{attrs}
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
    $unsafe{dataAttrsMarkup}
    class="${base} ${sizeClass} ${shapeClass} ${variantClass} ${cssClass}"
    style="font-family:var(--lv-font-sans);"
    $unsafe{attrs}
  >${content}</button>
@endif
