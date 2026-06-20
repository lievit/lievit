@import io.lievit.component.ComponentMetadata
@import io.lievit.kit.schema.infolist.ResolvedNode
@import io.lievit.kit.wire.InfolistViewComponent
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  Host template for the layout-bearing infolist (sections / tabs / fieldset / grid / key-value),
  driven through the REAL lievit runtime by InfolistViewComponent. It iterates the resolved top-level
  ResolvedNode tree and delegates each node to the recursive lievit/infolist-node partial. This is the
  STRUCTURED resolve path (resolveTree) the flat AdminViewView path does not exercise; it proves the
  carried-over filament-infolists layout (Section/Tabs/Fieldset/Grid) renders nested, and that the
  KeyValueEntry map is finally reached (the audit's unwired fix).

  Params:
    _instance   InfolistViewComponent  the live component (carries the resolved tree)
    _component  ComponentMetadata      always-present wire metadata (the className anchor)
--%>
@param InfolistViewComponent _instance
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}" data-lv-infolist>
    @for(ResolvedNode node : _instance.nodes())
        @template.lievit.infolist-node(node = node)
    @endfor
</div>
