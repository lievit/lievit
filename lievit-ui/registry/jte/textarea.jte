@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui textarea partial -- a token-styled multi-line native textarea.

  TIER: PARTIAL (l:model) + ENH (textarea-autosize.enhancer.ts -- grow-to-content +
  live char count; the irreducible client bit). The native textarea IS the textbox;
  server-first works trivially for typing. The enhancer is purely additive: with
  autosize=false and showCount=false the bare partial is a complete, accessible control.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA 1.2 textbox role (https://www.w3.org/TR/wai-aria-1.2/#textbox) -- the native
      textarea element supplies role=textbox + aria-multiline=true automatically; we do NOT add
      role="textbox" (redundant and risks de-sync). All platform keyboard behaviour is free.
    - APG practice "Providing Accessible Names and Descriptions"
      (https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) -- label for= first,
      aria-describedby for hint and count, aria-invalid (not aria-invalid="false") for errors.
    - Inventory reference: Ant Design Input.TextArea (autosize minRows/maxRows, showCount,
      maxLength, disabled/readonly/invalid states, resize control).
    - Styling: ORIGINAL generation over --lv-* (OKLCH) tokens; visual look inspired by
      Tailwind UI (NO code copied).

  A11y (WAI-ARIA textbox multi-line -- all keyboard behaviour is platform-supplied):
    - Role: implicit textbox + aria-multiline=true via the native textarea element. No added role.
    - Accessible name: EITHER a caller-provided label for= on areaId (preferred, APG Rule 2) OR
      ariaLabel param (aria-label on the element). The axe acceptance test asserts a violation
      when neither is present (WCAG 4.1.2 failure).
    - aria-describedby: space-joined from describedBy (external) + hint id + count id.
    - aria-invalid="true" when invalid=true; ABSENT (NOT "false") when invalid=false (APG).
    - aria-required: implied by native required attribute (platform exposes it automatically).
    - aria-readonly: implied by native readonly attribute (platform exposes it automatically).
    - disabled: native attribute; platform handles a11y semantics; no aria-disabled needed.
    - Character count output: included in aria-describedby (discoverable on field exploration);
      NOT a live region per keystroke (noise). The enhancer fires ONE announcer call at the
      over-limit threshold.
    - Keyboard: entirely platform-supplied; the enhancer intercepts NO keystrokes.

  Params:
    String name          the textarea name (POST field name; fallback id).
    String id            = null     explicit id; falls back to name.
    String value         = null     initial / server-pre-filled text content.
    String placeholder   = null     placeholder hint (not a label substitute).
    int rows             = 3        initial visible row count; autosize minimum when autosize=true.
    String size          = "md"     sm | md | lg -- per-row text + padding scale, toolbar-aligned.
    boolean autosize     = false    grow-to-content via the textarea-autosize enhancer.
    int minRows          = 3        autosize floor (effective when autosize=true).
    int maxRows          = 0        autosize ceiling, 0=unbounded (effective when autosize=true).
    int maxLength        = 0        native maxlength cap, 0=none.
    boolean showCount    = false    live "n / maxLength" counter below the field (enhancer).
    String hint          = null     built-in muted helper text below the field (auto aria-describedby).
    boolean invalid      = false    destructive border + ring + aria-invalid="true".
    boolean disabled     = false    native disabled attribute + dimming; removed from tab sequence.
    boolean required     = false    native required; participates in form constraint validation.
    boolean readonly     = false    native readonly; focusable + copyable, not editable.
    String model         = null     shorthand for emitting l:model on the element.
    String ariaLabel     = null     aria-label when there is no visible label for.
    String describedBy   = null     ids of EXTERNAL hint/error elements; merged into aria-describedby.
    String cssClass      = ""       extra utility classes on the textarea element.
    String attrs         = ""       TRUSTED raw ($unsafe) -- STATIC author-typed strings only
                                    (wire directives, autocomplete, spellcheck). NEVER per-row DB data.
    Map of String to String dataAttrs = {}   SAFE escaped dynamic data-* (each value via Escape.htmlAttribute).

  Usage:
    @@template.lievit.textarea(name = "note", rows = 5, value = contatto.note())
    @@template.lievit.textarea(name = "bio", placeholder = "Raccontaci...", hint = "Max 280 chars",
        maxLength = 280, showCount = true, autosize = true, minRows = 3, maxRows = 8,
        model = "bio")
--%>
@param String name
@param String id = null
@param String value = null
@param String placeholder = null
@param int rows = 3
@param String size = "md"
@param boolean autosize = false
@param int minRows = 3
@param int maxRows = 0
@param int maxLength = 0
@param boolean showCount = false
@param String hint = null
@param boolean invalid = false
@param boolean disabled = false
@param boolean required = false
@param boolean readonly = false
@param String model = null
@param String ariaLabel = null
@param String describedBy = null
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

<%-- Computed identifiers and flags. --%>
!{var areaId = (id != null && !id.isBlank()) ? id : name;}
!{var effectiveMinRows = autosize ? minRows : rows;}
!{var hasHint = hint != null && !hint.isBlank();}
!{var hasCount = showCount;}
!{var hasWrapper = hasHint || hasCount;}
!{var hintId = hasHint ? areaId + "-hint" : null;}
!{var countId = hasCount ? areaId + "-count" : null;}
!{var describedByParts = new java.util.ArrayList<String>();}
!{if (describedBy != null && !describedBy.isBlank()) { describedByParts.add(describedBy); }}
!{if (hintId != null) { describedByParts.add(hintId); }}
!{if (countId != null) { describedByParts.add(countId); }}
!{var joinedDescribedBy = describedByParts.isEmpty() ? null : String.join(" ", describedByParts);}

<%-- Size classes: text size + padding-y + padding-x + border-radius, toolbar-aligned.
     One visible row aligns with input/button of the same size (sm=32px, md=36px, lg=40px). --%>
!{var sizeClass = switch (size) {
    case "sm" -> "px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-xs)] rounded-[var(--lv-radius-sm)]";
    case "lg" -> "px-[var(--lv-space-4)] py-[var(--lv-space-3)] text-[length:var(--lv-text-base)] rounded-[var(--lv-radius-md)]";
    default   -> "px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] rounded-[var(--lv-radius-md)]";
  };}

<%-- The model directive: only emitted when model is non-blank. --%>
!{var modelDirective = (model != null && !model.isBlank()) ? "l:model=\"" + model + "\"" : "";}

<%-- SAFE dynamic data-* fragment (mirrors badge.jte / button.jte exactly).
     JTE's HTML parser forbids a raw @for in attribute-NAME position, so the fragment is
     built once here -- each entry becomes data-<key>="<escaped-value>". --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

@if(hasWrapper)
<%-- Wrapper groups textarea + hint + count when at least one sibling is present. --%>
<div
  data-slot="textarea-wrapper"
  class="flex flex-col gap-[var(--lv-space-1)]"
  style="font-family:var(--lv-font-sans);"
>
@endif
<textarea
  data-slot="textarea"
  data-size="${size}"
  data-lv-invalid="${invalid}"
  id="${areaId}"
  name="${name}"
  rows="${effectiveMinRows}"
  placeholder="${placeholder}"
  aria-label="${ariaLabel}"
  aria-describedby="${joinedDescribedBy}"
  aria-invalid="${invalid ? "true" : null}"
  aria-required="${required ? "true" : null}"
  disabled="${disabled}"
  required="${required}"
  readonly="${readonly}"
  maxlength="${maxLength > 0 ? String.valueOf(maxLength) : null}"
  data-lv-autosize="${autosize ? "" : null}"
  data-lv-min-rows="${autosize ? String.valueOf(minRows) : null}"
  data-lv-max-rows="${(autosize && maxRows > 0) ? String.valueOf(maxRows) : null}"
  data-lv-count-for="${showCount ? areaId : null}"
  $unsafe{modelDirective}
  class="w-full min-w-0 resize-y border border-[var(--lv-color-border)] bg-[var(--lv-color-input)] text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-xs)] outline-none transition-[color,box-shadow,border-color] placeholder:text-[var(--lv-color-muted-fg)] hover:border-[var(--lv-color-border)] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-[var(--lv-opacity-disabled)] disabled:text-[var(--lv-color-muted)] read-only:bg-[var(--lv-color-muted-bg)] read-only:cursor-default aria-[invalid=true]:border-[var(--lv-color-destructive)] aria-[invalid=true]:focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--lv-color-destructive)_30%,transparent)] ${sizeClass} ${cssClass}"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>${value}</textarea>
@if(hasHint)
<span
  data-slot="textarea-hint"
  id="${areaId}-hint"
  class="text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)]"
>${hint}</span>
@endif
@if(hasCount)
<output
  data-slot="textarea-count"
  id="${areaId}-count"
  for="${areaId}"
  class="text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)] self-end"
></output>
@endif
@if(hasWrapper)
</div>
@endif
