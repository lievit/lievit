<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui checkbox-list partial -- a MULTI-SELECT form control: a fieldset of native
  input[type=checkbox] options sharing one `name`, with an optional search box and a
  select-all / clear bulk toggle (Filament's CheckboxList; shadcn has no single equivalent,
  it composes Checkbox + Command/search).

  TIER: PARTIAL + component-specific enhancer (ADR-0012 server-first). The options, the
  checked state, and the legend are server-rendered HTML; each option is a real native
  checkbox sharing the `name`, so JS-OFF the control is a fully accessible multi-select
  that POSTs every checked value under the same repeated `name` in a plain form (native
  checkbox semantics: unchecked boxes are simply absent from FormData). The search and
  bulk-toggle rows are PURE ENHANCEMENTS layered on top by the CSP-clean enhancer; with JS
  off the search/select-all UI is hidden (no dead controls) and the user simply ticks boxes.

  STRUCTURE (scientific decision rule):
  - A custom listbox would re-implement the checkbox role, Space activation, and the form
    POST in JS and break JS-off submit.
  - Native checkboxes give role + keyboard + disabled + form integration for free and POST
    natively. They are the base layer.
  - WAI-ARIA APG Checkbox Group:
    https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/examples/checkbox-group/
  - Ant Design CheckboxGroup (columns, select-all, disabled-group) is the feature inventory
    reference; no code copied, original generation over --lv-* tokens.
  - shadcn has no native equivalent; Filament's CheckboxList is the direct inspiration for
    the search + bulk-toggle progressive-enhancement model.
  - The checkbox rows compose the re-forged lievit checkbox primitive via
    @template.lievit.checkbox(...) with a SIBLING label[for] (the v-next checkbox has NO
    label param by design -- two semantic elements stay separate).

  A11y (WAI-ARIA APG Checkbox Group):
  - native fieldset + legend is the APG group; each option is a real input[type=checkbox]
    + label[for]. The browser supplies role=group on fieldset automatically.
  - ariaLabel names the fieldset when there is no visible legend (aria-label on fieldset).
  - aria-required="true" marks the group required when `required=true` (the native `required`
    attribute on a fieldset is not supported; aria-required is the correct signal here).
  - invalid sets aria-invalid="true" + data-invalid="true" on the fieldset; each checkbox in
    the group inherits the error context via ariaInvalid=true on the checkbox primitive.
  - describedBy points the group at an external hint/error element (aria-describedby).
  - disabled="true" on the fieldset disables the whole group natively; data-disabled mirrors
    it for CSS styling hooks.
  - The search input is a labelled input[role=searchbox] (aria-label = searchPlaceholder);
    it appears only when JS is active (rendered hidden, enhancer reveals it).
  - The select-all control is a real button[type=button] with aria-pressed reflecting the
    all-checked state (synced by the enhancer on every change). Also JS-only.
  - Colour is never the only signal: the checked state is the native checkbox control; the
    count/label always states the status in text.

  OPTIONS: pass an ordered Map of String to String via `options` (value to label) for the
  simple case, OR a `content` slot of hand-authored option markup for per-option disabled /
  rich labels. The `content` slot wins when both are supplied.

  Params:
    String name                           the shared checkbox name (POSTs each checked value
                                          under the repeated name in a plain form submit).
    java.util.Map<String,String> options = null  ordered value-to-label option map.
    gg.jte.Content content = null         hand-authored option markup (wins over options).
    java.util.List<String> values = null  the initially-checked values.
    String label      = null              visible legend text.
    String ariaLabel  = null              aria-label on the fieldset when no visible legend.
    String describedBy = null             id of an external hint/error element (aria-describedby).
    boolean searchable = false            render the search box (JS-on filter; hidden JS-off).
    boolean bulkToggle = false            render the select-all / clear toggle (JS-on).
    String searchPlaceholder = "Search..."  placeholder text inside the search input.
    String searchAriaLabel = null         aria-label on the search input; falls back to
                                          searchPlaceholder when null.
    String selectAllLabel = "Select all"  text for the bulk toggle button.
    String clearLabel = null              text when all are checked (toggles to "Clear all");
                                          falls back to selectAllLabel when null.
    String columns    = "1"              option grid columns: "1" | "2" | "3".
    boolean disabled  = false            disables the whole group (native fieldset disabled).
    boolean required  = false            marks the group required (aria-required on fieldset).
    boolean invalid   = false            aria-invalid="true" + danger ring on each option.
    String cssClass   = ""              extra utility classes on the fieldset root.

  Usage:
    @@template.lievit.checkbox-list(
      name = "tipologie", label = "Tipologie", searchable = true, bulkToggle = true,
      columns = "2",
      options = java.util.Map.of("villa", "Villa", "appartamento", "Appartamento"),
      values = contatto.tipologie())

    @@template.lievit.checkbox-list(
      name = "tags", ariaLabel = "Tag filtro", bulkToggle = true,
      options = tagMap, values = selectedTags, invalid = hasError,
      describedBy = "tags-error")
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
@param String searchAriaLabel = null
@param String selectAllLabel = "Select all"
@param String clearLabel = null
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
!{var resolvedSearchAriaLabel = (searchAriaLabel != null && !searchAriaLabel.isBlank())
    ? searchAriaLabel : searchPlaceholder;}
!{var resolvedClearLabel = (clearLabel != null && !clearLabel.isBlank())
    ? clearLabel : selectAllLabel;}

<fieldset
  data-slot="checkbox-list"
  data-columns="${columns}"
  data-invalid="${invalid ? "true" : null}"
  data-disabled="${disabled ? "true" : null}"
  data-lievit-checkbox-list
  data-controller="lv-checkbox-list"
  data-action="change->lv-checkbox-list#onChange"
  aria-label="${ariaLabel}"
  aria-describedby="${describedBy}"
  aria-invalid="${invalid ? "true" : null}"
  aria-required="${required ? "true" : null}"
  disabled="${disabled}"
  class="m-0 flex min-w-0 flex-col gap-[var(--lv-space-2)] border-0 p-0 font-[var(--lv-font-sans)] ${cssClass}"
>
  @if(label != null && !label.isBlank())
    <legend
      data-slot="checkbox-list-legend"
      class="mb-[var(--lv-space-1)] float-none w-full p-0 text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]"
    >${label}</legend>
  @endif

  @if(hasTools)
    <div
      data-slot="checkbox-list-tools"
      data-checkbox-list-tools
      hidden
      data-lv-checkbox-list-target="tools"
      class="flex flex-wrap items-center gap-[var(--lv-space-2)]"
    >
      @if(searchable)
        <div class="relative flex min-w-[12rem] flex-1 items-center">
          <span
            aria-hidden="true"
            class="pointer-events-none absolute left-[var(--lv-space-2)] flex items-center text-[var(--lv-color-muted-fg)]"
          >
            @template.lievit.icon(name = "search", size = "0.875rem")
          </span>
          <input
            type="text"
            role="searchbox"
            data-slot="checkbox-list-search"
            data-checkbox-list-search
            data-action="input->lv-checkbox-list#filter"
            placeholder="${searchPlaceholder}"
            aria-label="${resolvedSearchAriaLabel}"
            autocomplete="off"
            class="h-[var(--lv-space-8)] w-full rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] pl-[var(--lv-space-7)] pr-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] font-[var(--lv-font-sans)] shadow-[var(--lv-shadow-xs)] outline-none transition-[border-color,box-shadow] duration-[var(--lv-duration-fast)] placeholder:text-[var(--lv-color-muted-fg)] hover:border-[var(--lv-color-border-hover)] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] motion-reduce:transition-none"
          >
        </div>
      @endif
      @if(bulkToggle)
        <button
          type="button"
          data-slot="checkbox-list-toggle-all"
          data-checkbox-list-toggle-all
          data-action="click->lv-checkbox-list#toggleAll"
          data-select-all-label="${selectAllLabel}"
          data-clear-label="${resolvedClearLabel}"
          aria-pressed="false"
          class="inline-flex h-[var(--lv-space-8)] shrink-0 items-center gap-[var(--lv-space-1-5)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] font-[var(--lv-font-sans)] text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-xs)] outline-none transition-[background-color,border-color,box-shadow] duration-[var(--lv-duration-fast)] hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] motion-reduce:transition-none"
        >${selectAllLabel}</button>
      @endif
    </div>
  @endif

  <div
    data-slot="checkbox-list-options"
    data-checkbox-list-options
    class="grid gap-[var(--lv-space-2)] ${gridCols}"
  >
    @if(content != null)
      ${content}
    @elseif(options != null)
      @for(java.util.Map.Entry<String, String> opt : options.entrySet())
        !{var optId = name + "-" + opt.getKey();}
        <div
          data-slot="checkbox-list-option"
          data-checkbox-list-option
          data-value="${opt.getKey()}"
          data-label="${opt.getValue()}"
          class="flex items-center gap-[var(--lv-space-2)]"
        >
          @template.lievit.checkbox(name = name, id = optId, value = opt.getKey(), checked = checkedSet.contains(opt.getKey()), disabled = disabled, ariaInvalid = invalid)
          <label
            for="${optId}"
            class="cursor-pointer select-none text-[length:var(--lv-text-sm)] font-[var(--lv-font-sans)] text-[var(--lv-color-fg)] ${disabled ? "cursor-not-allowed opacity-[var(--lv-opacity-disabled)]" : ""}"
          >${opt.getValue()}</label>
        </div>
      @endfor
    @endif
  </div>
</fieldset>
