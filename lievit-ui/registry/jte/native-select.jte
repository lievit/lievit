@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui native-select partial -- token-styled wrapper around the native <select> element.

  TIER: PARTIAL -- pure presentation, zero client state. The native <select> carries role=listbox,
  full keyboard interaction, accessible-name binding, and form submission for free from the
  platform. No enhancer is created or needed: this is the canonical exemplar of "prefer a real
  native element" (architecture contract §2.a).

  STRUCTURE (scientific decision rule):
    - WAI-ARIA APG Listbox native-select baseline: the native <select> IS a conformant listbox;
      no custom role is emitted; the platform supplies all keyboard interaction identically to
      the APG scrollable-listbox keyboard map (https://www.w3.org/WAI/ARIA/apg/patterns/listbox/).
    - Inventory reference: Ant Design Select (native variant) -- sizes, placeholder, groups,
      disabled options, required, invalid; shadcn native-select structural idiom: style the native
      element, do not replace it (appearance-none to suppress the OS arrow, decorative chevron
      overlay with aria-hidden).
    - Option authoring: three paths with explicit precedence (content > optionGroups > options).
      Simple value==label list -> options. Typed grouped list -> optionGroups (native <optgroup>).
      Hand-authored <option>/<optgroup> markup (value!=label, per-option disabled, metadata) ->
      content slot.
    - Styling: ORIGINAL generation over --lv-* (OKLCH) tokens; look inspired by Tailwind UI
      (NO code copied).

  A11y (WAI-ARIA APG Listbox -- native platform select):
    - role: implicit role=listbox on <select>, role=option on <option>, role=group on <optgroup>;
      no custom role emitted -- the platform supplies all.
    - aria-label: on <select> when no visible <label> is present; not emitted when null.
    - aria-invalid: on <select> when invalid=true; absent otherwise.
    - required / disabled: native boolean attributes on <select>; platform supplies AT semantics.
    - chevron <span>: aria-hidden="true" (decorative visual indicator).
    - accessible-name: <label for="{selectId}"> is the preferred path (platform binds the name);
      aria-label is the fallback for label-free contexts.
    - focus ring: wrapper uses CSS focus-within so keyboard users see the active control border +
      ring without a custom focus handler; the <select> keeps its native focus for AT.
    - keyboard: entirely platform-supplied (Tab, arrows, Home, End, type-ahead, Space/Enter/Esc);
      no enhancer is created or needed.

  SIZE (toolbar-aligned per architecture contract §5.b -- form controls use height-based scale):
    sm     -> h-[var(--lv-space-8)]  (32px)  compact toolbar, filter row
    md     -> h-[var(--lv-space-9)]  (36px)  standard form; THE default; shadcn baseline
    lg     -> h-[var(--lv-space-10)] (40px)  prominent / standalone field
    default -> h-[var(--lv-space-9)] (36px)  back-compat alias of md
  A button, input, and native-select of the same size sit flush-aligned in a toolbar row.

  Params:
    String name                                      the <select name>; doubles as default id.
    String id                       = name           <select id> for <label for>; defaults to name.
    java.util.List<String> options  = null           simple flat list: value == label.
    java.util.Map<String, java.util.List<String>> optionGroups = null
                                                     group label to option labels; renders <optgroup>.
                                                     Overrides options; ignored when content is set.
    gg.jte.Content content          = null           hand-authored <option>/<optgroup> slot;
                                                     wins over options and optionGroups.
    String value                    = null           currently selected option value; server-matched.
    String label                    = null           renders a real <label for=selectId> above the
                                                     control; the preferred accessible-name path.
    String ariaLabel                = null           aria-label on <select>; required when label is null.
    String placeholder              = null           disabled hidden first option shown when no value set.
    String size                     = "md"           "sm" | "md" | "lg" height scale; "default" = "md".
    boolean disabled                = false          native disabled + dims wrapper.
    boolean required                = false          native required; HTML5 constraint validation.
    boolean invalid                 = false          aria-invalid + destructive border + ring.
    String model                    = null           l:model expression (change -> wire field setter).
    String cssClass                 = ""             extra utility classes on the outer wrapper.

  Escaping channels:
    label, ariaLabel, placeholder, size, cssClass, name, id, value, model -> JTE ${} (attr-escaped).
    options / optionGroups -> option + group labels through JTE ${} (attr-escaped).
    content -> gg.jte.Content slot; caller-authored markup; no raw-injection path via JTE's type system.
    No attrs trusted-raw channel: this partial has no per-row dynamic wire action.

  Usage:
    @@template.lievit.native-select(
      name = "stato", label = "Stato", placeholder = "Seleziona...", size = "md",
      options = java.util.List.of("Attivo", "Sospeso", "Chiuso"), value = contatto.stato()
    )

    @@template.lievit.native-select(
      name = "citta", label = "Citta",
      optionGroups = java.util.Map.of("Emilia", java.util.List.of("Parma", "Reggio"),
                                      "Lombardia", java.util.List.of("Milano"))
    )

    @@template.lievit.native-select(name = "agente", ariaLabel = "Agente", content = @@`
      <option value="">Tutti</option>
      <optgroup label="Parma">
        <option value="42">Cecchetto</option>
      </optgroup>
    `)

    @@template.lievit.native-select(
      name = "regione", label = "Regione", size = "sm",
      options = java.util.List.of("Emilia-Romagna", "Lombardia"), model = "regione"
    )
--%>
@param String name = null
@param String id = null
@param java.util.List<String> options = null
@param java.util.Map<String, java.util.List<String>> optionGroups = null
@param gg.jte.Content content = null
@param String value = null
@param String label = null
@param String ariaLabel = null
@param String placeholder = null
@param String size = "md"
@param boolean disabled = false
@param boolean required = false
@param boolean invalid = false
@param String model = null
@param String cssClass = ""

!{var selectId = (id != null && !id.isBlank()) ? id : name;}
!{var hasValue = value != null && !value.isBlank();}
!{var hasAriaLabel = ariaLabel != null && !ariaLabel.isBlank();}

@if(label != null && !label.isBlank())
<label
  for="${selectId}"
  data-slot="native-select-label"
  class="mb-[var(--lv-space-2)] block text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]"
  style="font-family:var(--lv-font-sans);"
>${label}</label>
@endif
<div
  data-slot="native-select-wrapper"
  data-disabled="${disabled}"
  data-invalid="${invalid}"
  data-size="${size}"
  class="relative flex w-full items-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] shadow-[var(--lv-shadow-xs)] transition-[color,box-shadow] outline-none focus-within:border-[var(--lv-color-ring)] focus-within:shadow-[var(--lv-ring)] data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:pointer-events-none data-[invalid=true]:border-[var(--lv-color-destructive)] data-[invalid=true]:shadow-[0_0_0_3px_color-mix(in_oklch,var(--lv-color-destructive)_20%,transparent)] data-[size=sm]:h-[var(--lv-space-8)] data-[size=md]:h-[var(--lv-space-9)] data-[size=default]:h-[var(--lv-space-9)] data-[size=lg]:h-[var(--lv-space-10)] ${cssClass}"
>
  <select
    data-slot="native-select"
    id="${selectId}"
    name="${name}"
    disabled="${disabled}"
    required="${required}"
    aria-label="${hasAriaLabel ? ariaLabel : null}"
    aria-invalid="${invalid ? "true" : null}"
    l:model="${model}"
    class="h-full w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent pl-[var(--lv-space-3)] pr-[var(--lv-space-8)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] outline-none focus:outline-none focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed"
    style="font-family:var(--lv-font-sans);"
  >
    @if(placeholder != null && !placeholder.isBlank())
      <option value="" disabled hidden selected="${!hasValue}">${placeholder}</option>
    @endif
    @if(content != null)
      ${content}
    @elseif(optionGroups != null)
      @for(java.util.Map.Entry<String, java.util.List<String>> grp : optionGroups.entrySet())
        <optgroup label="${grp.getKey()}">
          @for(String opt : grp.getValue())
            <option value="${opt}" selected="${opt.equals(value)}">${opt}</option>
          @endfor
        </optgroup>
      @endfor
    @elseif(options != null)
      @for(String opt : options)
        <option value="${opt}" selected="${opt.equals(value)}">${opt}</option>
      @endfor
    @endif
  </select>
  <span
    aria-hidden="true"
    data-slot="native-select-icon"
    class="pointer-events-none absolute right-[var(--lv-space-3)] flex items-center text-[var(--lv-color-muted-fg)]"
  >@template.lievit.icon(name = "chevron-down", size = "1rem")</span>
</div>
