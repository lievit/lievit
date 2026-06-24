@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui field partial (v-next) -- label + control + hint + message layout wrapper.

  TIER: STATIC presentational -> JTE partial. Pure layout + the accessible label/error
  wiring; no client state. The control is supplied by the caller as a `content` Content slot.

  STRUCTURE:
    <div data-slot="field" data-layout data-size data-status>
      [label row: label partial + tooltip via label.hint]
      [hint: <p id="${controlId}-hint"> -- when hint != null]
      [control wrapper: <div data-slot="field-control"> wrapping ${content}]
      [message: <p id="${controlId}-msg" aria-live="polite"> always in DOM]
      [extra slot: <div data-slot="field-extra"> -- when extra != null]
    </div>

  A11y:
    - Label binds to control via `for` attribute; required marker is aria-hidden.
    - Hint <p> has id for aria-describedby wiring by the caller.
    - Message <p> carries aria-live="polite" and is ALWAYS in the DOM so AT registers
      it before the first message appears (no reflow-on-announce).
    - data-status cascade drives visual intent tokens at the root; CSS handles the rest.
    - `has-[:disabled]:opacity-50` dims the whole field when any descendant is disabled.

  Params:
    String controlId    REQUIRED   id of the control (primary key; used for label `for`, hint id, msg id).
    String label        = null     visible label text.
    boolean required    = false    renders a required marker on the label.
    String layout       = "vertical"   "vertical" | "horizontal" | "inline" field layout.
    String labelWidth   = null     CSS value for the label column width in horizontal layout.
    String size         = "md"     "sm" | "md" | "lg" -- size tier, propagated to label.
    String status       = null     "error" | "warning" | "success" | null -- drives data-status.
    String message      = null     status message; always in DOM as aria-live region.
    String hint         = null     helper text; rendered as <p id="${controlId}-hint">.
    String labelTooltip = null     tooltip text forwarded to the label hint param.
    String htmlFor      = null     explicit FOR override on the label (defaults to controlId).
    String cssClass     = ""       extra utility classes on the wrapper root.
    String labelCssClass = ""      extra utility classes on the label element.
    String attrs        = ""       TRUSTED raw ($unsafe) -- static author-typed strings only.
    Map<String,String> dataAttrs = {}  SAFE escaped dynamic data-* on the root.
    gg.jte.Content content   REQUIRED  the form control markup.
    gg.jte.Content leading   = null    optional element before the label text.
    gg.jte.Content extra     = null    additional content below the message region.

  Usage:
    @@template.lievit.field(
      controlId = "email", label = "Email", required = true,
      status = "error", message = errors.email(),
      hint = "We never share it.",
      content = @@`@@template.lievit.input(name = "email", id = "email",
        describedBy = "email-hint email-msg", invalid = errors.email() != null)`)
--%>
@param String controlId = null
@param String label = null
@param boolean required = false
@param String layout = "vertical"
@param String labelWidth = null
@param String size = "md"
@param String status = null
@param String message = null
@param String hint = null
@param String labelTooltip = null
@param String htmlFor = null
@param String cssClass = ""
@param String labelCssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param gg.jte.Content content = null
@param gg.jte.Content leading = null
@param gg.jte.Content extra = null

<%-- Effective id: controlId is the primary key. --%>
!{var _cid = (controlId != null && !controlId.isBlank()) ? controlId : "";}

<%-- Message slot: always in DOM for aria-live pre-registration. --%>
!{var _hasMessage = message != null && !message.isBlank();}
!{var _hasStatus = status != null && !status.isBlank();}

<%-- Hint slot. --%>
!{var _hasHint = hint != null && !hint.isBlank();}

<%-- Effective gap class between field rows. --%>
!{var _gapStyle = switch (size) {
    case "sm" -> "gap:var(--lv-space-1);";
    case "lg" -> "gap:var(--lv-space-2);";
    default   -> "gap:var(--lv-space-1-5);";
  };}

<%-- Horizontal layout label-width style. --%>
!{var _lwStyle = "horizontal".equals(layout) && labelWidth != null && !labelWidth.isBlank()
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
!{var _effectiveFor = htmlFor != null && !htmlFor.isBlank() ? htmlFor : _cid;}

<div
  data-slot="field"
  data-layout="${layout}"
  data-size="${size}"
  data-status="${status != null ? status : ""}"
  class="group/field flex data-[layout=vertical]:flex-col data-[layout=horizontal]:flex-row data-[layout=horizontal]:items-start data-[layout=inline]:flex-row data-[layout=inline]:items-center has-[:disabled]:opacity-50 ${cssClass}"
  style="${_gapStyle}${_lwStyle}"
  $unsafe{_dataAttrsMarkup}
  $unsafe{attrs}
>
  @if(label != null && !label.isBlank())
    <div data-slot="field-label-row" class="flex items-center gap-[var(--lv-space-1)]">
      @template.lievit.label(forId = _effectiveFor, content = @`${label}`, required = required, size = size, hint = labelTooltip, hintId = (labelTooltip != null ? _cid + "-label-tip" : null), cssClass = labelCssClass, leading = leading)
    </div>
  @endif

  @if(_hasHint)
    <p id="${_cid}-hint" data-slot="field-hint" class="text-[length:var(--lv-text-sm)] text-[color:var(--lv-color-muted-fg)]" style="font-family:var(--lv-font-sans);margin:0;">${hint}</p>
  @endif

  <div data-slot="field-control">
    @if(content != null)
      ${content}
    @endif
  </div>

  <p
    id="${_cid}-msg"
    data-slot="field-message"
    aria-live="polite"
    class="text-[length:var(--lv-text-sm)] ${!_hasStatus && !_hasMessage ? "sr-only" : ""}"
    style="font-family:var(--lv-font-sans);margin:0;"
  >@if(_hasMessage)${message}@endif</p>

  @if(extra != null)
    <div data-slot="field-extra">${extra}</div>
  @endif
</div>
