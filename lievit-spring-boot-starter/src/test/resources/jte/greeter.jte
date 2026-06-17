@import io.lievit.component.ComponentMetadata
@import java.util.List
@param String name
@param String owner
@param List<String> greetings
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}" data-lievit-owner="${owner}">
    <input l:model="name" value="${name}">
    <ul>
        @for(String greeting : greetings)
            <li>${greeting}</li>
        @endfor
    </ul>
    <button l:click="greet">Greet</button>
</div>
