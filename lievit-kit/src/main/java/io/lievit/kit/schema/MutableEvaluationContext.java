/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.support.EvaluationContext;

/**
 * The writable evaluation context handed to an {@code afterStateUpdated} hook (the only place a
 * closure may {@link #set} a sibling field). It reads and writes through the live {@link SchemaState}
 * so {@code set("region", null)} after a country change actually mutates the form state the next
 * render reads back.
 *
 * <p>This is the mutable twin of the read-only base {@link EvaluationContext}: {@link #get} and
 * {@link #set} both go through the same {@link SchemaState} path resolver, so a hook sees its own
 * writes.
 */
public final class MutableEvaluationContext extends EvaluationContext {

    private final SchemaState state;

    private MutableEvaluationContext(
            @Nullable Object componentState,
            @Nullable Object record,
            Operation operation,
            SchemaState state) {
        super(componentState, record, operation, state.flatten(), state.flatten());
        this.state = state;
    }

    /**
     * Builds a mutable context over a live schema state.
     *
     * @param componentState the current component's own state value
     * @param record the record being edited, or {@code null}
     * @param operation the CRUD operation
     * @param state the live schema state this context reads and writes
     * @return a writable evaluation context
     */
    public static MutableEvaluationContext over(
            @Nullable Object componentState,
            @Nullable Object record,
            Operation operation,
            SchemaState state) {
        return new MutableEvaluationContext(componentState, record, operation, state);
    }

    @Override
    public @Nullable Object get(String path) {
        return state.get(path);
    }

    @Override
    public String getString(String path) {
        return state.getString(path);
    }

    @Override
    public void set(String path, @Nullable Object value) {
        state.set(path, value);
    }

    /**
     * @return the live schema state this context reads and writes through (for assertions /
     *     chaining). Named distinctly from {@link EvaluationContext#state()}, which returns the
     *     component's own value, not the whole state map.
     */
    public SchemaState liveState() {
        return state;
    }
}
