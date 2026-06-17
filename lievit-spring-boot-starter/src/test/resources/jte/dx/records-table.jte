@import io.lievit.component.ComponentMetadata
@import java.util.List
@param String search
@param List<String> visible
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}">
    <input l:model="search" value="${search}">
    <table>
        @for(String row : visible)
            <tr data-lievit-row><td>${row}</td></tr>
        @endfor
    </table>
</div>
