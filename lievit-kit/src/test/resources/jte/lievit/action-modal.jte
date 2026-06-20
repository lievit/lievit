@import java.util.Map
@import io.lievit.component.ComponentMetadata
@import io.lievit.kit.Field
@import io.lievit.kit.ModalConfig
@import io.lievit.kit.wire.ActionModalComponent
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  Renders a FormAction's modal (the deepened ModalConfig) + its form, driven by ActionModalComponent
  through the real runtime. Proves the audit's "action modals" + "action forms" sub-features render:
  the width token, the icon + colour, the heading/footer alignment, sticky header/footer, the close
  button, the modalContent fragments above/below the schema, the extra footer-action labels; and the
  form fields read-only when disabledForm() is set.

  A11y (WAI-ARIA APG Dialog/Modal): div[role=dialog][aria-modal=true] labelled by the heading;
  closed overlay removed from the a11y tree via `hidden`. No inline <script> (CSP-clean).

  Params:
    open        boolean              modal open state (server-owned)
    state       Map<String,String>   the filled form state (l:model binds each field)
    _instance   ActionModalComponent the live component (carries the action + its modal config)
    _component  ComponentMetadata    always-present wire metadata (the className anchor)
--%>
@param boolean open
@param Map<String, String> state
@param ActionModalComponent _instance
@param ComponentMetadata _component
!{ModalConfig modal = _instance.modal();}
!{var disabledForm = _instance.action().isFormDisabled();}
!{var headingId = "lv-action-modal-heading";}
!{var hasHeading = modal.heading() != null && !modal.heading().isEmpty();}
<div
    data-lievit-component="${_component.className()}"
    data-lv-action-modal
    data-lv-modal-width="${modal.widthToken()}"
    data-lv-modal-slide-over="${modal.slideOver() ? "true" : "false"}"
    data-lv-modal-alignment="${modal.alignment()}"
    data-lv-modal-sticky-header="${modal.stickyHeader() ? "true" : "false"}"
    data-lv-modal-sticky-footer="${modal.stickyFooter() ? "true" : "false"}"
    hidden="${!open}"
    class="fixed inset-0"
>
    <div
        data-lv-modal-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="${hasHeading ? headingId : null}"
        aria-label="${hasHeading ? null : "Action"}"
    >
        <header data-lv-modal-header>
            @if(modal.icon() != null)
                <span data-lv-modal-icon="${modal.icon()}" data-lv-modal-icon-color="${modal.iconColor()}">
                    @template.icon(name = modal.icon(), size = "1.5rem")
                </span>
            @endif
            @if(hasHeading)
                <h2 id="${headingId}" data-lv-modal-heading>${modal.heading()}</h2>
            @endif
            @if(modal.closeButton())
                <button type="button" data-lv-modal-close aria-label="Close" l:click="$set('open', false)">
                    @template.icon(name = "x", size = "1.25rem")
                </button>
            @endif
            @if(modal.description() != null)
                <p data-lv-modal-description>${modal.description()}</p>
            @endif
        </header>
        @if(modal.contentAbove() != null)
            <div data-lv-modal-content-above="${modal.contentAbove()}"></div>
        @endif
        <form l:submit="submit" data-lv-modal-body>
            @for(Field field : _instance.action().form().fields())
                <div data-lv-modal-field="${field.name()}">
                    <label for="lv-af-${field.name()}">${field.label()}</label>
                    <input
                        id="lv-af-${field.name()}"
                        type="text"
                        l:model="state.${field.name()}"
                        value="${state.getOrDefault(field.name(), "")}"
                        disabled="${disabledForm}"
                        data-lv-field-disabled="${disabledForm ? "true" : "false"}"
                    >
                </div>
            @endfor
        </form>
        @if(modal.contentBelow() != null)
            <div data-lv-modal-content-below="${modal.contentBelow()}"></div>
        @endif
        <footer data-lv-modal-footer>
            <button type="button" l:click="submit" data-lv-modal-submit>${modal.submitLabel()}</button>
            <button type="button" l:click="$set('open', false)" data-lv-modal-cancel>${modal.cancelLabel()}</button>
            @for(String extra : modal.extraFooterActions())
                <button type="button" data-lv-modal-extra-action="${extra}">${extra}</button>
            @endfor
        </footer>
    </div>
</div>
