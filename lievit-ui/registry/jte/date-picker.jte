<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui date-picker partial -- a token-styled native <input type="date"> with its <label>
  (ADR-0012). The whole picker is the native control: the browser owns the calendar popup,
  keyboard grid, locale-aware formatting and validation. Zero JavaScript, no client lib, CSP-clean.
  Replaces the dropped <lv-date-picker> Lit island (which hand-built a role=grid month panel +
  @floating-ui positioning, the thin-training surface the pivot retired).

  TIER: PARTIAL (native input). There is nothing for the server to decide while the user picks a
  day, and the platform already ships an accessible, locale-aware, keyboard-navigable calendar
  behind <input type="date">; re-implementing it client-side (the island) or round-tripping each
  keystroke over the wire would both be pure cost. The value is form-submitted under `name` and
  the server binds it at POST, or `l:model` binds it to a wire field for the live cases.

  MODES: `mode="single"` (default) is one native <input type="date">. `mode="range"` renders a
  PAIRED control -- two bound native inputs (from / to) that POST under `name`/`nameTo`, sharing the
  group <label> and grouped as role="group" with aria-label so assistive tech announces them as one
  range; each input keeps its own aria-label ("<label> from" / "<label> to"). The `from` input's max
  defaults to the `to` value and the `to` input's min defaults to the `from` value, so the browser's
  native constraint keeps from <= to with zero JS. The richer multi-month / custom-calendar-grid
  range picker is NOT this component: that is the calendar wire (a separate, dedicated phase) or an
  escape-hatch typed-TS micro-enhancement; the library's date-picker is exactly the native input(s).

  STRUCTURE (scientific decision rule): the native <input type="date"> beats every alternative on
  the criteria that matter for an internal tool. a11y: the platform's date control is keyboard- and
  screen-reader-accessible out of the box and tracks OS settings, which a hand-rolled role=grid must
  re-derive and inevitably under-cover. locale: the displayed format follows the browser/OS locale
  for free (the value on the wire is always the canonical ISO YYYY-MM-DD). bundle + CSP: zero JS, no
  @floating-ui, nothing for the strict CSP to refuse. min/max/required/step are native constraint
  attributes the browser enforces. shadcn's date-picker is a popover+react-day-picker only because
  the web platform historically lacked a good native control; for a server-first library the native
  element is the correct primitive.

  A11y (native): a real <label for> names the control; the browser's date control carries its own
  keyboard calendar and screen-reader semantics. `invalid` toggles aria-invalid + a destructive border;
  `describedBy` points at an external hint/error element; `required` is the native attribute (the
  constraint, conveyed to assistive tech by the platform).

  Params:
    String  name                  the input's name attribute (POSTs the ISO date under this name).
    String  id          = name    the input's id (the <label for>); defaults to name.
    String  value       = null    current value, ISO YYYY-MM-DD.
    String  min         = null    earliest selectable date, ISO YYYY-MM-DD (native constraint).
    String  max         = null    latest selectable date, ISO YYYY-MM-DD (native constraint).
    String  label       = null    visible <label> text; rendered above the input when set.
    String  mode        = "single" "single" (one input) | "range" (paired from / to inputs).
    String  nameTo      = name+"To" range mode: the "to" input's name; defaults to `${name}To`.
    String  idTo        = nameTo   range mode: the "to" input's id; defaults to nameTo.
    String  valueTo     = null    range mode: current "to" value, ISO YYYY-MM-DD.
    String  modelTo     = null    range mode: l:model expression for the "to" input.
    String  fromLabel   = "from"  range mode: the per-input aria suffix for the "from" input.
    String  toLabel     = "to"    range mode: the per-input aria suffix for the "to" input.
    boolean required    = false   marks the control(s) required (native constraint).
    boolean disabled    = false   disables + dims the control.
    boolean readonly    = false   marks the control read-only.
    boolean invalid     = false   destructive border + aria-invalid="true".
    String  describedBy = null    id of an external hint/error element (aria-describedby).
    String  model       = null    l:model expression to bind this input to a wire field.
    String  cssClass    = ""      extra utility classes on the input.

  Usage:
    @@template.lievit.date-picker(name = "dataInizio", label = "Data inizio", value = today)
    @@template.lievit.date-picker(name = "scadenza", min = today, max = limit, required = true, model = "due")
    @@template.lievit.date-picker(name = "from", nameTo = "to", mode = "range", label = "Periodo", value = start, valueTo = end)
--%>
@param String name
@param String id = null
@param String value = null
@param String min = null
@param String max = null
@param String label = null
@param String mode = "single"
@param String nameTo = null
@param String idTo = null
@param String valueTo = null
@param String modelTo = null
@param String fromLabel = "from"
@param String toLabel = "to"
@param boolean required = false
@param boolean disabled = false
@param boolean readonly = false
@param boolean invalid = false
@param String describedBy = null
@param String model = null
@param String cssClass = ""

!{var inputId = (id != null && !id.isBlank()) ? id : name;}
!{var hasLabel = label != null && !label.isBlank();}
!{boolean isRange = "range".equals(mode);}
!{String toName = (nameTo != null && !nameTo.isBlank()) ? nameTo : name + "To";}
!{String toId = (idTo != null && !idTo.isBlank()) ? idTo : toName;}
!{String groupName = hasLabel ? label : name;}
!{
  // the shared, token-driven input chrome (one declaration, reused by every input below).
  String inputClass = "flex h-[var(--lv-space-9)] w-full min-w-0 rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-xs)] transition-shadow outline-none focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-[var(--lv-color-destructive)] " + cssClass;
}

<div data-slot="date-picker" class="flex flex-col gap-[var(--lv-space-1)]">
  @if(hasLabel)
    <label
      for="${inputId}"
      data-slot="date-picker-label"
      class="inline-flex items-center gap-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] select-none"
      style="font-family:var(--lv-font-sans);"
    >
      ${label}
      @if(required)
        <span aria-hidden="true" class="text-[var(--lv-color-destructive)]">*</span>
      @endif
    </label>
  @endif
  @if(isRange)
    <div
      data-slot="date-picker-range"
      role="group"
      aria-label="${groupName}"
      class="flex items-center gap-[var(--lv-space-2)]"
    >
      <input
        data-slot="date-picker-input-from"
        id="${inputId}"
        name="${name}"
        type="date"
        value="${value}"
        min="${min}"
        max="${valueTo != null ? valueTo : max}"
        aria-label="${groupName} ${fromLabel}"
        aria-describedby="${describedBy}"
        aria-invalid="${invalid ? "true" : null}"
        disabled="${disabled}"
        required="${required}"
        readonly="${readonly}"
        l:model="${model}"
        class="${inputClass}"
        style="font-family:var(--lv-font-sans);"
      >
      <span data-slot="date-picker-range-separator" aria-hidden="true" class="text-[var(--lv-color-muted-fg)]">&ndash;</span>
      <input
        data-slot="date-picker-input-to"
        id="${toId}"
        name="${toName}"
        type="date"
        value="${valueTo}"
        min="${value != null ? value : min}"
        max="${max}"
        aria-label="${groupName} ${toLabel}"
        aria-describedby="${describedBy}"
        aria-invalid="${invalid ? "true" : null}"
        disabled="${disabled}"
        required="${required}"
        readonly="${readonly}"
        l:model="${modelTo}"
        class="${inputClass}"
        style="font-family:var(--lv-font-sans);"
      >
    </div>
  @else
    <input
      data-slot="date-picker-input"
      id="${inputId}"
      name="${name}"
      type="date"
      value="${value}"
      min="${min}"
      max="${max}"
      aria-describedby="${describedBy}"
      aria-invalid="${invalid ? "true" : null}"
      disabled="${disabled}"
      required="${required}"
      readonly="${readonly}"
      l:model="${model}"
      class="${inputClass}"
      style="font-family:var(--lv-font-sans);"
    >
  @endif
</div>
