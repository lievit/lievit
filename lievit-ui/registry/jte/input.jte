@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui input partial -- the foundational single-line text input control.

  TIER: PARTIAL (+ENH for showCount/clearable). Pure presentation: the native <input> owns
  role=textbox, keyboard interaction, focus management, and form binding for free. The only
  irreducible client behaviour (live count, clearable button visibility) is handled by
  input-count.enhancer.ts; all other wiring (l:model, l:keydown.enter) passes through attrs.
  Server-first works trivially: the server renders the current value into value="${...}"
  and the user sees it immediately with no client round-trip.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA 1.2 textbox role: https://www.w3.org/TR/wai-aria-1.2/#textbox (native element
      mapping; no APG pattern page for textbox -- the platform supplies role, keyboard, and focus).
    - APG "Providing Accessible Names and Descriptions":
      https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/ (labeling rule).
    - Inventory: Ant Design Input (prefix/suffix adornments, clearable, character count,
      status, size, borderless); the search-compound composes this partial inside input-group.
    - Styling: ORIGINAL generation over --lv-* (OKLCH) tokens; look inspired by Tailwind UI.
    - The outer container is a flex row; the native <input> flexes to fill; leading/trailing
      zones receive adornment slots. The container carries :focus-within for the focus ring
      so the ring wraps the entire compound control, not just the bare input.

  A11y (WAI-ARIA 1.2 textbox, platform-native):
    - The native <input> implicitly carries role=textbox (+ specialised roles for type=search
      etc.); do NOT add a redundant role="textbox" attribute.
    - aria-invalid="true" when invalid=true.
    - aria-readonly="true" when readonly=true (native readonly also present).
    - aria-required="true" when required=true (native required also present).
    - aria-disabled NOT emitted: native disabled already removes the element from the tab order
      and the accessibility tree's interactive node set.
    - aria-placeholder NOT emitted: the native placeholder maps to aria-placeholder automatically.
    - Labeling: a visible <label for="id"> in the enclosing field partial is the preferred path.
      When absent, the caller MUST pass aria-label or aria-labelledby via attrs.
      placeholder MUST NOT be the sole accessible name (WCAG SC 3.3.2).
    - clearable button: real <button type="button"> with aria-label="Clear"; Enter/Space fire
      the click for free (platform button rule). The enhancer manages tabindex to keep it
      out of tab order when the field is empty.
    - No focus trap, no roving tabindex, no shared enhancer: platform owns all of this.

  NET-NEW tokens (see TOKENS_NEEDED in agent report):
    - --lv-color-input-disabled: muted background for a disabled input (avoids opacity contrast
      failures on token overrides). OKLCH: oklch(0.94 0 0) light / oklch(0.22 0 0) dark.
    - --lv-color-count-fg: text colour for the character-count badge. Distinct from
      --lv-color-fg-muted so the badge can be lighter without side-effects.
      OKLCH: oklch(0.60 0 0) light / oklch(0.52 0 0) dark.
    Both used below with var() fallback to --lv-color-muted-fg / --lv-color-muted-fg respectively.

  ESCAPING -- two channels (the XSS decision rule):
    - attrs (TRUSTED raw, $unsafe): STATIC author-typed strings ONLY -- wire directives
      (l:model, l:keydown.enter), data-testid, autofocus. NEVER a user/DB-derived value.
    - dataAttrs (SAFE escaped, Map of String to String): per-row dynamic data-* values.
      Each value is escaped through Escape.htmlAttribute before emission.
    - value, placeholder, id, name, autocomplete, inputmode: JTE default HTML-attribute escaping.

  Params:
    String type             = "text"    HTML input type: text | email | password | search | url | tel | number.
    String name             = null      the name attribute for form submission or l:model binding.
    String value            = ""        initial/server-set value for the field.
    String placeholder      = null      hint text; NOT a substitute for a visible label.
    String id               = null      the id for label-for association; pass one always when using a field partial.
    String size             = "md"      height-based: sm | md | lg (toolbar-aligned with button + native-select).
    boolean disabled        = false     native disabled; dims + removes from tab order.
    boolean readonly        = false     native readonly + aria-readonly="true"; focusable, not editable.
    boolean required        = false     native required + aria-required="true"; drives browser validation.
    boolean invalid         = false     aria-invalid="true" + destructive border + ring.
    String autocomplete     = null      autocomplete attribute forwarded verbatim.
    String inputmode        = null      inputmode for mobile keyboard hints, forwarded verbatim.
    Integer maxlength       = null      maxlength attribute; also the count denominator when showCount=true.
    boolean showCount       = false     render a live character-count badge in the trailing zone.
    boolean clearable       = false     render a clear button in the trailing zone when the field has a value.
    boolean borderless      = false     drop the visible border (inline-edit / table-cell surfaces); ring still shows.
    String cssClass         = ""        extra utility classes on the OUTER container div.
    String inputCssClass    = ""        extra utility classes on the <input> element itself.
    String attrs            = ""        TRUSTED raw ($unsafe) -- STATIC author-typed strings ONLY.
    java.util.Map<String,String> dataAttrs = java.util.Map.of()  SAFE dynamic data-* (each value escaped).
    gg.jte.Content leading  = null      left adornment slot: icon, currency symbol, country-code chip.
    gg.jte.Content trailing = null      right adornment slot: unit label, visibility-toggle, loading spinner.

  Usage:
    @@template.lievit.input(name = "nome", value = contatto.nome(), attrs = "l:model=\"nome\"")
    @@template.lievit.input(type = "email", id = "email", name = "email", placeholder = "you@example.com",
        attrs = "aria-label=\"Email address\"")
    @@template.lievit.input(name = "q", type = "search", size = "sm", clearable = true, placeholder = "Cerca...")
    @@template.lievit.input(name = "bio", showCount = true, maxlength = 160, attrs = "l:model=\"bio\"")
    @@template.lievit.input(name = "price", leading = @@`<span aria-hidden="true">EUR</span>`,
        trailing = @@`<span aria-hidden="true">/mo</span>`, inputmode = "decimal")
--%>
@param String type = "text"
@param String name = null
@param String value = ""
@param String placeholder = null
@param String id = null
@param String size = "md"
@param boolean disabled = false
@param boolean readonly = false
@param boolean required = false
@param boolean invalid = false
@param String autocomplete = null
@param String inputmode = null
@param Integer maxlength = null
@param boolean showCount = false
@param boolean clearable = false
@param boolean borderless = false
@param String cssClass = ""
@param String inputCssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param gg.jte.Content leading = null
@param gg.jte.Content trailing = null

<%-- height per size; md is the shadcn h-9 baseline, toolbar-aligned with button + native-select --%>
!{var sizeClass = switch (size) {
    case "sm" -> "h-[var(--lv-space-8)] text-[length:var(--lv-text-xs)] px-[var(--lv-space-3)]";
    case "lg" -> "h-[var(--lv-space-10)] text-[length:var(--lv-text-base)] px-[var(--lv-space-4)]";
    default   -> "h-[var(--lv-space-9)] text-[length:var(--lv-text-sm)] px-[var(--lv-space-3)]";
  };}

<%-- modifier classes: invalid, disabled, borderless are CSS hooks on the container --%>
!{var invalidClass    = invalid    ? " lv-input--invalid"    : "";}
!{var disabledClass   = disabled   ? " lv-input--disabled"   : "";}
!{var borderlessClass = borderless ? " lv-input--borderless" : "";}

<%-- whether any trailing zone content exists (clearable, showCount, or caller trailing slot) --%>
!{var hasTrailingZone = clearable || showCount || trailing != null;}

<%-- SAFE dynamic data-* fragment. JTE's HTML parser forbids a raw @for in attribute-NAME
     position, so we build the fragment once and emit it with $unsafe -- safe because every
     dynamic VALUE is escaped via Escape.htmlAttribute. --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<%-- Container: flex row, height via data-size, modifier classes for CSS state hooks.
     :focus-within raises the ring so the full compound (leading + input + trailing) is ringed. --%>
<div
  data-slot="input"
  data-size="${size}"
  class="lv-input relative inline-flex w-full min-w-0 items-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] shadow-[var(--lv-shadow-xs)] transition-[border-color,box-shadow] ${sizeClass} focus-within:border-[var(--lv-color-ring)] focus-within:shadow-[var(--lv-ring)] hover:border-[var(--lv-color-muted)] lv-input--invalid:border-[var(--lv-color-destructive)] lv-input--invalid:focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--lv-color-destructive)_30%,transparent)] lv-input--disabled:cursor-not-allowed lv-input--disabled:opacity-[var(--lv-opacity-disabled)] lv-input--borderless:border-transparent lv-input--borderless:bg-transparent lv-input--borderless:shadow-none${invalidClass}${disabledClass}${borderlessClass} ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(leading != null)
    <%-- Leading zone: decorative adornments (icons, prefix symbols). The caller is responsible
         for aria-hidden on purely decorative content; a non-decorative leading element (e.g.
         a unit selector) must carry its own accessible name in the slot content. --%>
    <span
      data-slot="input-leading"
      aria-hidden="true"
      class="lv-input__leading pointer-events-none inline-flex shrink-0 items-center text-[var(--lv-color-muted-fg)] mr-[var(--lv-space-2)]"
    >${leading}</span>
  @endif

  <%-- Native <input>: flex-grow to fill remaining width. No role attribute (redundant / wrong
       for specialised types like search, email). Explicit ARIA only where the native attribute
       does not cover it: aria-invalid, aria-readonly, aria-required. --%>
  <input
    data-slot="input-field"
    type="${type}"
    id="${id}"
    name="${name}"
    value="${value}"
    placeholder="${placeholder}"
    disabled="${disabled}"
    readonly="${readonly}"
    aria-readonly="${readonly ? "true" : null}"
    required="${required}"
    aria-required="${required ? "true" : null}"
    aria-invalid="${invalid ? "true" : null}"
    autocomplete="${autocomplete}"
    inputmode="${inputmode}"
    maxlength="${maxlength}"
    data-lv-count-max="${showCount && maxlength != null ? maxlength : null}"
    class="lv-input__field min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--lv-color-muted-fg)] disabled:pointer-events-none disabled:cursor-not-allowed ${inputCssClass}"
    $unsafe{dataAttrsMarkup}
    $unsafe{attrs}
  >

  @if(clearable)
    <%-- Clear button: a real <button> so Enter/Space activate it for free (platform button rule).
         tabindex="-1" initially keeps it out of tab order when the field is empty; the
         input-count enhancer switches it to tabindex="0" + removes hidden when value is present. --%>
    <button
      type="button"
      data-slot="input-clear"
      data-lv-clear
      aria-label="Clear"
      tabindex="-1"
      hidden
      class="lv-input__clear ml-[var(--lv-space-1)] inline-flex shrink-0 items-center justify-content:center text-[var(--lv-color-muted-fg)] hover:text-[var(--lv-color-fg)] transition-[color] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
    >@template.lievit.icon(name = "x", size = "1em")</button>
  @endif

  @if(showCount)
    <%-- Count badge: purely visual; NOT a live region (announcing every keystroke would be
         unbearable for AT users). The enhancer writes "x" or "x / max" into this span on
         each input event. aria-hidden keeps it out of the AT read order. --%>
    <span
      data-slot="input-count"
      data-lv-count
      aria-hidden="true"
      class="lv-input__count ml-[var(--lv-space-2)] shrink-0 whitespace-nowrap text-[length:var(--lv-text-xs)] text-[var(--lv-color-count-fg,var(--lv-color-muted-fg))]"
    ></span>
  @endif

  @if(trailing != null)
    <%-- Trailing zone: unit label, visibility-toggle, loading spinner, or any short inline
         element. The caller is responsible for accessible names on interactive content here. --%>
    <span
      data-slot="input-trailing"
      class="lv-input__trailing ml-[var(--lv-space-2)] inline-flex shrink-0 items-center text-[var(--lv-color-muted-fg)]"
    >${trailing}</span>
  @endif
</div>
