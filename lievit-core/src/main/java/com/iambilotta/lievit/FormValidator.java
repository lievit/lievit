/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

/**
 * Drives Bean Validation (JSR-380) for {@link LievitFormObject} instances (ADR-0015).
 *
 * <p>This class is intentionally not public API: it is the implementation detail behind
 * {@link LievitFormObject#validate()}. An adopter never calls it directly. It resolves a
 * {@link Validator} once at class-load time from the default {@link ValidatorFactory}, and the
 * factory is closed on JVM exit via a shutdown hook.
 *
 * <p>The default factory uses the Bean Validation provider on the classpath (Hibernate Validator
 * in a Spring Boot app). In a Spring Boot app the EL implementation (tomcat-embed-el / Tomcat)
 * is always present on the runtime classpath, so message interpolation works out of the box.
 *
 * <p>GraalVM-native note: Hibernate Validator 8.x+ carries GraalVM reflect-config out of the box;
 * no extra native-image hints are needed (ADR-0006).
 */
final class FormValidator {

    private static final Validator VALIDATOR = buildValidator();

    private FormValidator() {}

    /**
     * Validates a {@link LievitFormObject} using Bean Validation and returns the result.
     *
     * <p>Field-level violations ({@link jakarta.validation.constraints} on the form object's own
     * fields) are collected, keyed by the simple field name. Cross-field / class-level violations
     * carry the empty string as the key.
     *
     * @param form the form object to validate (must not be {@code null})
     * @return the validation result; {@link FormValidationResult#VALID} when there are no violations
     */
    static FormValidationResult validate(LievitFormObject form) {
        Set<ConstraintViolation<LievitFormObject>> violations = VALIDATOR.validate(form);
        if (violations.isEmpty()) {
            return FormValidationResult.VALID;
        }

        Map<String, List<String>> grouped = new LinkedHashMap<>();
        for (ConstraintViolation<LievitFormObject> v : violations) {
            // propertyPath is e.g. "email" for a field constraint, "" for a class-level one.
            String field = v.getPropertyPath().toString();
            grouped.computeIfAbsent(field, k -> new ArrayList<>()).add(v.getMessage());
        }

        // Convert each list to an unmodifiable view so FormValidationResult.violations is clean.
        Map<String, List<String>> immutable = new LinkedHashMap<>();
        for (Map.Entry<String, List<String>> entry : grouped.entrySet()) {
            immutable.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return new FormValidationResult(immutable);
    }

    private static Validator buildValidator() {
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        Runtime.getRuntime().addShutdownHook(new Thread(factory::close, "lievit-validator-shutdown"));
        return factory.getValidator();
    }
}
