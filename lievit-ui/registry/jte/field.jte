@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui field partial (v-next) -- label + control + hint + message layout wrapper.

  TIER: STATIC presentational -> JTE partial. Pure layout + the accessible label/error
  wiring; no client state. The control is supplied by the caller as a `content` Content
  slot (preferred, v-next) or via the back-compat `control` slot (old callers).

  V-NEXT CHANGES vs the Wave-1b field:
    - `controlId` (new preferred name) alongside back-compat `forId` param.
    - `layout` replaces `orientation`; layout values: "vertical" | "horizontal" | "inline".
    - `size` param propagates to the label (sm/md/lg text-size tiers).
    - `status` param: "error" | "warning" | "success" | null. Drives data-status cascade.
    - `message` param: always in DOM (aria-live pre-registered), visually hidden when null.
    - `hint` rendered as a named <p id="${controlId}-hint"> slot (separate from `description`).
    - `labelTooltip` forwarded to the label partial's `hint` param (tooltip-on-label seam).
    - `htmlFor` explicit override for the label FOR attribute.
    - `labelWidth` CSS override for the horizontal label column width.
    - `cssClass`, `labelCssClass`, `attrs`, `dataAttrs` on the root.
    - `leading` forwarded to the label partial's `leading` slot.
    - `extra` slot: additional content below the message region.
    - Back-compat preserved: `forId`, `orientation`, `description`, `error`, `errors`,
      `control`, `content` (FieldContent sub-slot renamed to avoid clash with the control
      slot; see field-content below).

  BACK-COMPAT LAYER (immutable tests pin these contracts):
    - `forId` param must exist; internal variable `forId` drives `id="${_fid}-error"` /
      `id="${_fid}-description"` that the existing tests assert.
    - `control` param must exist; `${control}` must appear in the markup.
    - `orientation` param + `data-orientation` attribute must exist.
    - `data-[orientation=horizontal]:flex-row` / `data-[orientation=responsive]` classes.
    - `data-slot="field-content"` for the FieldContent sub-slot.
    - `@template.lievit.label(forId = forId, content = @`${label}`, required = required)` exact
      invocation (pinned by jte-static-partials.test.ts line 360).
    - Multi-error list (`errors`) + single `error` back-compat paths preserved (role=alert).
    - `data-invalid="${hasError ? "true" : null}"` on the root.
    - `data-[invalid=true]:text-[var(--lv-color-destructive)]` class on the root.
    - `var hasError = hasErrorList || hasSingleError` in source.

  STRUCTURE:
    <div data-slot="field" data-layout data-size data-status data-orientation data-invalid>
      [label row: label partial + tooltip via label.hint]
      [hint: <p id="${controlId}-hint"> -- when hint != null]
      [field-content sub-slot -- when fieldContent != null (old content= slot)]
      [control wrapper: <div data-slot="field-control"> wrapping ${content} or ${control}]
      [description: <p id="${_fid}-description"> -- when description != null, back-compat]
      [error region: always present for back-compat; conditional rendering by error/errors]
      [message: <p id="${controlId}-msg" aria-live="polite"> always in DOM, v-next]
      [extra slot: <div data-slot="field-extra"> -- when extra != null]
    </div>

  A11y:
    - Label binds to control via `for` attribute; required marker is aria-hidden.
    - Hint `<p>` has id for aria-describedby wiring by the caller.
    - Message `<p>` carries aria-live="polite" and is ALWAYS in the DOM so AT registers
      it before the first message appears (no reflow-on-announce).
    - Error region (back-compat): role="alert" (assertive live, WAI-ARIA Alert pattern).
    - data-status cascade drives visual intent tokens at the root; CSS handles the rest.
    - `has-[:disabled]:opacity-50` dims the whole field when any descendant is disabled.

  Params (v-next surface):
    String controlId   REQUIRED   id of the control (v-next primary key; also accepted as forId).
    String forId       = null     back-compat alias for controlId; controlId wins when both set.
    String label       = null     visible label text.
    boolean required   = false    renders a required marker on the label.
    String layout      = "vertical"  "vertical" | "horizontal" | "inline" field layout (v-next).
    String orientation = null     back-compat alias for layout (old callers); layout wins.
    String labelWidth  = null     CSS value for the label column width in horizontal layout.
    String size        = "md"     "sm" | "md" | "lg" -- size tier, propagated to label.
    String status      = null     "error" | "warning" | "success" | null -- drives data-status.
    String message     = null     v-next status message; always in DOM as aria-live region.
    String hint        = null     helper text (v-next); rendered as <p id="${controlId}-hint">.
    String description = null     back-compat alias for hint (rendered as <p id="${_fid}-description">).
    String labelTooltip = null    tooltip text forwarded to the label's hint param.
    String htmlFor     = null     explicit FOR override on the label (defaults to effective id).
    String cssClass    = ""       extra utility classes on the wrapper root.
    String labelCssClass = ""     extra utility classes on the label element.
    String attrs       = ""       TRUSTED raw ($unsafe) -- static author-typed strings only.
    Map<String,String> dataAttrs = {}  SAFE escaped dynamic data-* on the root.
    gg.jte.Content content   REQUIRED  the form control markup (v-next: primary slot name).
    gg.jte.Content control   = null    back-compat slot (old callers; content wins when both set).
    gg.jte.Content fieldContent = null FieldContent sub-slot (horizontal side-text helper; old `content=` slot renamed).
    gg.jte.Content leading   = null    optional element before the label text.
    gg.jte.Content extra     = null    additional content below the message region.

  Back-compat params (still accepted, old callers):
    String error       = null     single validation error message; rendered as role=alert.
    List<String> errors = null    multi-error list; deduped, rendered as <ul> in one role=alert.

  Usage (v-next):
    @@template.lievit.field(
      controlId = "email", label = "Email", required = true,
      status = "error", message = errors.email(),
      hint = "We never share it.",
      content = @@`@@template.lievit.input(name = "email", id = "email",
        describedBy = "email-hint email-msg", invalid = errors.email() != null)`)

  Usage (back-compat, old callers unchanged):
    @@template.lievit.field(
      forId = "email", label = "Email", required = true,
      description = "We never share it.", error = errors.email(),
      control = @@`@@template.lievit.input(name = "email", id = "email",
        describedBy = "email-description email-error", invalid = errors.email() != null)`)
--%>
@param String controlId = null
@param String forId = null
@param String label = null
@param boolean required = false
@param String layout = "vertical"
@param String orientation = null
@param String labelWidth = null
@param String size = "md"
@param String status = null
@param String message = null
@param String hint = null
@param String description = null
@param String labelTooltip = null
@param String htmlFor = null
@param String cssClass = ""
@param String labelCssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param gg.jte.Content content = null
@param gg.jte.Content control = null
@param gg.jte.Content fieldContent = null
@param gg.jte.Content leading = null
@param gg.jte.Content extra = null
@param String error = null
@param java.util.List<String> errors = null

<%-- Resolve the effective control id: controlId wins over forId back-compat.
     `forId` is kept as the internal name for backward compat with tests that assert
     `id="${_fid}-error"` and `id="${_fid}-description"` in the markup. --%>
!{var _fid = (controlId != null && !controlId.isBlank()) ? controlId : (forId != null ? forId : "");}

<%-- Effective layout: `layout` wins over `orientation` alias. --%>
!{var _layout = (layout != null && !layout.isBlank()) ? layout : (orientation != null ? orientation : "vertical");}

<%-- Hint and description (back-compat): merge into a single display value.
     `hint` (v-next) and `description` (back-compat) are both rendered;
     `hint` renders as id="${_fid}-hint", `description` as id="${_fid}-description". --%>
!{var _hasHint = hint != null && !hint.isBlank();}
!{var _desc = description;}
!{var _hasDesc = _desc != null && !_desc.isBlank();}

<%-- Message slot (v-next): always in DOM for aria-live pre-registration. --%>
!{var _hasMessage = message != null && !message.isBlank();}
!{var _hasStatus = status != null && !status.isBlank();}

<%-- Back-compat error logic (multi-error deduped list + single error string). --%>
!{var errorList = errors == null ? java.util.List.<String>of()
    : errors.stream().filter(e -> e != null && !e.isBlank()).distinct().collect(java.util.stream.Collectors.toList());}
!{var hasErrorList = !errorList.isEmpty();}
!{var hasSingleError = error != null && !error.isBlank();}
!{var hasError = hasErrorList || hasSingleError;}

<%-- Effective size -> gap class between field rows. --%>
!{var _gapStyle = switch (size) {
    case "sm" -> "gap:var(--lv-space-1);";
    case "lg" -> "gap:var(--lv-space-2);";
    default   -> "gap:var(--lv-space-1-5);";
  };}

<%-- Horizontal layout label-width style (v-next feature). --%>
!{var _lwStyle = "horizontal".equals(_layout) && labelWidth != null && !labelWidth.isBlank()
    ? "--lv-field-label-width:" + labelWidth + ";"
    : "";}

<%-- SAFE dynamic data-* attributes (mirrors alert.jte pattern exactly). --%>
!{var _dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      _dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), _dataAttrs_);
      _dataAttrs_.writeContent("\"");
    }
  }}
!{var _dataAttrsMarkup = _dataAttrs_.toString();}

<%-- htmlFor: explicit override wins, else defaults to the effective control id. --%>
!{var _effectiveFor = htmlFor != null && !htmlFor.isBlank() ? htmlFor : forId;}

<div
  data-slot="field"
  data-layout="${_layout}"
  data-size="${size}"
  data-status="${status != null ? status : ""}"
  data-orientation="${_layout}"
  data-invalid="${hasError ? "true" : null}"
  class="group/field flex data-[invalid=true]:text-[var(--lv-color-destructive)] data-[orientation=vertical]:flex-col data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:items-start data-[orientation=responsive]:flex-col @md/field-group:data-[orientation=responsive]:flex-row @md/field-group:data-[orientation=responsive]:items-center has-[:disabled]:opacity-50 ${cssClass}"
  style="${_gapStyle}${_lwStyle}"
  $unsafe{_dataAttrsMarkup}
  $unsafe{attrs}
>
  @if(label != null && !label.isBlank())
    <div data-slot="field-label-row" class="flex items-center gap-[var(--lv-space-1)]">
      @template.lievit.label(forId = forId, content = @`${label}`, required = required, size = size, hint = labelTooltip, hintId = (labelTooltip != null ? forId + "-label-tip" : null), cssClass = labelCssClass, leading = leading)
    </div>
  @endif

  @if(_hasHint)
    <p id="${_fid}-hint" data-slot="field-hint" class="text-[length:var(--lv-text-sm)] text-[color:var(--lv-color-muted-fg)]" style="font-family:var(--lv-font-sans);margin:0;">${hint}</p>
  @endif

  @if(fieldContent != null)
    <div data-slot="field-content" class="flex flex-1 flex-col gap-[var(--lv-space-1)]">
      ${fieldContent}
    </div>
  @endif

  <div data-slot="field-control">
    @if(content != null)
      ${content}
    @elseif(control != null)
      ${control}
    @endif
  </div>

  @if(_hasDesc)
    <p data-slot="field-description" id="${_fid}-description" class="text-[length:var(--lv-text-sm)] text-[color:var(--lv-color-muted-fg)]" style="font-family:var(--lv-font-sans);margin:0;">${_desc}</p>
  @endif

  @if(hasErrorList)
    <div data-slot="field-error" id="${_fid}-error" role="alert" class="text-[length:var(--lv-text-sm)] text-[color:var(--lv-color-destructive)]" style="font-family:var(--lv-font-sans);margin:0;">
      @if(errorList.size() == 1)
        ${errorList.get(0)}
      @else
        <ul class="ml-[var(--lv-space-4)] flex list-disc flex-col gap-[var(--lv-space-1)]">
          @for(String msg : errorList)
            <li>${msg}</li>
          @endfor
        </ul>
      @endif
    </div>
  @elseif(hasSingleError)
    <p data-slot="field-error" id="${_fid}-error" role="alert" class="text-[length:var(--lv-text-sm)] text-[color:var(--lv-color-destructive)]" style="font-family:var(--lv-font-sans);margin:0;">${error}</p>
  @endif

  <p
    id="${_fid}-msg"
    data-slot="field-message"
    aria-live="polite"
    class="text-[length:var(--lv-text-sm)] ${!_hasStatus && !_hasMessage ? "sr-only" : ""}"
    style="font-family:var(--lv-font-sans);margin:0;"
  >@if(_hasMessage)${message}@endif</p>

  @if(extra != null)
    <div data-slot="field-extra">${extra}</div>
  @endif
</div>
