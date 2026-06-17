@import io.lievit.component.ComponentMetadata
@import java.util.List
@import java.util.Map
@param String email
@param String name
@param ComponentMetadata _component
@param Map<String, List<String>> _errors = null
<div data-lievit-component="${_component.className()}">
    <form>
        <div>
            <input l:model.blur="email" name="email" value="${email}">
            @if(_errors != null && _errors.containsKey("email"))
                @for(String msg : _errors.get("email"))
                    <span class="error" data-field="email">${msg}</span>
                @endfor
            @endif
        </div>
        <div>
            <input l:model.blur="name" name="name" value="${name}">
            @if(_errors != null && _errors.containsKey("name"))
                @for(String msg : _errors.get("name"))
                    <span class="error" data-field="name">${msg}</span>
                @endfor
            @endif
        </div>
        <button l:click="submit">Register</button>
    </form>
</div>
