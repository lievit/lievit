@import gg.jte.Content
<%--
  lievit-ui :: native-select (static JTE partial)

  A token-styled wrapper around the REAL native <select> element, with a Lucide
  chevron-down indicator. This is the lightweight, form-native select: it submits with a
  plain form, needs zero JavaScript, and is fully accessible for free. It is NOT the Lit
  combobox (that ships separately as `select` / `rich-select` for the searchable,
  custom-listbox case). Mirrors shadcn's native-select wrapper, not its Radix Select.

  Tier rationale: pure presentation around a native control, no client state. JTE partial.

  SHAPE DECISION (scientific rule). shadcn/MUI/Radix/Web Awesome were compared for the
  native-select case. A custom listbox (Radix Select / Web Awesome wa-select) reimplements
  keyboard + focus + screen-reader semantics in JS and breaks no-JS form submit; the native
  <select> gets all of that from the platform and submits natively. On criteria (1) a11y and
  (3) bundle size the native element wins outright for this lightweight variant, so we style
  the native control instead of replacing it (shadcn's exact native-select approach): the
  visible chevron is an aria-hidden overlay (the native arrow is hidden via appearance-none),
  the <select> keeps its own focus ring through the wrapper's focus-within.

  OPTIONS: pass either a List<String> via `options` (each becomes an <option> whose value ==
  label) OR a `content` slot of hand-authored <option>/<optgroup> markup for value!=label,
  grouping, or per-option disabled. `content` takes precedence; this keeps the simple case a
  one-liner and the rich case fully expressive (data down, the caller owns the option markup).

  Accessibility: a real <select> with its own id/name, so a <label for> binds directly. The
  optional `label` renders a real <label for> above the control; when no visible label is
  given, pass `ariaLabel` for an accessible name. `placeholder` becomes a disabled, selected,
  hidden first <option> (the native "choose..." idiom) when no value is set. The chevron is
  decorative; the wrapper raises focus-within so keyboard users see the active field.

  Params:
    String name                  the select's name attribute.
    String id          = name    the select's id (for a <label for>); defaults to name.
    java.util.List<String> options = null  simple value==label option list.
    gg.jte.Content content = null  hand-authored <option>/<optgroup> markup (wins over options).
    String value       = null    the selected value (matched against option values).
    String label       = null    visible <label> text rendered above the control.
    String ariaLabel   = null    aria-label when there is no visible label.
    String placeholder = null    a disabled/hidden first option shown when value is empty.
    boolean disabled   = false   disables the control + dims the wrapper.
    boolean required   = false   marks the control required.
    String cssClass    = ""      extra utility classes on the wrapper.

  Usage:
    @@template.native-select(
      name = "stato", label = "Stato", placeholder = "Seleziona...",
      options = java.util.List.of("Attivo", "Sospeso", "Chiuso"), value = contatto.stato()
    )

    @@template.native-select(name = "agente", ariaLabel = "Agente", content = @@`
      <option value="">Tutti</option>
      <optgroup label="Parma">
        <option value="42">Cecchetto</option>
      </optgroup>
    `)
--%>
@param String name
@param String id = null
@param java.util.List<String> options = null
@param gg.jte.Content content = null
@param String value = null
@param String label = null
@param String ariaLabel = null
@param String placeholder = null
@param boolean disabled = false
@param boolean required = false
@param String cssClass = ""

!{var selectId = (id != null && !id.isBlank()) ? id : name;}
!{var hasValue = value != null && !value.isBlank();}

@if(label != null && !label.isBlank())
  <label for="${selectId}" data-slot="native-select-label" class="mb-[var(--lv-space-2)] block text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]" style="font-family:var(--lv-font-sans);">${label}</label>
@endif
<div
  data-slot="native-select"
  data-disabled="${disabled}"
  class="relative flex h-[var(--lv-space-10)] w-full items-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] shadow-[var(--lv-shadow-xs)] transition-shadow outline-none focus-within:border-[var(--lv-color-ring)] focus-within:shadow-[var(--lv-ring)] data-[disabled=true]:opacity-50 ${cssClass}"
>
  <select
    data-slot="native-select-control"
    id="${selectId}"
    name="${name}"
    disabled="${disabled ? "" : null}"
    required="${required ? "" : null}"
    aria-label="${ariaLabel}"
    class="h-full w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent pl-[var(--lv-space-3)] pr-[var(--lv-space-8)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
    style="font-family:var(--lv-font-sans);"
  >
    @if(placeholder != null && !placeholder.isBlank())
      <option value="" disabled hidden selected="${hasValue ? null : ""}">${placeholder}</option>
    @endif
    @if(content != null)
      ${content}
    @elseif(options != null)
      @for(String opt : options)
        <option value="${opt}" selected="${opt.equals(value) ? "" : null}">${opt}</option>
      @endfor
    @endif
  </select>
  <span aria-hidden="true" data-slot="native-select-indicator" class="pointer-events-none absolute right-[var(--lv-space-3)] flex items-center text-[var(--lv-color-muted-fg)]">
    @template.icon(name = "chevron-down", size = "1rem")
  </span>
</div>
