@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui label partial -- a native <label for="..."> with optional required marker,
  optional tag, optional hint icon (tooltip-activated), leading/trailing slots, size
  and variant (typographic only), and visually-hidden (sr-only) mode.

  TIER: PARTIAL -- pure server-rendered presentation. The platform owns click-to-focus
  activation, accessible-name computation, and FOR/ID binding. There is no client state
  and no enhancer (WAI-ARIA APG names-and-descriptions: native <label> is the entire
  a11y contract; no WAI-ARIA widget pattern exists for <label>).

  STRUCTURE (scientific decision rule):
    WAI-ARIA APG "Providing Accessible Names and Descriptions"
    (https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) + WCAG H44
    (https://www.w3.org/WAI/WCAG21/Techniques/html/H44) + HTML spec label element.
    Native <label> is the only required mechanism; no ARIA role is added.
    Required marker: glyph with aria-hidden="true" + sr-only sibling text " (required)"
    so the marker is visually red but announced as plain text to screen readers.
    Optional tag: plain visible "(optional)" text inside the label, part of accessible name.
    Hidden label: sr-only class (absolute+clipped), never display:none (which breaks FOR/ID).
    Hint icon: composed via @template.lievit.tooltip so the adopter does not hand-roll
    popover positioning (architecture contract §2.b single-source shared mechanism).
    Inventory reference: Ant Design Form.Item label region (required marker, optional tag,
    hint icon, bold variant).
    Styling: ORIGINAL generation over --lv-* (OKLCH) tokens; look inspired by Tailwind UI
    form label conventions (NO code copied).

  A11y (WAI-ARIA platform -- no widget pattern):
    - Native <label> element: no explicit role needed or added (implicit "generic").
    - FOR/ID binding: the platform derives the control's accessible name from this label.
    - Required marker: aria-hidden="true" on the * glyph; sr-only sibling " (required)"
      becomes part of the label's text and thus part of the control's accessible name.
    - Optional tag: visible text "(optional)"; no extra ARIA annotation (plain text in name).
    - Hint icon: aria-hidden="true" on the icon span; tooltip's aria-describedby is wired
      on the CONTROL by the consuming field partial using hintId, not on this label.
    - Hidden label (hidden=true): class="sr-only" (position:absolute;clip;...), NOT
      aria-hidden="true" and NOT display:none (either would break the FOR/ID binding).
    - The label itself is NOT focusable (tabindex is never added).
    - WCAG: 1.3.1 (FOR/ID programmatic relationship), 4.1.2 (accessible name via binding),
      2.4.6 (descriptive label -- content responsibility of the adopter).
      3.3.2 is NOT fully satisfied when hidden=true (the consuming field must document it).

  Params:
    String forId            null          id of the associated control; renders <label for>.
                                          When null: label wraps its content (implicit assoc).
    boolean required        false         shows a * in --lv-color-destructive (aria-hidden)
                                          + sr-only " (required)" sibling (part of acc. name).
    boolean optional        false         shows "(optional)" tag in --lv-color-muted-fg.
                                          Mutually exclusive with required; required wins.
    String hint             null          tooltip text for the hint icon (circle-help).
                                          When null, no hint icon is rendered.
    String hintId           null          id for the tooltip bubble (used as aria-describedby
                                          on the CONTROL by the consuming field). Ignored when
                                          hint is null.
    String size             "md"          "sm" | "md" | "lg" -- text size + line-height tier
                                          matching the associated control's size.
    String variant          "default"     "default" | "bold" -- typographic weight only.
                                          default: --lv-font-medium. bold: --lv-font-semibold.
    boolean hidden          false         visually hides the label (sr-only class). The FOR/ID
                                          binding + accessible name remain intact.
    String cssClass         ""            extra utility classes on the label root.
    String attrs            ""            TRUSTED raw ($unsafe) -- STATIC author-typed strings
                                          only (e.g. data-testid="name-label"). Never fed
                                          per-row or user-derived data.
    Map of String to String dataAttrs     SAFE escaped dynamic data-* attributes; each value
                                          through Escape.htmlAttribute.
    gg.jte.Content content  --            MANDATORY. The visible label text (and optional inline
                                          leading icon). A label with no visible text is an a11y
                                          violation -- ensure content is always provided.
    gg.jte.Content leading  null          optional element BEFORE the label text (e.g. a status
                                          dot); wrapped in a span with aria-hidden="true".
    gg.jte.Content trailing null          optional element AFTER the label text and BEFORE the
                                          required/optional marker (e.g. a badge).

  Usage:
    @@template.lievit.label(forId = "email", required = true,
      content = @@`Email`)
    @@template.lievit.label(forId = "note", optional = true, size = "sm",
      content = @@`Note`)
    @@template.lievit.label(forId = "desc", hint = "Max 200 characters", hintId = "desc-hint",
      content = @@`Description`)
    @@template.lievit.label(forId = "name", hidden = true,
      content = @@`Full name`)
    @@template.lievit.label(forId = "header", variant = "bold",
      content = @@`Section heading`)
--%>
@param String forId = null
@param boolean required = false
@param boolean optional = false
@param String hint = null
@param String hintId = null
@param String size = "md"
@param String variant = "default"
@param boolean hidden = false
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param gg.jte.Content content
@param gg.jte.Content leading = null
@param gg.jte.Content trailing = null

<%-- Size -> text-size + line-height token classes (spec §3 + §5 token table).
     Note: --lv-leading-4/5/6 do not exist in the token file; using --lv-leading (1.5)
     as the closest available token for all sizes (TOKENS_NEEDED: --lv-leading-4, -5, -6). --%>
!{var sizeClass = switch (size) {
    case "sm" -> "text-[length:var(--lv-text-xs)] leading-[var(--lv-leading)]";
    case "lg" -> "text-[length:var(--lv-text-base)] leading-[var(--lv-leading)]";
    default   -> "text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)]";
  };}

<%-- Variant -> font-weight token class (spec §3 variants).
     Note: --lv-font-weight-medium / --lv-font-weight-semibold do not exist; using
     --lv-font-medium / --lv-font-semibold (the actual token names in lievit-tokens.css). --%>
!{var weightClass = "bold".equals(variant)
    ? "font-[var(--lv-font-semibold)]"
    : "font-[var(--lv-font-medium)]";}

<%-- Hidden label: the sr-only CSS pattern (absolute+clipped, position:absolute,
     width:1px, height:1px, padding:0, margin:-1px, overflow:hidden, clip:rect(0,0,0,0),
     white-space:nowrap, border-width:0). Never display:none (breaks FOR/ID a11y binding). --%>
!{var hiddenClass = hidden ? "sr-only" : "";}

<%-- SAFE dynamic data-* attributes: each value escaped via Escape.htmlAttribute.
     Keys must be simple identifiers ([A-Za-z][A-Za-z0-9-]*); non-identifier keys dropped. --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var _dataAttrsMarkup = dataAttrs_.toString();}

<label
  for="${forId}"
  data-slot="label"
  data-size="${size}"
  data-variant="${variant}"
  data-required="${required ? "true" : "false"}"
  class="inline-flex items-center gap-[var(--lv-space-1)] select-none text-[color:var(--lv-color-fg)] ${sizeClass} ${weightClass} ${hiddenClass} ${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{_dataAttrsMarkup}
  $unsafe{attrs}
>
  @if(leading != null)
    <span data-slot="label-leading" aria-hidden="true">${leading}</span>
  @endif

  <span data-slot="label-content">${content}</span>

  @if(trailing != null)
    <span data-slot="label-trailing">${trailing}</span>
  @endif

  @if(required)
    <span aria-hidden="true" data-slot="label-required"
          class="ml-[var(--lv-space-1)] text-[color:var(--lv-color-destructive)]">*</span>
    <span class="sr-only"> (required)</span>
  @endif

  @if(optional && !required)
    <span data-slot="label-optional"
          class="ml-[var(--lv-space-1)] font-[var(--lv-font-medium)] text-[color:var(--lv-color-muted-fg)]">(optional)</span>
  @endif

  @if(hint != null && !hint.isBlank())
    @template.lievit.tooltip(
      id = (hintId != null && !hintId.isBlank() ? hintId : "label-hint"),
      content = hint,
      delay = 0,
      trigger = @`<span aria-hidden="true" data-slot="label-hint-icon"
            class="ml-[var(--lv-space-2)] inline-flex items-center">@template.lievit.icon(name = "circle-help", size = "var(--lv-text-sm)", cssClass = "text-[color:var(--lv-color-muted-fg)]")</span>`
    )
  @endif
</label>
