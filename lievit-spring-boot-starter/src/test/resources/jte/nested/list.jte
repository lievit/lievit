@import io.lievit.component.ComponentMetadata
@import io.lievit.component.LievitChildren
@param int rows
@param String draft
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}">
    <ul data-lievit-rows="${rows}">
        @for(int i = 0; i < rows; i++)
            <li>$unsafe{LievitChildren.placeholderFor("row-" + i)}</li>
        @endfor
    </ul>
    <div class="draft">$unsafe{LievitChildren.placeholderFor("draft-input")}</div>
    <div class="decorated">$unsafe{LievitChildren.placeholderFor("decorated-row")}</div>
    <button l:click="addRow">add row</button>
</div>
