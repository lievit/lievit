<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui key-value-input partial -- an EDITABLE repeatable key/value FORM control: rows of two
  text inputs (key + value) with add / remove (Filament's KeyValue field). The rows POST as INDEXED
  form-array fields so the server can rebuild an ordered map.

  NOT the read-only `key-value` display primitive (that one renders a static dl/dt/dd). This is the
  editable FORM counterpart; it is named key-value-INPUT to avoid the collision.

  TIER: PARTIAL (+ optional enhancer, ADR-0012 server-first). Each row is two native text inputs
  named `<name>[<i>][key]` / `<name>[<i>][value]` (the canonical form-array convention a Java/Spring
  binder maps to a List or Map). So the rows POST natively with ZERO JavaScript. JS-OFF, add is an
  explicit "Add row" submit (name=`<name>__add`) and remove is a per-row submit (name=`<name>__remove`,
  value=index) that round-trip to the server, which re-renders with one more / fewer row -- a working
  no-JS path. JS-ON the CSP-clean enhancer clones a hidden <template> row to add and drops a row to
  remove, in place, then RE-INDEXES the remaining rows so the POSTed indices stay contiguous.

  STRUCTURE (scientific decision rule): a JS-only editor reimplements the rows + the value plumbing
  in script and breaks no-JS submit. Native indexed inputs give the array POST for free, so they are
  the base layer; the add/remove ergonomics are an enhancement on top, never the value itself.

  A11y (WAI-ARIA): each input has an aria-label naming its role + row (e.g. "Key, row 2") since the
  column headers are visual; the add + per-row remove are real <button>s with clear labels; an
  aria-live region announces add/remove. `disabled` disables every control.

  Params:
    String name                       the field prefix (rows POST as `<name>[<i>][key|value]`).
    java.util.Map<String,String> entries = null  the initial rows (insertion-ordered).
    String label       = null         visible group <label> text.
    String keyLabel    = "Key"        the key column header + aria-label stem.
    String valueLabel  = "Value"      the value column header + aria-label stem.
    String keyPlaceholder   = null    optional placeholder for the key inputs.
    String valuePlaceholder = null    optional placeholder for the value inputs.
    String addLabel    = "Add row"    the add button text.
    boolean disabled   = false        disables every control.
    String cssClass    = ""           extra utility classes on the wrapper.

  Usage:
    @@template.lievit.key-value-input(name = "meta", label = "Metadati",
      entries = contatto.meta(), keyLabel = "Campo", valueLabel = "Valore")
--%>
@param String name
@param java.util.Map<String, String> entries = null
@param String label = null
@param String keyLabel = "Key"
@param String valueLabel = "Value"
@param String keyPlaceholder = null
@param String valuePlaceholder = null
@param String addLabel = "Add row"
@param boolean disabled = false
@param String cssClass = ""

!{var rows = entries != null ? entries : java.util.Map.<String, String>of();}
!{var rowInputClass = "h-[var(--lv-space-9)] w-full min-w-0 rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-xs)] outline-none transition-[color,box-shadow] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50";}
!{var removeBtnClass = "inline-flex size-[var(--lv-space-9)] shrink-0 items-center justify-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] text-[var(--lv-color-muted-fg)] shadow-[var(--lv-shadow-xs)] outline-none transition-colors hover:bg-[var(--lv-color-muted)] hover:text-[var(--lv-color-destructive)] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50";}

<div
  data-slot="key-value-input"
  data-lievit-key-value-input
  data-name="${name}"
  data-disabled="${disabled ? "true" : null}"
  class="flex flex-col gap-[var(--lv-space-2)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(label != null && !label.isBlank())
    <span data-slot="key-value-input-label" class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]">${label}</span>
  @endif

  <div data-slot="key-value-input-rows" data-key-value-input-rows class="flex flex-col gap-[var(--lv-space-2)]">
    !{int i = 0;}
    @for(java.util.Map.Entry<String, String> entry : rows.entrySet())
      <div data-slot="key-value-input-row" data-key-value-input-row data-index="${i}" class="flex items-center gap-[var(--lv-space-2)]">
        <input
          data-slot="key-value-input-key"
          data-key-value-input-key
          type="text"
          name="${name}[${i}][key]"
          value="${entry.getKey()}"
          placeholder="${keyPlaceholder}"
          aria-label="${keyLabel}, row ${i + 1}"
          disabled="${disabled}"
          class="${rowInputClass}"
          style="font-family:var(--lv-font-sans);"
        >
        <input
          data-slot="key-value-input-value"
          data-key-value-input-value
          type="text"
          name="${name}[${i}][value]"
          value="${entry.getValue()}"
          placeholder="${valuePlaceholder}"
          aria-label="${valueLabel}, row ${i + 1}"
          disabled="${disabled}"
          class="${rowInputClass}"
          style="font-family:var(--lv-font-sans);"
        >
        <button
          type="submit"
          data-slot="key-value-input-remove"
          data-key-value-input-remove
          name="${name}__remove"
          value="${i}"
          aria-label="Remove row ${i + 1}"
          disabled="${disabled}"
          class="${removeBtnClass}"
        >@template.lievit.icon(name = "trash-2", size = "1rem")</button>
      </div>
      !{i++;}
    @endfor
  </div>

  <%-- JS-on the enhancer clones this hidden template row (the {i} placeholder is re-stamped on add). --%>
  <template data-key-value-input-template>
    <div data-slot="key-value-input-row" data-key-value-input-row data-index="__i__" class="flex items-center gap-[var(--lv-space-2)]">
      <input data-slot="key-value-input-key" data-key-value-input-key type="text" name="${name}[__i__][key]" value="" placeholder="${keyPlaceholder}" aria-label="${keyLabel}, row __label__" class="${rowInputClass}" style="font-family:var(--lv-font-sans);">
      <input data-slot="key-value-input-value" data-key-value-input-value type="text" name="${name}[__i__][value]" value="" placeholder="${valuePlaceholder}" aria-label="${valueLabel}, row __label__" class="${rowInputClass}" style="font-family:var(--lv-font-sans);">
      <button type="button" data-slot="key-value-input-remove" data-key-value-input-remove aria-label="Remove row __label__" class="${removeBtnClass}">@template.lievit.icon(name = "trash-2", size = "1rem")</button>
    </div>
  </template>

  <div>
    <button
      type="submit"
      data-slot="key-value-input-add"
      data-key-value-input-add
      name="${name}__add"
      value="1"
      disabled="${disabled}"
      class="inline-flex h-[var(--lv-space-9)] items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-dashed border-[var(--lv-color-input)] bg-transparent px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] outline-none transition-colors hover:bg-[var(--lv-color-muted)] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50"
      style="font-family:var(--lv-font-sans);"
    >@template.lievit.icon(name = "plus", size = "1rem")${addLabel}</button>
  </div>

  <span data-slot="key-value-input-live" data-key-value-input-live aria-live="polite" class="sr-only"></span>
</div>
