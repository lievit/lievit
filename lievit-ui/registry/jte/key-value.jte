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
  component. An empty map renders the header row only (so the table still reads as "no entries").

  STRUCTURE (scientific decision rule): the semantic shape for a labelled key/value grid is a real
  <table> with a <thead> (the keyLabel / valueLabel headers) + a <tbody> of <tr><td>key</td>
  <td>value</td>. shadcn has no dedicated key-value export (its examples compose a bordered table);
  Filament's KeyValueEntry renders exactly this two-column ruled table, so we ship it as the
  primitive. NOT description-list (that is a dt/dd grid for a record's fields, not a homogeneous
  map with column headers); NOT data-table (no sorting / selection / pagination).

  TOKEN FIDELITY: the border reads --lv-color-border, the radius --lv-radius-md, headers read
  --lv-color-muted-fg, cell text --lv-color-fg, padding the space scale; a retheme retints the
  whole table without a markup edit.

  A11y: a native <table> with a <thead> labels each column for assistive tech; the table is
  read-only content, not a control, so no extra ARIA is needed.

  Params:
    pairs      Map<String,String>   the ordered key -> value pairs (already projected to strings).
    keyLabel   String  = "Key"      the key-column header.
    valueLabel String  = "Value"    the value-column header.
    cssClass   String  = ""         extra utility classes on the table root.

  Usage:
    @@template.lievit.key-value(pairs = pairs, keyLabel = "Field", valueLabel = "Value")
--%>
@param Map<String, String> pairs
@param String keyLabel = "Key"
@param String valueLabel = "Value"
@param String cssClass = ""
<table
    data-slot="key-value"
    class="w-full border-collapse text-[length:var(--lv-text-sm)] ${cssClass}"
    style="font-family: var(--lv-font-sans); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); overflow: hidden;"
>
    <thead>
        <tr>
            <th data-slot="key-value-key-head" style="text-align: left; padding: var(--lv-space-2); font-weight: var(--lv-font-medium); color: var(--lv-color-muted-fg); border-bottom: 1px solid var(--lv-color-border);">${keyLabel}</th>
            <th data-slot="key-value-value-head" style="text-align: left; padding: var(--lv-space-2); font-weight: var(--lv-font-medium); color: var(--lv-color-muted-fg); border-bottom: 1px solid var(--lv-color-border);">${valueLabel}</th>
        </tr>
    </thead>
    <tbody>
        @for(Map.Entry<String, String> pair : pairs.entrySet())
            <tr data-slot="key-value-row" data-key="${pair.getKey()}">
                <td style="padding: var(--lv-space-2); color: var(--lv-color-fg); border-top: 1px solid var(--lv-color-border);">${pair.getKey()}</td>
                <td style="padding: var(--lv-space-2); color: var(--lv-color-fg); border-top: 1px solid var(--lv-color-border);">${pair.getValue()}</td>
            </tr>
        @endfor
    </tbody>
</table>
