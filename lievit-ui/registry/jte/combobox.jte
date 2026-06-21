@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui combobox partial -- a SEARCHABLE select rendered server-side with a progressive-
  enhancement contract (ADR-0012). JS-OFF it IS a real native <select name=...> (token-styled
  exactly like the native-select partial): it submits in a plain POST form, gets platform
  keyboard / focus / screen-reader / mobile-wheel semantics for free, and is fully accessible
  with ZERO JavaScript. JS-ON a tiny CSP-clean typed-TS enhancer (combobox.enhancer.ts) UPGRADES
  the same DOM in place into a WAI-ARIA combobox: a filterable text input over a listbox built
  from the SAME <option>s, so the user can type to narrow a long list. The native <select> is
  kept in the DOM as the form-bound source of truth (the listbox writes the chosen value back to
  it), so the field stays form-associated and POSTs the same name whether or not JS ran.

  This is the form-native counterpart to the WIRE rich-select (registry/wire/rich-select): the
  WIRE one filters SERVER-SIDE per keystroke (lazy / huge catalogs, l:model.debounce, needs a live
  connection, no JS-off render). THIS one ships the whole (small/preloaded) catalog eagerly so the
  filtering is client-side and the JS-off path is a working native control. Pick this for the
  Filament "Select / BelongsToField searchable + preload" case; pick the wire one for lazy search.

  TIER: PARTIAL (+ enhancer). The catalog and the selected value are server-rendered HTML; the only
  client bit is the in-page filtering + listbox keyboard navigation, a small typed-TS module the
  strict CSP accepts (no inline on* handlers; the enhancer attaches listeners in code). There is
  nothing for the server to DECIDE between keystrokes when the catalog is already on the page, so a
  per-keystroke wire round-trip would be chat for no gain -- the value is bound at POST.

  SHAPE DECISION (scientific rule, same lens as native-select): a custom listbox reimplements
  keyboard + focus + AT semantics in JS and breaks no-JS form submit; the native <select> gets all
  of that from the platform and submits natively. So we KEEP the native <select> as the base layer
  (a11y + bundle + no-JS submit all win) and ADD the searchable listbox only as an enhancement on
  top, never a replacement. Mirrors shadcn's Combobox (Popover + Command listbox) but with a native
  <select> as the degradation target, which shadcn's React-only version has no equivalent for.

  OPTIONS: same contract as native-select -- pass a List<String> via `options` (value == label),
  a Map<String, List<String>> via `optionGroups` (group label -> <optgroup>), OR a `content` slot
  of hand-authored <option>/<optgroup> markup (value != label, per-option disabled). Precedence:
  `content` > `optionGroups` > `options`. The enhancer reads the rendered <option>s, so all three
  authoring forms upgrade identically.

  MULTIPLE (Filament Select/BelongsToField multiple): set `multiple=true` and the native base
  becomes a real <select multiple> (POSTs repeated `name` values JS-off); JS-on the enhancer renders
  the chosen options as removable chips above the search and keeps aria-multiselectable on the
  listbox. The native multi-select stays the source of truth.

  A11y: JS-OFF a real labelled <select> (a <label for> binds directly; pass `label` for a visible
  one or `ariaLabel` for an accessible name). JS-ON the enhancer rewires to the WAI-ARIA combobox
  pattern: the search input gets role="combobox" + aria-expanded + aria-controls -> the listbox id,
  aria-autocomplete="list"; the listbox is role="listbox", each row role="option" + aria-selected;
  the native <select> is hidden from AT (aria-hidden) while the combobox is live so it is not
  double-announced. `invalid` sets the destructive ring + aria-invalid on the control.

  Params:
    String name                  the field name (POSTs JS-off; repeated when multiple).
    String id          = name    the control id (for a <label for>); defaults to name.
    java.util.List<String> options = null  simple value==label option list.
    java.util.Map<String, java.util.List<String>> optionGroups = null  group label -> options.
    gg.jte.Content content = null  hand-authored <option>/<optgroup> markup (wins over the maps).
    String value       = null    the selected value (single mode).
    java.util.List<String> values = null  the selected values (multiple mode).
    String label       = null    visible <label> text rendered above the control.
    String ariaLabel   = null    aria-label when there is no visible label.
    String placeholder = null    empty-state text: a disabled hidden first <option> JS-off, the
                                 trigger / search placeholder JS-on.
    String searchPlaceholder = "Search..."  placeholder inside the search input (JS-on only).
    String emptyText   = "No results"  shown in the listbox when the filter matches nothing (JS-on).
    boolean multiple   = false   multi-select with chips (native <select multiple> JS-off).
    String size        = "md"    "sm" | "md" | "lg" control height (toolbar parity), like native-select.
    boolean disabled   = false   disables the control + dims the wrapper.
    boolean required   = false   marks the control required.
    boolean invalid    = false   destructive border + ring + aria-invalid="true".
    String model       = null    l:model expression bound to the native <select> (binds JS-off too).
    String cssClass    = ""      extra utility classes on the wrapper.

  Usage:
    @@template.lievit.combobox(
      name = "agente", label = "Agente", placeholder = "Seleziona...", searchPlaceholder = "Cerca agente...",
      options = java.util.List.of("Cecchetto", "Scarpino", "Meli"), value = contatto.agente()
    )
    @@template.lievit.combobox(name = "citta", optionGroups = java.util.Map.of(
      "Emilia", java.util.List.of("Parma", "Reggio"), "Lombardia", java.util.List.of("Milano")))
    @@template.lievit.combobox(name = "tags", label = "Tags", multiple = true,
      options = java.util.List.of("hot", "warm", "cold"))
    import the enhancer once from your entry module: import "./lievit/combobox.enhancer";
--%>
@param String name = null
@param String id = null
@param java.util.List<String> options = null
@param java.util.Map<String, java.util.List<String>> optionGroups = null
@param gg.jte.Content content = null
@param String value = null
@param java.util.List<String> values = null
@param String label = null
@param String ariaLabel = null
@param String placeholder = null
@param String searchPlaceholder = "Search..."
@param String emptyText = "No results"
@param boolean multiple = false
@param String size = "md"
@param boolean disabled = false
@param boolean required = false
@param boolean invalid = false
@param String model = null
@param String cssClass = ""

!{var selectId = (id != null && !id.isBlank()) ? id : name;}
!{var hasValue = value != null && !value.isBlank();}
!{var selectedSet = values != null ? values : java.util.List.<String>of();}
!{var listboxId = selectId + "-listbox";}
!{var searchId = selectId + "-search";}

@if(label != null && !label.isBlank())
  <label for="${selectId}" data-slot="combobox-label" class="mb-[var(--lv-space-2)] block text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]" style="font-family:var(--lv-font-sans);">${label}</label>
@endif
<div
  data-slot="combobox"
  data-lievit-combobox
  data-multiple="${multiple}"
  data-disabled="${disabled}"
  data-invalid="${invalid}"
  data-size="${size}"
  data-search-placeholder="${searchPlaceholder}"
  data-empty-text="${emptyText}"
  data-placeholder="${placeholder != null ? placeholder : ""}"
  data-listbox-id="${listboxId}"
  data-search-id="${searchId}"
  class="relative w-full ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  <%-- JS-OFF base layer: a real native <select> token-styled like the native-select partial. The
       enhancer keeps this in the DOM as the form-bound source of truth and only hides it visually. --%>
  <div
    data-slot="combobox-native-wrapper"
    class="relative flex w-full items-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] shadow-[var(--lv-shadow-xs)] transition-[color,box-shadow] outline-none focus-within:border-[var(--lv-color-ring)] focus-within:shadow-[var(--lv-ring)] data-[disabled=true]:opacity-50 data-[invalid=true]:border-[var(--lv-color-destructive)] data-[size=sm]:h-[var(--lv-space-8)] data-[size=md]:h-[var(--lv-space-9)] data-[size=default]:h-[var(--lv-space-9)] data-[size=lg]:h-[var(--lv-space-10)]"
    data-disabled="${disabled}"
    data-invalid="${invalid}"
    data-size="${size}"
  >
    <select
      data-slot="combobox-native"
      data-combobox-native
      id="${selectId}"
      name="${name}"
      disabled="${disabled}"
      required="${required}"
      multiple="${multiple}"
      aria-label="${ariaLabel}"
      aria-invalid="${invalid ? "true" : null}"
      l:model="${model}"
      class="h-full w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent pl-[var(--lv-space-3)] pr-[var(--lv-space-8)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] outline-none focus:outline-none focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed"
      style="font-family:var(--lv-font-sans);"
    >
      @if(!multiple && placeholder != null && !placeholder.isBlank())
        <option value="" disabled hidden selected="${!hasValue}">${placeholder}</option>
      @endif
      @if(content != null)
        ${content}
      @elseif(optionGroups != null)
        @for(java.util.Map.Entry<String, java.util.List<String>> grp : optionGroups.entrySet())
          <optgroup label="${grp.getKey()}">
            @for(String opt : grp.getValue())
              <option value="${opt}" selected="${multiple ? selectedSet.contains(opt) : opt.equals(value)}">${opt}</option>
            @endfor
          </optgroup>
        @endfor
      @elseif(options != null)
        @for(String opt : options)
          <option value="${opt}" selected="${multiple ? selectedSet.contains(opt) : opt.equals(value)}">${opt}</option>
        @endfor
      @endif
    </select>
    <span aria-hidden="true" data-slot="combobox-icon" class="pointer-events-none absolute right-[var(--lv-space-3)] flex items-center text-[var(--lv-color-muted-fg)]">
      @template.lievit.icon(name = "chevron-down", size = "1rem")
    </span>
  </div>
</div>
