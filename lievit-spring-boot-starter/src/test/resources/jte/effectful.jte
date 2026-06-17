@import com.iambilotta.lievit.component.ComponentMetadata
@param int count
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}">
    <span data-lievit-count>${count}</span>
    <button l:click="save">save</button>
    <button l:click="leave">leave</button>
</div>
