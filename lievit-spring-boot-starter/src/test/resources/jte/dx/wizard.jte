@import dev.lievit.component.ComponentMetadata
@param int currentStep
@param String step1Value
@param ComponentMetadata _component
<div data-lievit-component="${_component.className()}">
    <span data-lievit-step>${currentStep}</span>
    @if(currentStep == 1)
        <input l:model="step1Value" value="${step1Value}">
    @endif
    <button l:click="nextStep">Next</button>
    <button l:click="previousStep">Back</button>
</div>
