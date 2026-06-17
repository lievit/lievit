/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.util.List;
import java.util.Map;

/**
 * SPI: validates a component instance after client updates have been applied and before any
 * {@code @LievitAction} runs.
 *
 * <p>Implementations return a map of {@code fieldName -> [message, ...]}. An empty map (or
 * {@code null}) means "no errors": actions run normally. A non-empty map means one or more fields
 * are invalid: the errors are written to the effects channel (as the {@code errors} effect in the
 * {@code Lievit-Effects} header) and the actions are <em>skipped</em> for this call — validation is
 * server-authoritative.
 *
 * <p>Only validation messages are ever surfaced to the client; internal class names, stack traces,
 * and payload content are never exposed (ADR-0014, fail-closed posture).
 *
 * <p>The default implementation ({@link NoOpFieldValidator}) passes every instance unchanged, so
 * omitting a validator in tests or small apps has zero cost.
 *
 * <p>The Spring Boot starter auto-configures a {@link jakarta.validation.Validator}-backed
 * implementation when Hibernate Validator is on the classpath; applications may provide their own
 * bean to override.
 */
public interface FieldValidator {

    /**
     * Validates {@code instance} and returns per-field constraint violations.
     *
     * @param instance the rehydrated + updated component instance to validate
     * @return a map from {@code @Wire} field name to its constraint-violation messages; empty or
     *     {@code null} if the instance is valid
     */
    Map<String, List<String>> validate(Object instance);
}
