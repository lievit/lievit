/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;

/**
 * One submit-time validation error against a form: the bound field name plus the human message to
 * show beside it (the Filament "validation errors render under the field" UX, expressed as plain
 * data the JTE form template iterates).
 *
 * <p>Kit-level on purpose. This is the <em>submit-time</em> error surface (collected by
 * {@link Form#save}); it is deliberately distinct from the core real-time {@code FieldValidator},
 * so the two validation concerns do not fight (they run at different moments and own different
 * state).
 *
 * @param field the bound field name (matches a {@link Field#name()}); empty for a record-level
 *     error not tied to a single field
 * @param message the human-readable error message
 */
public record FieldError(String field, String message) {

    /** Compact constructor: both components are required (the field may be the empty string). */
    public FieldError {
        Objects.requireNonNull(field, "field");
        Objects.requireNonNull(message, "message");
    }

    /**
     * @param field the bound field name
     * @param message the error message
     * @return a field-scoped error
     */
    public static FieldError of(String field, String message) {
        return new FieldError(field, message);
    }
}
