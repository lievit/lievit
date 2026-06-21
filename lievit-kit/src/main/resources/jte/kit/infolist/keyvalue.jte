@import java.util.Map
@import io.lievit.kit.schema.infolist.ResolvedNode
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.infolist.keyvalue - renders a resolved KeyValueEntry (ResolvedNode.KeyValue) as a
  small read-only two-column table: the key column + the value column with the entry's configured
  headers (keyLabel / valueLabel). This is the path that finally paints KeyValueEntry.resolveMap (the
  audit's "unwired" fix): the structured tree carries the real map, not String.valueOf(map). An empty
  map renders a header-only table.

  lievit-ui GAP (reported): there is no lievit-ui key-value table primitive, so the table chrome is
  composed inline here (token-styled, CSP-clean). A future lievit-ui `key-value` partial would replace
  this body with a single @template call, exactly as the other entry kinds delegate to infolist-entry.

  Params:
    kv - the resolved key-value node.
--%>
@param ResolvedNode.KeyValue kv
<table
    data-slot="infolist-keyvalue"
    class="w-full border-collapse text-[length:var(--lv-text-sm)]"
    style="font-family: var(--lv-font-sans); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); overflow: hidden;"
>
    <thead>
        <tr>
            <th data-slot="infolist-keyvalue-key-head" style="text-align: left; padding: var(--lv-space-2); font-weight: var(--lv-font-medium); color: var(--lv-color-muted-fg); border-bottom: 1px solid var(--lv-color-border);">${kv.keyLabel()}</th>
            <th data-slot="infolist-keyvalue-value-head" style="text-align: left; padding: var(--lv-space-2); font-weight: var(--lv-font-medium); color: var(--lv-color-muted-fg); border-bottom: 1px solid var(--lv-color-border);">${kv.valueLabel()}</th>
        </tr>
    </thead>
    <tbody>
        @for(Map.Entry<String, String> pair : kv.pairs().entrySet())
            <tr data-slot="infolist-keyvalue-row" data-key="${pair.getKey()}">
                <td style="padding: var(--lv-space-2); color: var(--lv-color-fg); border-top: 1px solid var(--lv-color-border);">${pair.getKey()}</td>
                <td style="padding: var(--lv-space-2); color: var(--lv-color-fg); border-top: 1px solid var(--lv-color-border);">${pair.getValue()}</td>
            </tr>
        @endfor
    </tbody>
</table>
