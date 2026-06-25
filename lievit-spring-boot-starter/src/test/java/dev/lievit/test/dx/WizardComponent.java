/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.test.dx;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.Wire;

/**
 * A two-step wizard fixture for the schema/wizard test-DX helpers: {@code nextStep} advances only
 * when the current step's field is filled (a validation gate the {@code goToNextWizardStep} helper
 * exercises), {@code previousStep} goes back.
 */
@LievitComponent(template = "dx/wizard")
public class WizardComponent {

    @Wire int currentStep = 1;

    @Wire String step1Value = "";

    @LievitAction
    void nextStep() {
        // Gate: step 1 requires step1Value to be filled before advancing.
        if (currentStep == 1 && step1Value.isBlank()) {
            return;
        }
        if (currentStep < 2) {
            currentStep++;
        }
    }

    @LievitAction
    void previousStep() {
        if (currentStep > 1) {
            currentStep--;
        }
    }
}
