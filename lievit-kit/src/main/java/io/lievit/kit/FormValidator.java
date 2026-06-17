/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.ArrayList;
import java.util.List;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;

/**
 * Runs Jakarta Bean Validation against a bound record at <strong>submit time</strong> and translates
 * each {@link ConstraintViolation} into a kit {@link FieldError} the form template can render beside
 * the offending field.
 *
 * <p>Submit-time and kit-level on purpose. The validation runs after the {@link FormBinder} has built
 * the typed record from the submitted state, so the constraints live where they belong: as
 * {@code jakarta.validation} annotations on the adopter's own domain record (the canonical Spring
 * way), not duplicated in the kit. This is deliberately separate from the core real-time
 * {@code FieldValidator} (a different concern that runs per-keystroke over wire state); the two never
 * share state, so they cannot fight.
 *
 * <p>The violation's property path becomes the {@link FieldError#field()}, which lines up with the
 * {@link Field#name()} the form declared, so the template can key its messages by field.
 */
public final class FormValidator {

    private final Validator validator;

    /**
     * @param validator the Jakarta {@link Validator} (the adopter's container provides one; in a
     *     Spring app it is the autoconfigured {@code LocalValidatorFactoryBean})
     */
    public FormValidator(Validator validator) {
        this.validator = validator;
    }

    /**
     * Validates a record and collects its constraint violations as field errors.
     *
     * @param record the bound record to validate
     * @param <T> the record type
     * @return the field errors, in a stable (field-name) order; empty when the record is valid
     */
    public <T> List<FieldError> validate(T record) {
        List<FieldError> errors = new ArrayList<>();
        for (ConstraintViolation<T> violation : validator.validate(record)) {
            String field = violation.getPropertyPath() == null ? "" : violation.getPropertyPath().toString();
            errors.add(FieldError.of(field, violation.getMessage()));
        }
        errors.sort((a, b) -> {
            int byField = a.field().compareTo(b.field());
            return byField != 0 ? byField : a.message().compareTo(b.message());
        });
        return List.copyOf(errors);
    }
}
