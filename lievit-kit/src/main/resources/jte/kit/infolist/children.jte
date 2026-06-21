@import java.util.List
@import io.lievit.kit.schema.infolist.ResolvedNode
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.infolist.children - lays a container's resolved child nodes out, honouring the
  <dl> validity rule: a description-list may only hold <dt>/<dd> pairs, so the container's DIRECT LEAF
  children (ResolvedNode.Field + ResolvedNode.KeyValue) are grouped into ONE N-column
  lievit.description-list, while nested CONTAINER children (Section / Tabs / Fieldset / Grid) recurse
  through kit.infolist.node as their own blocks OUTSIDE the list. This keeps the native dt/dd
  association intact and nested layout valid, and mirrors Filament's grid-of-entries vs nested-layout
  split.

  Render order: the leaf description-list first (when the container has any leaves), then each nested
  container in declaration order. A container with only leaves degrades to a single description-list;
  one with only containers renders just the nested blocks (no empty <dl>).

  Each leaf Field becomes a description-list.item (term = label, value = kit.infolist.entry by kind,
  span = the field's columnSpan). Each KeyValue becomes a FULL-SPAN item carrying the key-value table.

  Params:
    children - the resolved child nodes in declaration order.
    columns  - the column count the leaf grid lays out in (at least 1).
--%>
@param List<ResolvedNode> children
@param int columns = 1
!{var hasLeaves = false;}
@for(ResolvedNode child : children)
    @if(child instanceof ResolvedNode.Field || child instanceof ResolvedNode.KeyValue)
        !{hasLeaves = true;}
    @endif
@endfor
@if(hasLeaves)
    @template.lievit.description-list(columns = columns, content = @`
        @for(ResolvedNode child : children)
            @if(child instanceof ResolvedNode.Field fld)
                @template.lievit.description-list.item(term = fld.label(), columnSpan = fld.columnSpan(),
                    content = @`@template.kit.infolist.entry(field = fld)`)
            @elseif(child instanceof ResolvedNode.KeyValue kv)
                @template.lievit.description-list.item(term = kv.label(), columnSpan = columns,
                    content = @`@template.kit.infolist.keyvalue(kv = kv)`)
            @endif
        @endfor
    `)
@endif
@for(ResolvedNode child : children)
    @if(!(child instanceof ResolvedNode.Field) && !(child instanceof ResolvedNode.KeyValue))
        @template.kit.infolist.node(node = child)
    @endif
@endfor
