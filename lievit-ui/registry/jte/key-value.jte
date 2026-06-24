@import java.util.Map
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui key-value partial -- a read-only two-column table of key -> value pairs, the detail-page
  primitive Filament's KeyValueEntry needs (a map shown as a small ruled table inside an infolist).
  The read-only twin of a form's key-value REPEATER: here the pairs are already resolved (the kit's
  KeyValueEntry.resolveMap output), the template only iterates them.

  TIER (planning two-tier model): STATIC presentational -> JTE partial. Pure layout over an
  already-projected ordered map; no client state, no lifecycle => not a Lit island, not a wire
  component.

  STRUCTURE (scientific decision rule): the semantic shape for a labelled key/value grid is a real
  <table> with a <thead> (the keyLabel / valueLabel headers) + a <tbody> of <tr><td>key</td>
  <td>value</td>. shadcn has no dedicated key-value export (its examples compose a bordered table);
  Filament's KeyValueEntry renders exactly this two-column ruled table, so we ship it as the
  primitive. NOT description-list (that is a dt/dd grid for a record's fields, not a homogeneous
  map with column headers); NOT data-table (no sorting / selection / pagination).
  A native <table> carries the implicit table role (WAI-ARIA 1.2 §4.c prohibits a redundant
  prohibits duplicating the implicit ARIA role of a host-language semantic element).

  TOKEN FIDELITY: the border reads --lv-color-border, the radius --lv-radius-md, headers read
  --lv-color-muted-fg, cell text --lv-color-fg, padding the space scale; a retheme retints the
  whole table without a markup edit.

  bordered: wraps the table in a card chrome (border + radius + overflow:hidden) when true (default).
  striped: alternates a surface tint on even rows via --lv-color-surface for readability on long maps.
  emptyMessage: when set, renders a full-width cell when the pairs map is empty instead of an empty
  tbody. When null, the tbody is left empty (no row rendered, only the header).

  A11y: native <table> with <thead> labels each column via scope="col" on each <th>; the table is
  read-only content, not a control, so no extra ARIA is needed.

  Params:
    pairs      Map<String,String>   the ordered key -> value pairs (already projected to strings).
    keyLabel   String  = "Key"      the key-column header.
    valueLabel String  = "Value"    the value-column header.
    boolean bordered   = true       wrap the table in bordered card chrome (border + radius).
    boolean striped    = false      tint even rows with --lv-color-surface for readability.
    String emptyMessage = null      message when pairs is empty; null => empty tbody.
    cssClass   String  = ""         extra utility classes on the table root.

  Usage:
    @@template.lievit.key-value(pairs = pairs, keyLabel = "Field", valueLabel = "Value")
    @@template.lievit.key-value(pairs = pairs, striped = true, emptyMessage = "No entries yet.")
--%>
@param Map<String, String> pairs
@param String keyLabel = "Key"
@param String valueLabel = "Value"
@param boolean bordered = true
@param boolean striped = false
@param String emptyMessage = null
@param String cssClass = ""

!{var borderedClass = bordered
    ? "border border-[var(--lv-color-border)] rounded-[var(--lv-radius-md)] overflow-hidden"
    : "";}

<table
  data-slot="key-value"
  data-bordered="${bordered}"
  data-striped="${striped}"
  class="w-full border-collapse text-[length:var(--lv-text-sm)] ${borderedClass} ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  <thead>
    <tr>
      <th data-slot="key-value-key-head" scope="col" class="text-left px-[var(--lv-space-3)] py-[var(--lv-space-2)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)] border-b border-[var(--lv-color-border)]">${keyLabel}</th>
      <th data-slot="key-value-value-head" scope="col" class="text-left px-[var(--lv-space-3)] py-[var(--lv-space-2)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)] border-b border-[var(--lv-color-border)]">${valueLabel}</th>
    </tr>
  </thead>
  <tbody>
    @if(pairs.isEmpty())
      @if(emptyMessage != null)
        <tr data-slot="key-value-row">
          <td colspan="2" class="px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[var(--lv-color-muted-fg)] text-center">${emptyMessage}</td>
        </tr>
      @endif
    @else
      !{int[] _idx = {0};}
      @for(Map.Entry<String, String> pair : pairs.entrySet())
        !{_idx[0]++;}
        !{var rowClass = (striped && _idx[0] % 2 == 0) ? "bg-[var(--lv-color-surface)]" : "";}
        <tr data-slot="key-value-row" class="${rowClass}">
          <td class="px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[var(--lv-color-fg)] font-[var(--lv-font-normal)] border-t border-[var(--lv-color-border)]">${pair.getKey()}</td>
          <td class="px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[var(--lv-color-fg)] font-[var(--lv-font-normal)] border-t border-[var(--lv-color-border)]">${pair.getValue()}</td>
        </tr>
      @endfor
    @endif
  </tbody>
</table>
