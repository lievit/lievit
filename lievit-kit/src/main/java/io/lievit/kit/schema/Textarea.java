/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.support.EvaluationContext;

/**
 * A multi-line text input on the schema engine (the filament-forms {@code Textarea} carried over).
 * The repo's older {@code TextareaField} lives outside the schemas engine; this is the schema-engine
 * Textarea the audit's {@code Textarea} row asks for: it binds a {@link String} state path and
 * carries the textarea-specific surface Filament's Textarea has and {@link TextInput} does not: a
 * fixed {@code rows} height, {@code autosize} growth, {@code readOnly}, length constraints, and
 * {@code trim} (which normalizes the persisted value, threaded through the engine's
 * {@code dehydrateStateUsing} transform so trimming actually changes what persists).
 */
public final class Textarea extends SchemaField<String, Textarea> {

    private int rows = 3;
    private boolean autosize;
    private boolean readOnly;
    private @Nullable Integer maxLength;
    private @Nullable Integer minLength;

    private Textarea(String name) {
        super(name);
    }

    private Textarea(String name, String label) {
        super(name, label);
    }

    /**
     * @param name the field name and state path
     * @return a new textarea
     */
    public static Textarea make(String name) {
        return new Textarea(name);
    }

    /**
     * @param name the field name and state path
     * @param label the explicit label
     * @return a new textarea
     */
    public static Textarea make(String name, String label) {
        return new Textarea(name, label);
    }

    /**
     * Sets the visible row count (the filament {@code rows}).
     *
     * @param rows the number of visible text lines (at least 1)
     * @return this field
     */
    public Textarea rows(int rows) {
        if (rows < 1) {
            throw new IllegalArgumentException("rows must be at least 1");
        }
        this.rows = rows;
        return this;
    }

    /**
     * @return the visible row count (default 3)
     */
    public int rows() {
        return rows;
    }

    /**
     * Grows the textarea with its content (the filament {@code autosize}).
     *
     * @return this field
     */
    public Textarea autosize() {
        this.autosize = true;
        return this;
    }

    /**
     * @return {@code true} if the textarea autosizes to its content
     */
    public boolean isAutosize() {
        return autosize;
    }

    /**
     * Renders the textarea read-only (the filament {@code readOnly}): the value shows and submits but
     * cannot be edited (distinct from {@code disabled}, which omits the value).
     *
     * @return this field
     */
    public Textarea readOnly() {
        this.readOnly = true;
        return this;
    }

    /**
     * @return {@code true} if the textarea is read-only
     */
    public boolean isReadOnly() {
        return readOnly;
    }

    /**
     * Sets the maximum length and adds the matching {@code max} validation rule (the filament
     * {@code maxLength}).
     *
     * @param maxLength the maximum character count
     * @return this field
     */
    public Textarea maxLength(int maxLength) {
        if (maxLength < 1) {
            throw new IllegalArgumentException("maxLength must be at least 1");
        }
        this.maxLength = maxLength;
        return rule(Rules.max(maxLength));
    }

    /**
     * @return the maximum length, or {@code null} if unbounded
     */
    public @Nullable Integer maxLength() {
        return maxLength;
    }

    /**
     * Sets the minimum length and adds the matching {@code min} validation rule (the filament
     * {@code minLength}).
     *
     * @param minLength the minimum character count
     * @return this field
     */
    public Textarea minLength(int minLength) {
        if (minLength < 0) {
            throw new IllegalArgumentException("minLength must not be negative");
        }
        this.minLength = minLength;
        return rule(Rules.min(minLength));
    }

    /**
     * @return the minimum length, or {@code null} if unbounded
     */
    public @Nullable Integer minLength() {
        return minLength;
    }

    /**
     * Trims surrounding whitespace from the value before it persists (the filament {@code trim}).
     * Wired through the engine's {@code dehydrateStateUsing} transform, so the trim changes the
     * stored value, not just the display.
     *
     * @return this field
     */
    public Textarea trim() {
        dehydrateStateUsing(Textarea::trimmed);
        return this;
    }

    private static @Nullable Object trimmed(@Nullable String value, EvaluationContext ctx) {
        return value == null ? null : value.trim();
    }
}
