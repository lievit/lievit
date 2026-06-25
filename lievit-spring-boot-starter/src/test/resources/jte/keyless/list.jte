@import dev.lievit.component.ComponentMetadata
@import dev.lievit.spring.keyless.KeylessListComponent
@param int rows
@param ComponentMetadata _component
@param Object _instance
<div data-lievit-component="${_component.className()}">
    <ul data-lievit-rows="${rows}">
        @for(String placeholder : ((KeylessListComponent) _instance).placeholders())
            <li>$unsafe{placeholder}</li>
        @endfor
    </ul>
    <button l:click="addRow">add row</button>
</div>
