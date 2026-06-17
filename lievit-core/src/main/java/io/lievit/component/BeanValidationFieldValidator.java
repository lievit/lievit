/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;

/**
 * A {@link FieldValidator} backed by a {@link jakarta.validation.Validator} (Jakarta Bean
 * Validation 3.1, typically Hibernate Validator). Auto-configured by the Spring Boot starter when
 * Hibernate Validator is on the classpath; applications may provide their own {@link FieldValidator}
 * bean to override.
 *
 * <p>Maps every {@link ConstraintViolation} to its property path's first node (the field name) and
 * its message, producing a {@code Map<fieldName, [message, ...]>} suitable for the
 * {@code errors} effect in the {@code Lievit-Effects} header.
 *
 * <p><strong>Fail-closed / no-leak (ADR-0014):</strong> only constraint messages are surfaced to
 * the client. The validator never reveals internal class names, field types, or payload content
 * through the messages it exposes.
 */
public final class BeanValidationFieldValidator implements FieldValidator {

    private final Validator validator;

    /**
     * @param validator the Jakarta {@link Validator} instance (provided by the Spring Boot starter
     *     via {@code LocalValidatorFactoryBean} / {@code spring-boot-starter-validation})
     */
    public BeanValidationFieldValidator(Validator validator) {
        this.validator = validator;
    }

    /**
     * {@inheritDoc}
     *
     * <p>Runs {@link Validator#validate} on the instance and groups the resulting
     * {@link ConstraintViolation}s by property-path root node (the field name). The messages are
     * the validator's interpolated messages; no internal detail is added.
     */
    @Override
    public Map<String, List<String>> validate(Object instance) {
        Set<ConstraintViolation<Object>> violations = validator.validate(instance);
        if (violations.isEmpty()) {
            return Map.of();
        }
        // LinkedHashMap preserves declaration order across the property bag.
        Map<String, List<String>> errors = new LinkedHashMap<>();
        for (ConstraintViolation<Object> violation : violations) {
            // The property path root node is the field name for @Wire fields annotated with Bean
            // Validation constraints (e.g. email, name). Nested paths are concatenated
            // (e.g. "address.street"), matching Livewire's convention.
            String field = violation.getPropertyPath().toString();
            errors.computeIfAbsent(field, k -> new ArrayList<>()).add(violation.getMessage());
        }
        return errors;
    }
}
