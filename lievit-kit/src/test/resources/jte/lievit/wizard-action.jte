@import java.util.Map
@import dev.lievit.component.ComponentMetadata
@import dev.lievit.kit.WizardAction
@import dev.lievit.kit.wire.WizardActionComponent
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  Renders a WizardAction's multistep modal (the Filament Action::steps([...]) parity), driven by
  WizardActionComponent through the real runtime. Proves the audit's "action wizards" row: a wizard
  INSIDE an action modal, with a step progress strip (the active step marked), per-step Next gating,
  Previous, and a final-step Submit. No inline <script> (CSP-clean); state down via @param, events up
  via l:click.

  A11y: the progress strip is a list; the active step carries aria-current="step".

  Params:
    open        boolean                modal open state (server-owned)
    state       Map<String,String>     the accumulated step state (l:model binds each field)
    invalid     boolean                whether the last submit failed validation
    _instance   WizardActionComponent  the live component (carries the wizard + its cursor)
    _component  ComponentMetadata      always-present wire metadata
--%>
@param boolean open
@param Map<String, String> state
@param boolean invalid
@param WizardActionComponent _instance
@param ComponentMetadata _component
!{WizardAction<?> action = _instance.action();}
!{var current = action.currentStep();}
<div data-lievit-component="${_component.className()}" data-lv-wizard-action hidden="${!open}">
    <div data-lv-wizard-panel role="dialog" aria-modal="true" aria-label="Wizard">
        <ol data-lv-wizard-steps>
            @for(int i = 0; i < action.steps().size(); i++)
                <li
                    data-lv-wizard-step="${action.steps().get(i).label()}"
                    data-lv-wizard-step-index="${i}"
                    data-lv-wizard-step-active="${i == current ? "true" : "false"}"
                    aria-current="${i == current ? "step" : null}"
                >${action.steps().get(i).label()}</li>
            @endfor
        </ol>
        <p data-lv-wizard-current-step>${action.currentStepLabel()}</p>
        @if(invalid)
            <p data-lv-wizard-invalid>Please complete the required fields.</p>
        @endif
        <form l:submit="submit" data-lv-wizard-body>
            <input id="lv-wz-subject" type="text" l:model="state.subject" value="${state.getOrDefault("subject", "")}" data-lv-wizard-field="subject">
            <input id="lv-wz-body" type="text" l:model="state.body" value="${state.getOrDefault("body", "")}" data-lv-wizard-field="body">
        </form>
        <footer data-lv-wizard-footer>
            @if(current > 0)
                <button type="button" l:click="previous" data-lv-wizard-previous>Previous</button>
            @endif
            @if(action.isOnLastStep())
                <button type="button" l:click="submit" data-lv-wizard-submit>Finish</button>
            @else
                <button type="button" l:click="next" data-lv-wizard-next>Next</button>
            @endif
        </footer>
    </div>
</div>
