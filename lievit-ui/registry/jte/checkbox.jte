@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui checkbox partial -- a token-styled native <input type="checkbox">.

  TIER: STATIC presentational -> JTE partial. The native checkbox carries role=checkbox, Space
  activation and the checked/disabled semantics for free; there is no client state. The native
  element submits its `value` (default "on") ONLY when checked and is absent from FormData when
  unchecked -- native checkbox semantics the Lit island had to reimplement. `l:model` binds the
  native change event on the element.

  STRUCTURE (scientific decision rule): shadcn's Checkbox is a Radix button reimplementing the
  checkbox role in JS (it breaks JS-off form submit). For a server-first stack the native
  <input type=checkbox> wins outright on a11y, bundle and no-JS POST, so we style the native
  control with `appearance-none` + a token-coloured box and an inline SVG check via the icon
  partial (a `peer` + `peer-checked` reveal), shadcn's exact visual without its JS.

  A11y (WAI-ARIA APG checkbox): a real <input type=checkbox> with its own id/name. An external
  <label for> (or the optional inline `label`) names it; `ariaLabel` provides an accessible name
  when neither is present. The check glyph is decorative (aria-hidden, icon partial). `invalid`
  toggles aria-invalid="true" + a danger box border so assistive tech is told about the validation
  state. `indeterminate` renders aria-checked="mixed" + a dash glyph (the tri-state checkbox used
  for "some children selected"); the native `.indeterminate` DOM property is set by the optional
  enhancer / wire runtime from data-indeterminate, since it has no HTML attribute.

  EXTRA ATTRIBUTES -- the SAFE escaped dataAttrs channel (mirrors button.jte exactly). A checkbox
  in a reactive list (a calendar filter row, a per-row selector) needs a dynamic data-* the wire
  runtime reads (a filter key, a row id) -- a value that is DB/user-derived and so cannot ride a
  trusted raw string. gest's calendar filter checkboxes routed such a value through a hand-rolled
  `attrs` $unsafe, which is XSS surface. dataAttrs is the escaped channel: a SAFE Map<String,String>
  of DYNAMIC data-* attributes rendered on the native <input>, each entry data-<key>="<value>" with
  the VALUE escaped through JTE's OWN attribute escaper gg.jte.html.escape.Escape.htmlAttribute (the
  exact routine ContentType.Html applies to a ${} in attribute-value position), so a hostile value
  renders inert. This is the ONLY safe way to carry user/DB-derived data on the control. Keys are
  the data-attribute name WITHOUT the leading "data-" (key "filter" -> data-filter); keep keys to
  simple identifiers ([A-Za-z][A-Za-z0-9-]*) -- the key sits in attribute-NAME position, which JTE
  does not escape, so a non-identifier key is dropped. Empty by default; left empty nothing is added.

  Params:
    String name                 the checkbox's name (POSTs `value` under this name when checked).
    String id          = name   the checkbox's id (for a <label for>); defaults to name.
    String value       = "on"   submitted value when checked (native default "on").
    boolean checked    = false  initial checked state.
    boolean indeterminate = false  tri-state "mixed": dash glyph + aria-checked="mixed" + data-indeterminate.
    boolean disabled   = false  disables + dims the control.
    boolean required   = false  marks the control required.
    boolean invalid    = false  danger border + aria-invalid="true".
    String label       = null   optional inline label rendered after the box (wraps in a <label>).
    String ariaLabel   = null   aria-label when there is no visible label.
    String describedBy = null   id of an external hint/error element (aria-describedby).
    String model       = null   l:model expression to bind this checkbox to a wire field.
    String cssClass    = ""      extra utility classes on the wrapper.
    Map<String,String> dataAttrs = {}  SAFE dynamic data-* on the native <input> (key w/o "data-",
                                  simple identifier); each value escaped via Escape.htmlAttribute.

  Usage:
    @@template.lievit.checkbox(name = "attivo", label = "Attivo", checked = contatto.attivo())
    @@template.lievit.checkbox(name = "consenso", ariaLabel = "Consenso", model = "consenso")
    @@template.lievit.checkbox(name = "all", label = "Select all", indeterminate = someSelected)
    (a reactive-list filter checkbox carrying a SAFE escaped row key -- no $unsafe attrs):
    @@template.lievit.checkbox(name = "kind", label = kind.label(),
      dataAttrs = java.util.Map.of("filter", kind.key()))
--%>
@param String name
@param String id = null
@param String value = "on"
@param boolean checked = false
@param boolean indeterminate = false
@param boolean disabled = false
@param boolean required = false
@param boolean invalid = false
@param String label = null
@param String ariaLabel = null
@param String describedBy = null
@param String model = null
@param String cssClass = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

!{var boxId = (id != null && !id.isBlank()) ? id : name;}
!{var hasLabel = label != null && !label.isBlank();}

<%-- SAFE dynamic data-* attributes (mirrors button.jte): JTE's HTML parser forbids a raw @for in
     attribute-NAME position, so the fragment is built once here -- each entry becomes
     data-<key>="<value>" with the VALUE escaped through JTE's OWN attribute escaper
     (Escape.htmlAttribute, the same routine ContentType.Html applies to a ${} in attribute-value
     position), then emitted with $unsafe on the <input> -- safe because every value is already
     escaped. Keys must be simple identifiers (the key sits in attribute-NAME position, which is
     NOT escaped); a non-identifier key is dropped so it can never inject markup. --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<label
  for="${boxId}"
  data-slot="checkbox"
  data-disabled="${disabled}"
  data-invalid="${invalid ? "true" : null}"
  class="inline-flex items-center gap-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] select-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  <span class="relative inline-flex size-[var(--lv-space-4)] shrink-0 items-center justify-center">
    <input
      data-slot="checkbox-control"
      type="checkbox"
      id="${boxId}"
      name="${name}"
      value="${value}"
      checked="${checked}"
      disabled="${disabled}"
      required="${required}"
      aria-label="${ariaLabel}"
      aria-describedby="${describedBy}"
      aria-invalid="${invalid ? "true" : null}"
      aria-checked="${indeterminate ? "mixed" : null}"
      data-indeterminate="${indeterminate ? "true" : null}"
      l:model="${model}"
      $unsafe{dataAttrsMarkup}
      class="peer size-full cursor-pointer appearance-none rounded-[var(--lv-radius-sm)] border-2 border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] shadow-[var(--lv-shadow-xs)] outline-none transition-shadow checked:border-[var(--lv-color-primary)] checked:bg-[var(--lv-color-primary)] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed aria-[invalid=true]:border-[var(--lv-color-danger)] aria-[invalid=true]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--lv-color-destructive)_20%,transparent)] data-[indeterminate=true]:border-[var(--lv-color-primary)] data-[indeterminate=true]:bg-[var(--lv-color-primary)]"
    >
    <span data-slot="checkbox-indicator" aria-hidden="true" class="pointer-events-none absolute hidden text-[var(--lv-color-primary-fg)] peer-checked:flex peer-data-[indeterminate=true]:hidden">
      @template.lievit.icon(name = "check", size = "0.75rem")
    </span>
    <span data-slot="checkbox-indicator" aria-hidden="true" class="pointer-events-none absolute hidden text-[var(--lv-color-primary-fg)] peer-data-[indeterminate=true]:flex">
      @template.lievit.icon(name = "minus", size = "0.75rem")
    </span>
  </span>
  @if(hasLabel)
    <span data-slot="checkbox-label">${label}</span>
  @endif
</label>
