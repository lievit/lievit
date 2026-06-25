/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Predicate;

import org.jspecify.annotations.Nullable;

/**
 * A multi-step form (the filament-schemas {@code Wizard} + {@code Wizard/Step} carried over): an
 * ordered list of {@link Step}s with a progress header, Next/Previous navigation, and a per-step
 * validation gate (Next validates only the current step before advancing). The whole form's state
 * from every step is dehydrated together at the final submit.
 *
 * <p>This class is both the builder (declare the steps) AND the lightweight driver (track the
 * current step index, gate advancement on the current step's validation). The driver holds only the
 * cursor; the state lives in the {@link SchemaState} the host owns.
 */
public final class Wizard extends SchemaComponent<@Nullable Object, Wizard> {

    private final List<Step> steps = new ArrayList<>();
    private int currentStep = 0;

    private Wizard() {}

    /**
     * @return a new wizard positioned on the first step
     */
    public static Wizard make() {
        return new Wizard();
    }

    /**
     * Declares the wizard steps in order.
     *
     * @param toAdd the steps
     * @return this wizard
     */
    public Wizard steps(Step... toAdd) {
        for (Step step : toAdd) {
            steps.add(Objects.requireNonNull(step, "step"));
        }
        return this;
    }

    /**
     * @return the steps in order (unmodifiable)
     */
    public List<Step> steps() {
        return List.copyOf(steps);
    }

    /**
     * @return the count of steps
     */
    public int stepCount() {
        return steps.size();
    }

    /**
     * @return the current step index (0-based)
     */
    public int currentStep() {
        return currentStep;
    }

    /**
     * Attempts to advance to the next step. The current step's validation runs first (its
     * {@code beforeValidation} hook, then its validity predicate, then its {@code afterValidation}
     * hook on success); a failing validity blocks the advance and the cursor stays put.
     *
     * @param state the live schema state the validity predicate reads
     * @return {@code true} if it advanced, {@code false} if blocked (invalid) or already last
     */
    public boolean goToNextStep(SchemaState state) {
        if (currentStep >= steps.size() - 1) {
            return false;
        }
        Step step = steps.get(currentStep);
        step.runBeforeValidation();
        if (!step.isValid(state)) {
            return false;
        }
        step.runAfterValidation();
        currentStep++;
        return true;
    }

    /**
     * Returns to the previous step without re-validation.
     *
     * @return {@code true} if it moved back, {@code false} if already on the first step
     */
    public boolean goToPreviousStep() {
        if (currentStep == 0) {
            return false;
        }
        currentStep--;
        return true;
    }

    /**
     * Jumps directly to a step index (no validation; used by a clickable progress header for steps
     * already passed).
     *
     * @param index the target step index
     * @return {@code true} if the index is in range and the cursor moved
     */
    public boolean goToStep(int index) {
        if (index < 0 || index >= steps.size()) {
            return false;
        }
        currentStep = index;
        return true;
    }

    /** One step of a wizard: a titled child schema with an optional validity gate and hooks. */
    public static final class Step extends Layout<Step> {

        private final String label;
        private Predicate<SchemaState> validity = state -> true;
        private @Nullable Runnable beforeValidation;
        private @Nullable Runnable afterValidation;

        private Step(String label) {
            this.label = Objects.requireNonNull(label, "label");
        }

        /**
         * @param label the step label shown in the progress header
         * @return a new step
         */
        public static Step make(String label) {
            return new Step(label);
        }

        /**
         * @return the step label
         */
        public String label() {
            return label;
        }

        /**
         * Sets the validity gate: {@code goToNextStep} blocks while this returns {@code false}.
         *
         * @param validity reads the live state, returns whether the step is complete
         * @return this step
         */
        public Step validateUsing(Predicate<SchemaState> validity) {
            this.validity = Objects.requireNonNull(validity, "validity");
            return this;
        }

        /**
         * @param state the live state
         * @return whether this step is currently valid
         */
        public boolean isValid(SchemaState state) {
            return validity.test(state);
        }

        /**
         * Sets a hook that runs before the step's validation on advance.
         *
         * @param hook the before-validation hook
         * @return this step
         */
        public Step beforeValidation(Runnable hook) {
            this.beforeValidation = Objects.requireNonNull(hook, "hook");
            return this;
        }

        /**
         * Sets a hook that runs after a successful validation, just before advancing.
         *
         * @param hook the after-validation hook
         * @return this step
         */
        public Step afterValidation(Runnable hook) {
            this.afterValidation = Objects.requireNonNull(hook, "hook");
            return this;
        }

        void runBeforeValidation() {
            if (beforeValidation != null) {
                beforeValidation.run();
            }
        }

        void runAfterValidation() {
            if (afterValidation != null) {
                afterValidation.run();
            }
        }
    }
}
