@import io.lievit.component.ComponentMetadata
@param int count
@param String label
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}" data-lievit-label="${label}">
    <span data-lievit-count>${count}</span>
    <button l:click="increment">+1</button>
</div>
