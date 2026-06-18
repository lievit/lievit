@import io.lievit.component.ComponentMetadata
@import io.lievit.component.LievitChildren
@param String title
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}" data-title="${title}">
    <div class="leaf">$unsafe{LievitChildren.placeholderFor("leaf")}</div>
</div>
