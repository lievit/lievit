/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import java.util.LinkedHashMap;
import java.util.Map;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitRender;
import io.lievit.Wire;
import io.lievit.component.LievitEffects;
import io.lievit.kit.AdminActionContext;
import io.lievit.kit.AdminActionResult;
import io.lievit.kit.AdminAuthorizer;
import io.lievit.kit.AdminRoutes;
import io.lievit.kit.Resource;
import io.lievit.kit.WizardAction;
import io.lievit.kit.wire.ActionFixtures.Message;

/**
 * A wire host that drives a {@link WizardAction}'s multistep modal end-to-end through the real
 * runtime (the Filament {@code Action::steps([...])} parity): the modal opens on the first step, Next
 * advances only when the current step's required fields are filled (the server-enforced step gate),
 * Previous goes back, and the final-step Submit binds the accumulated state and runs the process. Its
 * {@code lievit/wizard-action} template renders the step strip (with the active step marked) and the
 * current step's Next/Previous/Submit affordances.
 *
 * <p>The wizard cursor lives on the action instance (a fresh prototype per call would lose it, so the
 * cursor is carried in the round-tripped {@link #stepIndex} and re-applied each render). The field
 * state round-trips in {@link #state}.
 */
@LievitComponent(template = "lievit/wizard-action")
public class WizardActionComponent {

    private final WizardAction<Message> action;
    private final Resource<Message> resource;

    /** Modal open state, server-owned. */
    @Wire public boolean open = false;

    /** The accumulated step state (round-trips; each field's {@code l:model} binds it). */
    @Wire public Map<String, String> state = new LinkedHashMap<>();

    /** The current step index, round-tripped so a fresh prototype re-applies the cursor each call. */
    @Wire public int stepIndex = 0;

    /** Whether the last submit failed validation (drives a re-render on the last step). */
    @Wire public boolean invalid = false;

    /**
     * @param action the wizard action to drive
     * @param resource the resource the action targets
     */
    public WizardActionComponent(WizardAction<Message> action, Resource<Message> resource) {
        this.action = action;
        this.resource = resource;
    }

    /** Opens the wizard on the first step. */
    @LievitAction
    public void open() {
        this.open = true;
        this.stepIndex = 0;
        this.invalid = false;
        applyCursor();
    }

    /** Advances to the next step, gating on the current step's required fields. */
    @LievitAction
    public void next() {
        applyCursor();
        if (action.next(state)) {
            this.stepIndex = action.currentStep();
        }
    }

    /** Returns to the previous step. */
    @LievitAction
    public void previous() {
        applyCursor();
        if (action.previous()) {
            this.stepIndex = action.currentStep();
        }
    }

    /** Submits the wizard from the last step: binds the accumulated state and runs the process. */
    @LievitAction
    public void submit() {
        applyCursor();
        AdminActionContext<Message> context =
                new AdminActionContext<>(
                        resource,
                        AdminRoutes.of("admin", resource),
                        AdminAuthorizer.permitAll(),
                        LievitEffects.current(),
                        null,
                        state);
        AdminActionResult result = action.submit(state, context);
        this.invalid = result.status() == AdminActionResult.Status.INVALID;
        if (result.isCompleted()) {
            this.open = false;
        }
    }

    /** Re-applies the round-tripped cursor on EVERY render so the template reads the right step. */
    @LievitRender
    void syncCursor() {
        applyCursor();
    }

    /** Re-applies the round-tripped {@link #stepIndex} onto the action's cursor before each op. */
    private void applyCursor() {
        action.goToStep(stepIndex);
    }

    /** @return the hosted wizard action (its steps the template renders) */
    public WizardAction<Message> action() {
        return action;
    }
}
