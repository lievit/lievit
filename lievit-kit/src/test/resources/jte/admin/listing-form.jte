@import java.util.Map
@import dev.lievit.component.ComponentMetadata
@import dev.lievit.kit.AdminFormView
@import dev.lievit.kit.hello.FormPage
@param FormPage _instance
@param Map<String, String> state
@param String listUrl
@param String recordId
@param boolean editing
@param ComponentMetadata _component
!{AdminFormView view = _instance.view();}
<div data-lievit-component="${_component.className()}" data-admin-form>
    <h1 data-admin-heading>${view.heading()}</h1>
    @if(!view.recordErrors().isEmpty())
        <ul data-admin-record-errors>
            @for(String error : view.recordErrors())
                <li>${error}</li>
            @endfor
        </ul>
    @endif
    <form l:submit="save" data-admin-editing="${editing}">
        @for(AdminFormView.FieldView field : view.fields())
            <div data-admin-field="${field.name()}" data-admin-field-type="${field.type()}">
                <label for="${field.name()}">${field.label()}</label>
                <input id="${field.name()}" type="text" l:model="state.${field.name()}" value="${field.value()}">
                @if(field.hasErrors())
                    <ul data-admin-field-errors="${field.name()}">
                        @for(String error : field.errors())
                            <li>${error}</li>
                        @endfor
                    </ul>
                @endif
            </div>
        @endfor
        <button type="submit" data-admin-submit>${editing ? "Save" : "Create"}</button>
    </form>
    @if(editing)
        <button l:click="delete" data-admin-delete="${recordId}">Delete</button>
    @endif
    <a href="${listUrl}" data-admin-cancel>Cancel</a>
</div>
