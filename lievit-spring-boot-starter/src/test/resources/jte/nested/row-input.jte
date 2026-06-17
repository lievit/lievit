@import com.iambilotta.lievit.component.ComponentMetadata
@param String value
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}">
    <input l:model="value" value="${value}">
</div>
