/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.List;

import org.jspecify.annotations.Nullable;

/**
 * The outcome of a {@link Form#save} call: either a success carrying the persisted record, or a
 * failure carrying the {@link FieldError field errors} that blocked the save.
 *
 * <p>It is a value type so the page component can branch on {@link #ok()} without exceptions:
 * success drives the {@code CreateAction}/{@code EditAction} effect (flash + redirect), failure
 * re-renders the form with the errors. Exactly one of {@link #record()} (on success) or
 * {@link #errors()} (on failure) is meaningful.
 *
 * @param ok whether the save succeeded
 * @param record the persisted record on success; {@code null} on failure
 * @param errors the validation errors on failure; empty on success
 * @param <T> the record type
 */
public record SaveResult<T>(boolean ok, @Nullable T record, List<FieldError> errors) {

    /** Compact constructor: defends the error list. */
    public SaveResult {
        errors = List.copyOf(errors);
    }

    /**
     * @param record the persisted record
     * @param <T> the record type
     * @return a successful result
     */
    public static <T> SaveResult<T> success(T record) {
        return new SaveResult<>(true, record, List.of());
    }

    /**
     * @param errors the validation errors that blocked the save (must be non-empty)
     * @param <T> the record type
     * @return a failed result
     */
    public static <T> SaveResult<T> failure(List<FieldError> errors) {
        if (errors.isEmpty()) {
            throw new IllegalArgumentException("a failed SaveResult must carry at least one error");
        }
        return new SaveResult<>(false, null, errors);
    }
}
