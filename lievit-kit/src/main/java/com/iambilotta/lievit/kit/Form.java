/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The form-view builder of an {@link Resource}: an ordered list of {@link Field fields}
 * built with a fluent DSL (the filament-internals.md Form builder, on the shared {@link Schema}
 * parent so it never needs a later unification with the table builder).
 *
 * <p>Beyond declaring fields, a form owns the <strong>write path</strong>: a {@link FormBinder}
 * maps the submitted string state to the typed record and back, an optional {@link FormValidator}
 * gates the save at submit time, and {@link #save} ties them to the {@link RecordRepository}.
 * Without a binder a form is read-only (fields render, but {@link #save} refuses): the
 * list-only hello-admin skeleton needs no binder.
 *
 * @param <T> the row type the form edits
 */
public final class Form<T> extends Schema<T, Form<T>> {

    private final List<Field> fields = new ArrayList<>();
    private @Nullable FormBinder<T> binder;
    private @Nullable FormValidator validator;

    private Form() {}

    /**
     * @param <T> the row type
     * @return a new, empty form builder
     */
    public static <T> Form<T> create() {
        return new Form<>();
    }

    /**
     * Adds a field with an explicit label.
     *
     * @param name the bound field name
     * @param label the display label
     * @return this builder
     */
    public Form<T> field(String name, String label) {
        fields.add(new Field(name, label));
        return this;
    }

    /**
     * Adds a field whose label is humanized from its name ({@code "city"} -&gt; {@code "City"}).
     *
     * @param name the bound field name
     * @return this builder
     */
    public Form<T> field(String name) {
        return field(name, Field.humanize(name));
    }

    /**
     * Adds a pre-built typed field (e.g. {@link TextField}, {@link SelectField}).
     *
     * <p>Use this overload when the field carries type-specific configuration that the bare
     * {@code field(name, label)} convenience cannot express. The field's name and label are already
     * set on the instance; the form records it as declared.
     *
     * @param field the pre-built field, must not be null
     * @return this builder
     */
    public Form<T> field(Field field) {
        fields.add(Objects.requireNonNull(field, "field"));
        return this;
    }

    /**
     * @return the fields, in declaration order, as an unmodifiable snapshot
     */
    public List<Field> fields() {
        return Collections.unmodifiableList(fields);
    }

    /**
     * Declares how the form's string state maps to and from the record type (the write path). A form
     * without a binder is read-only.
     *
     * @param binder the adopter's typed state-to-record mapping
     * @return this builder
     */
    public Form<T> binder(FormBinder<T> binder) {
        this.binder = Objects.requireNonNull(binder, "binder");
        return this;
    }

    /**
     * @return the declared binder, or {@code null} if the form is read-only
     */
    public @Nullable FormBinder<T> binder() {
        return binder;
    }

    /**
     * Declares the submit-time validator that gates {@link #save}. Optional: without one, the form
     * persists whatever the binder produces (the adopter takes responsibility for validity).
     *
     * @param validator the Jakarta-backed submit-time validator
     * @return this builder
     */
    public Form<T> validator(FormValidator validator) {
        this.validator = Objects.requireNonNull(validator, "validator");
        return this;
    }

    /**
     * @return the declared validator, or {@code null} if the form runs no submit-time validation
     */
    public @Nullable FormValidator validator() {
        return validator;
    }

    /**
     * Reads an existing record back into per-field string state, to prefill the edit form.
     *
     * @param record the record being edited
     * @return the field values keyed by {@link Field#name()}
     * @throws IllegalStateException if the form has no {@link #binder}
     */
    public Map<String, String> stateOf(T record) {
        return requireBinder().toState(record);
    }

    /**
     * Maps submitted state to a record, validates it, and persists it through the repository.
     *
     * <p>The full submit lifecycle in one call: bind the string state to a typed record, run the
     * submit-time validator (if any), and on success persist it as a create ({@code editId == null})
     * or an update. A validation failure returns a {@link SaveResult#failure} carrying the field
     * errors and persists <strong>nothing</strong> (the block is the whole point), so the page can
     * re-render the form with the errors. The repository write is reached only on a valid record.
     *
     * @param repository the data port to persist through
     * @param editId the id of the record being edited, or {@code null} to create a new one
     * @param state the submitted field values, keyed by {@link Field#name()}
     * @return success with the persisted record, or failure with the validation errors
     * @throws IllegalStateException if the form has no {@link #binder} (a read-only form cannot save)
     */
    public SaveResult<T> save(
            RecordRepository<T> repository, @Nullable String editId, Map<String, String> state) {
        Objects.requireNonNull(repository, "repository");
        Objects.requireNonNull(state, "state");
        FormBinder<T> activeBinder = requireBinder();

        @Nullable T existing = editId == null ? null : repository.findById(editId).orElse(null);
        T record = activeBinder.toRecord(existing, state);

        if (validator != null) {
            List<FieldError> errors = validator.validate(record);
            if (!errors.isEmpty()) {
                return SaveResult.failure(errors);
            }
        }

        T persisted = editId == null ? repository.create(record) : repository.update(editId, record);
        return SaveResult.success(persisted);
    }

    private FormBinder<T> requireBinder() {
        if (binder == null) {
            throw new IllegalStateException(
                    "this Form is read-only: declare a FormBinder via .binder(...) before saving or"
                            + " prefilling");
        }
        return binder;
    }
}
