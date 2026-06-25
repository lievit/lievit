/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.support.EvaluationContext;

/**
 * One validation rule evaluated against a field's value and the live form context (the kit SPI side
 * of the filament-forms {@code CanBeValidated} surface: the rules that need the live state, like the
 * {@code requiredIf} family and cross-field comparisons, which Jakarta Bean Validation cannot
 * express because they read a SIBLING field at validation time).
 *
 * <p>A rule returns {@code null} when the value passes, or a message when it fails. The static
 * factories on {@link Rules} build the rule library; an app supplies a custom {@code rule(...)} via
 * the same interface (the escape hatch).
 */
@FunctionalInterface
public interface Rule {

    /**
     * Validates a value against the live context.
     *
     * @param value the field's current (hydrated) value
     * @param context the live evaluation context (reads sibling fields, operation, record)
     * @return {@code null} if the value passes, otherwise the failure message
     */
    @Nullable String validate(@Nullable Object value, EvaluationContext context);
}
