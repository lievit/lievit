/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.support.EvaluationContext;

/**
 * A read-only display component inside a form (the filament-schemas {@code Placeholder} carried
 * over): a label paired with a value that is COMPUTED from the live state, never an input. It binds
 * no state path, contributes nothing to validation, and is never dehydrated, so it is a transparent
 * passenger in the engine: use it for computed totals, derived hints, or contextual info shown
 * between inputs.
 *
 * <p>It is not a {@link SchemaField} (it has no value type to bind, hydrate, or persist); it is a
 * {@link SchemaComponent} that overrides nothing of the lifecycle and simply resolves its content
 * on render.
 */
public final class Placeholder extends SchemaComponent<@Nullable Object, Placeholder> {

    private final String label;
    private Function<EvaluationContext, @Nullable String> content = ctx -> "";

    private Placeholder(String label) {
        this.label = Objects.requireNonNull(label, "label");
        dehydrated(false);
    }

    /**
     * @param label the display label
     * @return a new placeholder
     */
    public static Placeholder make(String label) {
        return new Placeholder(label);
    }

    /**
     * @return the display label
     */
    public String label() {
        return label;
    }

    /**
     * Sets a constant content string.
     *
     * @param content the text to display
     * @return this placeholder
     */
    public Placeholder content(String content) {
        Objects.requireNonNull(content, "content");
        this.content = ctx -> content;
        return this;
    }

    /**
     * Sets computed content (a closure over the live state): the derived value recomputes on each
     * render, so it can read sibling fields through the context.
     *
     * @param content produces the text from the live context
     * @return this placeholder
     */
    public Placeholder content(Function<EvaluationContext, @Nullable String> content) {
        this.content = Objects.requireNonNull(content, "content");
        return this;
    }

    /**
     * Resolves the displayed content against the live context.
     *
     * @param context the live evaluation context
     * @return the resolved content, or the empty string
     */
    public String resolveContent(EvaluationContext context) {
        @Nullable String resolved = content.apply(context);
        return resolved == null ? "" : resolved;
    }
}
