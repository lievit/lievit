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
  the server binds it at POST, or `l:model` binds it to a wire field for the live cases. A richer
  RANGE / multi-month / custom-calendar-grid picker is NOT this component: that is the calendar wire
  (a separate, dedicated phase) or an escape-hatch typed-TS micro-enhancement; the library's
  date-picker is exactly the native input partial.

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
  keyboard calendar and screen-reader semantics. `invalid` toggles aria-invalid + a danger border;
  `describedBy` points at an external hint/error element; `required` is the native attribute (the
  constraint, conveyed to assistive tech by the platform).

  Params:
    String  name                  the input's name attribute (POSTs the ISO date under this name).
    String  id          = name    the input's id (the <label for>); defaults to name.
    String  value       = null    current value, ISO YYYY-MM-DD.
    String  min         = null    earliest selectable date, ISO YYYY-MM-DD (native constraint).
    String  max         = null    latest selectable date, ISO YYYY-MM-DD (native constraint).
    String  label       = null    visible <label> text; rendered above the input when set.
    boolean required    = false   marks the control required (native constraint).
    boolean disabled    = false   disables + dims the control.
    boolean readonly    = false   marks the control read-only.
    boolean invalid     = false   danger border + aria-invalid="true".
    String  describedBy = null    id of an external hint/error element (aria-describedby).
    String  model       = null    l:model expression to bind this input to a wire field.
    String  cssClass    = ""      extra utility classes on the input.

  Usage:
    @@template.lievit.date-picker(name = "dataInizio", label = "Data inizio", value = today)
    @@template.lievit.date-picker(name = "scadenza", min = today, max = limit, required = true, model = "due")
--%>
@param String name
@param String id = null
@param String value = null
@param String min = null
@param String max = null
@param String label = null
@param boolean required = false
@param boolean disabled = false
@param boolean readonly = false
@param boolean invalid = false
@param String describedBy = null
@param String model = null
@param String cssClass = ""

!{var inputId = (id != null && !id.isBlank()) ? id : name;}
!{var hasLabel = label != null && !label.isBlank();}

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
        <span aria-hidden="true" class="text-[var(--lv-color-danger)]">*</span>
      @endif
    </label>
  @endif
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
    class="flex h-[var(--lv-space-10)] w-full min-w-0 rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-xs)] transition-shadow outline-none focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-[var(--lv-color-danger)] ${cssClass}"
    style="font-family:var(--lv-font-sans);"
  >
</div>
