@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui checkbox partial -- a styled native input[type=checkbox] (two-state + tri-state).

  TIER: PARTIAL presentational -> JTE partial. The native checkbox carries role=checkbox,
  Space/Tab activation, checked/disabled semantics, and form submission for free -- there is
  no irreducible client state in the control itself. The CHECKED state is rendered server-side
  via the `checked` param; the INDETERMINATE DOM property (write-only from JS, not an HTML
  attribute) is set by checkbox.enhancer.ts after hydration. All other styling and ARIA is
  server-rendered. Server-first works naturally: server renders `checked`; the one irreducible
  client bit is the `el.indeterminate = true` DOM property set by the enhancer.

  STRUCTURE (scientific decision rule):
  - shadcn's Checkbox is a Radix <button> reimplementing the checkbox role in JS (breaks JS-off
    form submit, re-implements Space/Tab that the platform provides free).
  - The native <input type="checkbox"> is always preferred: role + keyboard + disabled + form
    integration for free (WAI-ARIA APG Checkbox pattern).
  - Cross-browser appearance-none + fully custom box: the `sr-only peer` pattern hides the
    native input visually while keeping it in the accessibility tree (AT sees the real input,
    not the decorative box). A peer-driven aria-hidden sibling renders the visible custom box
    + check/dash SVGs. This is the Tailwind-UI-grade approach for a natively-accessible
    visually-custom checkbox.
  - APG two-state: https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/examples/checkbox/
  - APG tri-state:  https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/examples/checkbox-mixed/
  - Ant Design Checkbox inventory reference (indeterminate, sizes, disabled); no code copied.

  A11y (WAI-ARIA APG Checkbox, two-state and tri-state / mixed):
    - real <input type="checkbox">: role="checkbox" natively; no manual role attribute ever.
    - aria-checked: supplied by the browser from the native `checked` + `indeterminate` DOM
      properties. DO NOT emit aria-checked as a static attribute; the browser owns it.
    - indeterminate: DOM property (not an HTML attribute); the enhancer sets el.indeterminate=true
      from data-indeterminate="true" after hydration; browser then reflects aria-checked="mixed".
    - accessible name: ariaLabel param when no visible <label> is associated. The field PARTIAL
      or the call site authors a sibling <label for="${id}">; the checkbox partial emits only
      the single control (no inner label slot -- conflates two semantic elements).
    - aria-describedby: from ariaDescribedBy param (wired by the field PARTIAL to hint/error).
    - aria-invalid: from ariaInvalid param; recolours to --lv-color-destructive token pair.
    - aria-disabled: NOT used; native `disabled` is sufficient for an <input>.
    - keyboard: Tab (platform), Shift+Tab (platform), Space (platform); no arrow keys, no trap,
      no roving tabindex. The native input supplies the complete APG Checkbox key map.
    - focus ring: focus-visible: utilities via peer-focus-visible: on the visual sibling;
      uses --lv-ring (shared interactive focus token). No focus management by enhancer.

  ENHANCER: checkbox.enhancer.ts (component-specific) -- the one irreducible client behavior:
    sets el.indeterminate = true on any input[type=checkbox][data-indeterminate=true] inside
    the component root, on init and after each morph (idempotent). Four-line lifecycle hook,
    not a framework. Registered per-use by the consuming app's main.ts (coordinator wires
    installCheckbox into index.ts; see NEW_ENHANCER in the re-forge report).

  EXTRA ATTRIBUTES -- two channels, by trust (the XSS decision rule):
    attrs     = TRUSTED raw ($unsafe) -- STATIC, author-typed strings ONLY (l:model="field",
                l:change="action", data-testid). NEVER interpolate a DB-derived value here.
    dataAttrs = SAFE escaped Map of String to String: each value through Escape.htmlAttribute.
                A per-row DB-derived value (filter key, row id) goes here, NEVER through attrs.

  data-state (server-derived): "checked" | "unchecked" | "indeterminate" -- mirrors the shadcn
  convention for CSS-hook consistency; original server-side derivation, no code copy.
  data-slot="checkbox" on root, data-size="${size}" for CSS + test targeting.

  Params:
    String name              = null   name on the input (required for plain form submit; l:model substitutes
                                       in a WIRE form).
    String value             = "on"   value submitted when checked (native default "on").
    boolean checked          = false  initial checked state (rendered as the `checked` HTML attribute).
    boolean indeterminate    = false  when true, renders data-indeterminate="true" on the input so the
                                       enhancer sets el.indeterminate after hydration. Does NOT imply checked.
    boolean disabled         = false  disables the control (native disabled attr + visual dims via peer-disabled).
    boolean required         = false  HTML required attribute; control must be checked to submit a form.
    String size              = "md"   sm | md | lg -- box dimension: sm=--lv-space-4 (16px),
                                       md=--lv-space-5 (20px), lg=--lv-space-6 (24px).
    String id                = null   explicit id; auto-generated as "lv-cb-<hashCode>" when null.
                                       The field PARTIAL passes an explicit id and wires its label for it.
    String ariaLabel         = null   aria-label; REQUIRED when no visible label element is associated.
    String ariaDescribedBy   = null   aria-describedby referencing hint/error text (from the field PARTIAL).
    boolean ariaInvalid      = false  aria-invalid="true"; recolours border + ring to the destructive token.
    String cssClass          = ""     extra utility classes on the root wrapper span.
    String attrs             = ""     TRUSTED raw ($unsafe) -- STATIC author-typed strings only
                                       (l:model="field", l:change="action", data-testid).
    Map of String to String dataAttrs = {}  SAFE dynamic data-* on the native input; each value
                                       escaped via Escape.htmlAttribute. Keys: simple identifiers
                                       ([A-Za-z][A-Za-z0-9-]*); non-identifiers are dropped.

  Usage:
    @@template.lievit.checkbox(name = "attivo", checked = contatto.attivo(), ariaLabel = "Attivo")
    @@template.lievit.checkbox(name = "consenso", id = "cb-consenso", ariaLabel = "Consenso",
        attrs = "l:model=\"consenso\"")
    @@template.lievit.checkbox(name = "all", indeterminate = someSelected, ariaLabel = "Select all")
    (a reactive-list row selector carrying a SAFE escaped row id -- no $unsafe needed):
    @@template.lievit.checkbox(name = "sel", ariaLabel = "Select row",
        dataAttrs = java.util.Map.of("rowid", row.id()), attrs = "l:model=\"selected\"")
--%>
@param String name = null
@param String value = "on"
@param boolean checked = false
@param boolean indeterminate = false
@param boolean disabled = false
@param boolean required = false
@param String size = "md"
@param String id = null
@param String ariaLabel = null
@param String ariaDescribedBy = null
@param boolean ariaInvalid = false
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

<%-- Resolve id: prefer the explicit param; fall back to a deterministic auto-id so a sibling
     <label for> can always wire to this control without the call site knowing the fallback. --%>
!{var resolvedId = (id != null && !id.isBlank()) ? id : "lv-cb-" + Math.abs(System.identityHashCode(name != null ? name : ""));}

<%-- data-state (server-derived): mirrors shadcn's convention for CSS-hook + test targeting.
     indeterminate wins over checked (the spec: "does NOT imply checked"). --%>
!{var state = indeterminate ? "indeterminate" : (checked ? "checked" : "unchecked");}

<%-- Box dimension -- COMPLETE static strings (Tailwind scanner). --%>
!{var boxSize = switch (size) {
    case "sm" -> "size-[var(--lv-space-4)]";
    case "lg" -> "size-[var(--lv-space-6)]";
    default   -> "size-[var(--lv-space-5)]";
  };}

<%-- SAFE dynamic data-* fragment (mirrors button.jte / switch.jte exactly).
     JTE's HTML parser forbids a raw @for in attribute-NAME position, so the fragment is
     built once here -- each entry becomes data-<key>="<value>" with the VALUE escaped through
     JTE's OWN attribute escaper (Escape.htmlAttribute), then emitted with $unsafe on the
     <input> -- safe because every value is already escaped. Keys are allowlisted to simple
     identifiers; a non-identifier key is dropped (it sits in attribute-NAME position which JTE
     does not escape, so any injection attempt via a hostile key is silently discarded). --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<%-- Root wrapper: relative + inline-flex so the sr-only input and the visual box stack on the
     same point. data-slot / data-size / data-state on the wrapper for CSS hooks + test selectors. --%>
<span
  data-slot="checkbox"
  data-size="${size}"
  data-state="${state}"
  class="relative inline-flex shrink-0 items-center justify-center ${boxSize} ${cssClass}"
>
  <%-- The real <input>: sr-only (visually hidden but in the a11y tree + tab sequence).
       peer class lets the visual sibling react to :checked, :focus-visible, :disabled, etc.
       aria-checked is NOT emitted: the browser derives it from the native checked + indeterminate
       DOM properties; emitting it as a static attribute conflicts with the DOM property state. --%>
  <input
    data-slot="checkbox-input"
    type="checkbox"
    id="${resolvedId}"
    name="${name}"
    value="${value}"
    checked="${checked}"
    disabled="${disabled}"
    required="${required}"
    aria-label="${ariaLabel}"
    aria-describedby="${ariaDescribedBy}"
    aria-invalid="${ariaInvalid ? "true" : null}"
    data-indeterminate="${indeterminate ? "true" : null}"
    class="peer sr-only"
    $unsafe{dataAttrsMarkup}
    $unsafe{attrs}
  >
  <%-- Visual box: aria-hidden (AT sees the real input above, not this decorative element).
       peer-* selectors drive checked/indeterminate/focus-visible/disabled appearance.
       peer-checked:     -> filled primary background + primary border.
       peer-data-[indeterminate=true]: -> filled primary background + primary border (dash shown).
       peer-focus-visible: -> --lv-ring focus shadow.
       peer-disabled:    -> opacity-[--lv-opacity-disabled] dims the box.
       peer-aria-[invalid=true]: -> destructive border colour.
       Transition covers background + border-color changes for a smooth visual response. --%>
  <span
    data-slot="checkbox-box"
    aria-hidden="true"
    class="pointer-events-none absolute inset-0
           rounded-[var(--lv-radius-sm)]
           border border-[var(--lv-color-input)]
           bg-[var(--lv-color-input)]
           peer-checked:bg-[var(--lv-color-primary)]
           peer-checked:border-[var(--lv-color-primary)]
           peer-data-[indeterminate=true]:bg-[var(--lv-color-primary)]
           peer-data-[indeterminate=true]:border-[var(--lv-color-primary)]
           peer-focus-visible:shadow-[var(--lv-ring)]
           peer-disabled:opacity-[var(--lv-opacity-disabled)]
           peer-aria-[invalid=true]:border-[var(--lv-color-destructive)]
           peer-aria-[invalid=true]:peer-checked:bg-[var(--lv-color-destructive)]
           transition-[background-color,border-color] duration-[var(--lv-duration-fast)] motion-reduce:transition-none"
  >
    <%-- Check mark SVG: visible only when peer is checked AND not indeterminate.
         peer-checked:flex reveals it; peer-data-[indeterminate=true]:hidden hides it again
         when indeterminate supersedes checked. aria-hidden (decorative; AT reads the input). --%>
    <svg
      data-slot="checkbox-check"
      aria-hidden="true"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="pointer-events-none hidden peer-checked:flex peer-data-[indeterminate=true]:hidden
             text-[var(--lv-color-primary-fg)]
             w-[0.6em] h-[0.6em]"
    >
      <polyline points="2,6 5,9 10,3"/>
    </svg>
    <%-- Dash SVG: visible only when peer has data-indeterminate=true (the mixed / tri-state glyph).
         peer-data-[indeterminate=true]:flex reveals it. aria-hidden (decorative). --%>
    <svg
      data-slot="checkbox-dash"
      aria-hidden="true"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      class="pointer-events-none hidden peer-data-[indeterminate=true]:flex
             text-[var(--lv-color-primary-fg)]
             w-[0.6em] h-[0.6em]"
    >
      <line x1="2" y1="6" x2="10" y2="6"/>
    </svg>
  </span>
</span>
