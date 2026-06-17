/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * The type-safe seam between a form's string state and the domain record type {@code <T>}: the kit
 * never reflects field values onto an arbitrary record (that would force a persistence/binding
 * convention and break GraalVM-friendliness), so the adopter declares how a record is built from
 * the submitted field map and how it is read back to prefill an edit form.
 *
 * <p>This keeps the kit persistence-agnostic and reflection-free: the binder is plain typed Java the
 * adopter writes once per resource, the same place the {@link Form} fields are declared.
 *
 * @param <T> the record type the form edits
 */
public interface FormBinder<T> {

    /**
     * Builds (create) or rebuilds (edit) a record from the submitted, per-field string state.
     *
     * @param existing the record being edited, or {@code null} when creating a new one
     * @param state the submitted field values, keyed by {@link Field#name()} (values are strings,
     *     the wire form representation; the binder parses them into the record's typed shape)
     * @return the record to validate and persist
     */
    T toRecord(@Nullable T existing, Map<String, String> state);

    /**
     * Reads a record back into per-field string state, to prefill the edit form.
     *
     * @param record the record being edited
     * @return the field values keyed by {@link Field#name()}
     */
    Map<String, String> toState(T record);
}
