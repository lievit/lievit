@import io.lievit.component.LievitChildren
@import io.lievit.component.ComponentMetadata
@param String title
@param int clicks
@param ComponentMetadata _component
<div data-host data-lievit-component="${_component.className()}">
    $unsafe{LievitChildren.placeholderFor("card")}
</div>
