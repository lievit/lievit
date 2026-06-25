/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * A value that is EITHER a constant OR a closure over the {@link EvaluationContext} (the single
 * code path that makes Filament's "almost every setter accepts a value or a closure" mechanic
 * uniform across the whole kit).
 *
 * <p>This is the one place the value-or-closure decision lives, so a setter never reinvents it:
 * {@code visible(true)} and {@code visible(ctx -> ctx.getString("type").equals("pro"))} produce the
 * same {@code ValueOrClosure<Boolean>} and {@link #evaluate} resolves both identically. A constant
 * ignores the context; a closure is applied to it.
 *
 * @param <T> the resolved value type
 */
public final class ValueOrClosure<T extends @Nullable Object> {

    private final @Nullable T constant;
    private final @Nullable Function<EvaluationContext, ? extends T> closure;

    private ValueOrClosure(
            @Nullable T constant, @Nullable Function<EvaluationContext, ? extends T> closure) {
        this.constant = constant;
        this.closure = closure;
    }

    /**
     * Wraps a constant value (the context is ignored at {@link #evaluate} time).
     *
     * @param value the constant
     * @param <T> the value type
     * @return a constant value-or-closure
     */
    public static <T extends @Nullable Object> ValueOrClosure<T> of(@Nullable T value) {
        return new ValueOrClosure<>(value, null);
    }

    /**
     * Wraps a closure evaluated against the live context at {@link #evaluate} time.
     *
     * @param closure the context-reading function
     * @param <T> the resolved value type
     * @return a dynamic value-or-closure
     */
    public static <T extends @Nullable Object> ValueOrClosure<T> ofClosure(
            Function<EvaluationContext, ? extends T> closure) {
        return new ValueOrClosure<>(null, Objects.requireNonNull(closure, "closure"));
    }

    /**
     * @return {@code true} if this holds a closure (evaluated per-call), {@code false} if a constant
     */
    public boolean isClosure() {
        return closure != null;
    }

    /**
     * Resolves the value: the constant as-is, or the closure applied to the context.
     *
     * @param context the live evaluation context (ignored by a constant)
     * @return the resolved value
     */
    public @Nullable T evaluate(EvaluationContext context) {
        Objects.requireNonNull(context, "context");
        if (closure != null) {
            return closure.apply(context);
        }
        return constant;
    }

    /**
     * Resolves the value, substituting a fallback when the resolved value is {@code null}.
     *
     * @param context the live evaluation context
     * @param fallback the value to return when the resolved value is {@code null}
     * @return the resolved value, or {@code fallback} if it resolved to {@code null}
     */
    public T evaluateOr(EvaluationContext context, T fallback) {
        @Nullable T value = evaluate(context);
        return value == null ? fallback : value;
    }
}
