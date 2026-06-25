@import dev.lievit.component.ComponentMetadata
@param int turns
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}">
    <span l:stream="out"></span>
    <span l:stream="status"></span>
    <button l:click="generate">generate</button>
</div>
