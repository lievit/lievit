/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiConsumer;

import org.jspecify.annotations.Nullable;

/**
 * A modal action whose form is a MULTISTEP WIZARD (the Filament {@code Action::steps([Step::make()
 * ...])} carried over): instead of a single {@link Form} the operator fills, the modal walks an
 * ordered set of {@link Step}s with Next/Previous navigation and a per-step completeness gate (Next
 * only advances when the current step's required fields are filled). The whole state from every step
 * is collected and routed into a {@link Form} (its binder + validator) at the final submit, exactly
 * like a {@link FormAction} but staged across steps.
 *
 * <p>The class is both the builder (declare the steps over the same {@link Form}) AND the driver: a
 * wire component holds one instance and calls {@link #next(Map)} / {@link #previous()} /
 * {@link #submit(Map, AdminActionContext)}; the cursor lives here, the field state lives in the
 * snapshot the host owns. The audit's "multistep wizard inside an action modal" gap.
 *
 * @param <T> the resource row type
 */
public final class WizardAction<T> extends AdminAction<T> {

    private final Form<T> form;
    private final BiConsumer<T, AdminActionContext<T>> process;
    private final List<Step> steps = new ArrayList<>();
    private ModalConfig modal = ModalConfig.defaults();
    private int currentStep = 0;

    private WizardAction(
            String name,
            String label,
            AdminOperation operation,
            Form<T> form,
            BiConsumer<T, AdminActionContext<T>> process) {
        super(name, label, operation);
        this.form = Objects.requireNonNull(form, "form");
        this.process = Objects.requireNonNull(process, "process");
    }

    /**
     * Builds a multistep-wizard modal action over a backing form.
     *
     * @param name the action name
     * @param label the button label
     * @param operation the operation gated by the authorizer
     * @param form the backing form (carries the binder + validator the final submit runs)
     * @param process receives the validated record built from the accumulated step state
     * @param <T> the row type
     * @return the wizard action
     */
    public static <T> WizardAction<T> make(
            String name,
            String label,
            AdminOperation operation,
            Form<T> form,
            BiConsumer<T, AdminActionContext<T>> process) {
        return new WizardAction<>(name, label, operation, form, process);
    }

    /**
     * Declares the wizard steps in order. At least two steps make a wizard; one step is just a form.
     *
     * @param toAdd the steps
     * @return this action
     */
    public WizardAction<T> steps(Step... toAdd) {
        for (Step step : toAdd) {
            steps.add(Objects.requireNonNull(step, "step"));
        }
        return this;
    }

    /**
     * Sets the modal configuration.
     *
     * @param config the modal config
     * @return this action
     */
    public WizardAction<T> modal(ModalConfig config) {
        this.modal = Objects.requireNonNull(config, "config");
        return this;
    }

    /** @return the modal configuration */
    public ModalConfig modal() {
        return modal;
    }

    /** @return the backing form */
    public Form<T> form() {
        return form;
    }

    /** @return the steps in order (unmodifiable) */
    public List<Step> steps() {
        return List.copyOf(steps);
    }

    /** @return the number of steps */
    public int stepCount() {
        return steps.size();
    }

    /** @return the current step index (0-based) */
    public int currentStep() {
        return currentStep;
    }

    /** @return the label of the current step */
    public String currentStepLabel() {
        return steps.isEmpty() ? "" : steps.get(currentStep).label();
    }

    /** @return whether the cursor is on the last step (the one whose submit completes the action) */
    public boolean isOnLastStep() {
        return currentStep >= steps.size() - 1;
    }

    /** @return {@code true}: a wizard action always opens a modal */
    public boolean opensModal() {
        return true;
    }

    /**
     * Attempts to advance to the next step, gating on the CURRENT step's completeness: every field
     * the current step declares {@link Step#requires required} must be non-blank in {@code state}.
     * A failing gate keeps the cursor put and returns {@code false} (the modal stays on the step).
     *
     * @param state the accumulated form state so far (every field across steps, keyed by name)
     * @return {@code true} if it advanced, {@code false} if the step is incomplete or already last
     */
    public boolean next(Map<String, String> state) {
        Objects.requireNonNull(state, "state");
        if (isOnLastStep()) {
            return false;
        }
        if (!isStepComplete(currentStep, state)) {
            return false;
        }
        currentStep++;
        return true;
    }

    /**
     * Jumps the cursor directly to a step index WITHOUT gating (used to restore the cursor a stateless
     * wire host round-trips; Next is the gated forward move). An out-of-range index is clamped.
     *
     * @param index the target step index
     * @return this action
     */
    public WizardAction<T> goToStep(int index) {
        if (steps.isEmpty()) {
            return this;
        }
        this.currentStep = Math.max(0, Math.min(index, steps.size() - 1));
        return this;
    }

    /**
     * Returns to the previous step (no re-validation; the wizard keeps the state).
     *
     * @return {@code true} if it moved back, {@code false} if already on the first step
     */
    public boolean previous() {
        if (currentStep == 0) {
            return false;
        }
        currentStep--;
        return true;
    }

    /**
     * Whether a step's required fields are all filled in the accumulated state.
     *
     * @param index the step index
     * @param state the accumulated form state
     * @return whether the step is complete
     */
    public boolean isStepComplete(int index, Map<String, String> state) {
        if (index < 0 || index >= steps.size()) {
            return false;
        }
        for (String field : steps.get(index).required()) {
            String value = state.get(field);
            if (value == null || value.isBlank()) {
                return false;
            }
        }
        return true;
    }

    /**
     * Submits the wizard: only valid on the last step. It binds the accumulated state into a record
     * via the form's binder, validates it with the form's validator, and on success runs the
     * process. Called as the action body from a wire component's final-step submit.
     *
     * @param state the accumulated form state from every step
     * @param context the invocation context
     * @return {@link AdminActionResult#invalid} with the field errors when validation fails, or
     *     completed on success
     */
    public AdminActionResult submit(Map<String, String> state, AdminActionContext<T> context) {
        Objects.requireNonNull(state, "state");
        Objects.requireNonNull(context, "context");
        FormBinder<T> binder = form.binder();
        if (binder == null) {
            throw new IllegalStateException("a WizardAction needs a FormBinder to build its record");
        }
        T record = binder.toRecord(null, state);
        FormValidator validator = form.validator();
        if (validator != null) {
            List<FieldError> errors = validator.validate(record);
            if (!errors.isEmpty()) {
                return AdminActionResult.invalid(errors);
            }
        }
        process.accept(record, context);
        return AdminActionResult.completed(null);
    }

    @Override
    protected AdminActionResult perform(AdminActionContext<T> context) {
        // The default run() path treats a wizard like a one-shot submit of the accumulated state;
        // a wire host drives next()/previous() and calls submit() on the last step explicitly.
        return submit(context.formState(), context);
    }

    /**
     * One step of a wizard modal: a label shown in the progress header and the set of field names
     * that must be filled before Next advances past it (the step's completeness gate).
     */
    public static final class Step {

        private final String label;
        private final Set<String> required = new LinkedHashSet<>();
        private @Nullable String description;
        private @Nullable String icon;

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
         * Declares the fields that must be non-blank before Next advances past this step (the
         * Filament per-step required-field gate).
         *
         * @param fields the required field names
         * @return this step
         */
        public Step requires(String... fields) {
            for (String field : fields) {
                required.add(Objects.requireNonNull(field, "field"));
            }
            return this;
        }

        /**
         * Sets the step description shown under the step label.
         *
         * @param value the description
         * @return this step
         */
        public Step description(String value) {
            this.description = Objects.requireNonNull(value, "description");
            return this;
        }

        /**
         * Sets the step icon name.
         *
         * @param iconName the icon name
         * @return this step
         */
        public Step icon(String iconName) {
            this.icon = Objects.requireNonNull(iconName, "iconName");
            return this;
        }

        /** @return the step label */
        public String label() {
            return label;
        }

        /** @return the required field names (unmodifiable, in declaration order) */
        public Set<String> required() {
            return Set.copyOf(required);
        }

        /** @return the description, or {@code null} */
        public @Nullable String description() {
            return description;
        }

        /** @return the icon name, or {@code null} */
        public @Nullable String icon() {
            return icon;
        }
    }
}
