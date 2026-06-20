@import io.lievit.component.ComponentMetadata
@import io.lievit.kit.auth.AuthFormView
@import io.lievit.kit.auth.AuthPageComponent
@param AuthPageComponent _instance
@param ComponentMetadata _component
!{AuthFormView view = _instance.view();}
<div data-lievit-component="${_component.className()}" data-auth-form>
    <h1 data-auth-heading>${view.heading()}</h1>
    @if(view.hasFormMessage())
        <p data-auth-message data-auth-message-error="${view.messageIsError()}" role="${view.messageIsError() ? "alert" : "status"}">${view.formMessage()}</p>
    @endif
    <form l:submit="submit" method="post">
        @for(AuthFormView.FieldView field : view.fields())
            <div data-auth-field="${field.name()}">
                <label for="${field.name()}">${field.label()}</label>
                <input id="${field.name()}"
                       name="${field.name()}"
                       type="${field.inputType()}"
                       l:model="state.${field.name()}"
                       value="${field.value()}"
                       aria-required="${field.required()}"
                       aria-invalid="${field.hasError()}"
                       aria-describedby="${field.hasError() ? field.name() + "-error" : null}">
                @if(field.hasError())
                    <p id="${field.name()}-error" data-auth-field-error="${field.name()}" role="alert">${field.error()}</p>
                @endif
            </div>
        @endfor
        <button type="submit" data-auth-submit>${view.submitLabel()}</button>
    </form>
    @if(view.hasLinks())
        <nav data-auth-links>
            @for(AuthFormView.Link link : view.links())
                <a href="${link.url()}" data-auth-link>${link.label()}</a>
            @endfor
        </nav>
    @endif
</div>
