@import io.lievit.component.ComponentMetadata
@param String email
@param String name
@param boolean business
@param String vatNumber
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}">
    <input l:model.live="email" value="${email}">
    <input l:model.live="name" value="${name}">
    <input l:model="business" type="checkbox">
    @if(business)
        <input l:model="vatNumber" value="${vatNumber}">
    @endif
    <button l:click="save">Save</button>
</div>
