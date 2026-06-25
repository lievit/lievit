@import dev.lievit.kit.schema.infolist.ResolvedNode
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.infolist.keyvalue - renders a resolved KeyValueEntry (ResolvedNode.KeyValue) as a
  small read-only two-column table, by COMPOSING the lievit-ui `key-value` primitive (the read-only
  key/value table). This is the path that paints KeyValueEntry.resolveMap (the audit's "unwired" fix):
  the structured tree carries the real map, not String.valueOf(map). An empty map renders a
  header-only table.

  RECONCILE (the flagged lievit-ui gap, now closed): the table chrome used to be composed INLINE here
  because lievit-ui had no key-value primitive. It now delegates to @template.lievit.key-value exactly
  as the other entry kinds delegate to infolist-entry: ONE place owns the key/value table markup.

  Params:
    kv - the resolved key-value node.
--%>
@param ResolvedNode.KeyValue kv
@template.lievit.key-value(pairs = kv.pairs(), keyLabel = kv.keyLabel(), valueLabel = kv.valueLabel())
