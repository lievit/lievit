<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui checkbox-list partial -- a MULTI-SELECT form control: a fieldset of native
  <input type="checkbox"> options sharing one `name`, with an optional search box and a
  bulk select-all / clear toggle on top (Filament's CheckboxList field; shadcn has no single
  equivalent, it composes Checkbox + Command/search).

  TIER: PARTIAL (+ optional enhancer, ADR-0012 server-first). The options, the checked state and
  the legend are server-rendered HTML; each option is a real native checkbox sharing the `name`,
  so JS-OFF the control is a fully accessible multi-select that POSTs every checked value under
  the same repeated `name` in a plain form (native checkbox semantics: unchecked boxes are simply
  absent from FormData). The search + bulk-toggle are PURE enhancements layered on top by the
  CSP-clean enhancer; with JS off the search/select-all UI is hidden (no dead controls) and the
  user simply ticks boxes.

  STRUCTURE (scientific decision rule): a custom listbox would reimplement the checkbox role,
  Space activation and the form POST in JS and break JS-off submit. Native checkboxes give all of
  that for free and POST natively, so they are the base layer; the only client bits (filter the
  visible options, toggle them all at once) are additive niceties, never the control itself.

  A11y (WAI-ARIA): a native <fieldset> + <legend> is the platform group; each option is a real
  <input type=checkbox> + <label for>. `ariaLabel` names the fieldset when there is no visible
  legend. `invalid` sets aria-invalid + a danger ring on each box; `describedBy` points the group
  at an external error element. The search input is a labelled <input role=searchbox> (JS-on); the
  select-all control is a real button with aria-pressed reflecting the all-checked state. Colour is
  never the only signal: the checked state is the native checkbox, the count is announced in text.

  OPTIONS: pass an ordered Map<String,String> via `options` (value -> label) for the simple case,
  OR a `content` slot of hand-authored option markup for per-option disabled / rich labels.
  `content` wins.

  Params:
    String name                       the shared checkbox name (POSTs each checked value, repeated).
    java.util.Map<String,String> options = null  ordered value->label option map.
    gg.jte.Content content = null     hand-authored option markup (wins over options).
    java.util.List<String> values = null  the initially-checked values.
    String label      = null          visible <legend> text.
    String ariaLabel  = null          aria-label on the fieldset when no visible legend.
    String describedBy = null         id of an external hint/error element (aria-describedby).
    boolean searchable = false        render the search box (JS-on filter).
    boolean bulkToggle = false        render the select-all / clear toggle (JS-on).
    String searchPlaceholder = "Search..."  placeholder inside the search input.
    String selectAllLabel = "Select all"  text/aria for the bulk toggle.
    String columns    = "1"           option grid columns: "1" | "2" | "3".
    boolean disabled  = false         disables the whole group.
    boolean required  = false         marks the group required.
    boolean invalid   = false         aria-invalid + danger option rings (error state).
    String cssClass   = ""            extra utility classes on the fieldset.

  Usage:
    @@template.lievit.checkbox-list(
      name = "tipologie", label = "Tipologie", searchable = true, bulkToggle = true, columns = "2",
      options = java.util.Map.of("villa", "Villa", "appartamento", "Appartamento"),
      values = contatto.tipologie())
--%>
@import gg.jte.Content
@param String name
@param java.util.Map<String, String> options = null
@param gg.jte.Content content = null
@param java.util.List<String> values = null
@param String label = null
@param String ariaLabel = null
@param String describedBy = null
@param boolean searchable = false
@param boolean bulkToggle = false
@param String searchPlaceholder = "Search..."
@param String selectAllLabel = "Select all"
@param String columns = "1"
@param boolean disabled = false
@param boolean required = false
@param boolean invalid = false
@param String cssClass = ""

!{var checkedSet = values != null ? values : java.util.List.<String>of();}
!{var hasTools = searchable || bulkToggle;}
!{var gridCols = switch (columns) {
    case "2" -> "sm:grid-cols-2";
    case "3" -> "sm:grid-cols-3";
    default  -> "grid-cols-1";
  };}

<fieldset
  data-slot="checkbox-list"
  data-lievit-checkbox-list
  aria-label="${ariaLabel}"
  aria-describedby="${describedBy}"
  aria-invalid="${invalid ? "true" : null}"
  data-invalid="${invalid ? "true" : null}"
  data-disabled="${disabled ? "true" : null}"
  disabled="${disabled}"
  class="m-0 flex min-w-0 flex-col gap-[var(--lv-space-2)] border-0 p-0 ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(label != null && !label.isBlank())
    <legend data-slot="checkbox-list-label" class="mb-[var(--lv-space-1)] p-0 text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]">${label}</legend>
  @endif

  @if(hasTools)
    <%-- JS-ON only: hidden until the enhancer reveals it, so JS-off shows no dead controls. --%>
    <div data-slot="checkbox-list-tools" data-checkbox-list-tools hidden class="flex flex-wrap items-center gap-[var(--lv-space-2)]">
      @if(searchable)
        <div class="relative flex min-w-[12rem] flex-1 items-center">
          <span aria-hidden="true" class="pointer-events-none absolute left-[var(--lv-space-2)] flex items-center text-[var(--lv-color-muted-fg)]">
            @template.lievit.icon(name = "search", size = "0.875rem")
          </span>
          <input
            type="text"
            role="searchbox"
            data-slot="checkbox-list-search"
            data-checkbox-list-search
            placeholder="${searchPlaceholder}"
            aria-label="${searchPlaceholder}"
            autocomplete="off"
            class="h-[var(--lv-space-8)] w-full rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] pl-[var(--lv-space-7)] pr-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-xs)] outline-none transition-[color,box-shadow] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)]"
            style="font-family:var(--lv-font-sans);"
          >
        </div>
      @endif
      @if(bulkToggle)
        <button
          type="button"
          data-slot="checkbox-list-toggle-all"
          data-checkbox-list-toggle-all
          aria-pressed="false"
          class="inline-flex h-[var(--lv-space-8)] shrink-0 items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-xs)] outline-none transition-[color,box-shadow] hover:bg-[var(--lv-color-muted)] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)]"
          style="font-family:var(--lv-font-sans);"
        >${selectAllLabel}</button>
      @endif
    </div>
  @endif

  <div data-slot="checkbox-list-options" data-checkbox-list-options class="grid gap-[var(--lv-space-2)] ${gridCols}">
    @if(content != null)
      ${content}
    @elseif(options != null)
      @for(java.util.Map.Entry<String, String> opt : options.entrySet())
        <div data-slot="checkbox-list-option" data-checkbox-list-option data-label="${opt.getValue()}" class="flex items-center gap-[var(--lv-space-2)]">
          @template.lievit.checkbox(name = name, id = name + "-" + opt.getKey(), value = opt.getKey(), checked = checkedSet.contains(opt.getKey()), disabled = disabled, ariaInvalid = invalid)
          <label for="${name + "-" + opt.getKey()}" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] ${disabled ? "opacity-[var(--lv-opacity-disabled)]" : ""}" style="font-family:var(--lv-font-sans);">${opt.getValue()}</label>
        </div>
      @endfor
    @endif
  </div>
</fieldset>
