/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.BiConsumer;

import org.jspecify.annotations.Nullable;

/**
 * A modal action that collects input through a {@link Form} (the Filament {@code HasSchema} +
 * {@code HasData} + {@code CanSubmitForm} composition): it opens a modal carrying the form, fills it
 * on mount (from a record or defaults), validates the submitted state on submit, and routes the
 * validated record into a custom process. The classic non-CRUD action: "Send email", "Assign to
 * user", "Change status with reason".
 *
 * <p>Reuses the existing {@link Form} DSL + its {@link FormValidator}; on a validation failure it
 * returns {@link AdminActionResult#invalid} so the host re-renders the modal form with the field
 * errors. On success it runs the {@link #process} body and completes.
 *
 * @param <T> the resource row type
 */
public final class FormAction<T> extends AdminAction<T> {

    private final Form<T> form;
    private final BiConsumer<T, AdminActionContext<T>> process;
    private ModalConfig modal = ModalConfig.defaults();
    private boolean disabledForm;

    private FormAction(
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
     * Builds a modal-with-form action.
     *
     * @param name the action name
     * @param label the button label
     * @param operation the operation gated by the authorizer
     * @param form the modal form (must carry a {@link FormBinder} and, for validation, a
     *     {@link FormValidator})
     * @param process receives the validated record built from the submitted state
     * @param <T> the row type
     * @return the form action
     */
    public static <T> FormAction<T> make(
            String name,
            String label,
            AdminOperation operation,
            Form<T> form,
            BiConsumer<T, AdminActionContext<T>> process) {
        return new FormAction<>(name, label, operation, form, process);
    }

    /**
     * Sets the modal configuration.
     *
     * @param config the modal config
     * @return this action
     */
    public FormAction<T> modal(ModalConfig config) {
        this.modal = Objects.requireNonNull(config, "config");
        return this;
    }

    /** @return the modal configuration */
    public ModalConfig modal() {
        return modal;
    }

    /** @return the modal form */
    public Form<T> form() {
        return form;
    }

    /**
     * Renders the modal form READ-ONLY (the Filament {@code disabledForm()} / {@code disabled()} on
     * the action's form): the fields show the prefilled state but cannot be edited, and the action
     * runs its process on the unchanged record. Use it for a "confirm with context" modal that shows
     * the record's current values without letting the operator change them.
     *
     * @return this action
     */
    public FormAction<T> disabledForm() {
        this.disabledForm = true;
        return this;
    }

    /** @return whether the modal form renders read-only (the {@code disabledForm()} flag) */
    public boolean isFormDisabled() {
        return disabledForm;
    }

    /**
     * Fills the modal form's initial state when the modal mounts. A {@link #mountUsing} closure (the
     * Filament {@code mountUsing()} / {@code fillForm()}) wins when set; otherwise the state is
     * derived from the record (edit) or empty (a fresh create-style modal).
     *
     * @param record the record to prefill from, or {@code null} for an empty form
     * @return the per-field initial state
     */
    public Map<String, String> fill(@Nullable T record) {
        Map<String, String> mounted = mountState(record);
        if (!mounted.isEmpty()) {
            return mounted;
        }
        return record == null ? Map.of() : form.stateOf(record);
    }

    /** @return {@code true}: a form action always opens a modal */
    public boolean opensModal() {
        return true;
    }

    @Override
    protected AdminActionResult perform(AdminActionContext<T> context) {
        FormBinder<T> binder = form.binder();
        if (binder == null) {
            throw new IllegalStateException("a FormAction needs a FormBinder to build its record");
        }
        T record = binder.toRecord(null, context.formState());
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
}
