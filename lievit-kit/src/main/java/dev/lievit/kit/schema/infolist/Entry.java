/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema.infolist;

import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.support.EvaluationContext;

/**
 * The read-only base of every infolist entry (the filament-infolists {@code Entry} carried over onto
 * the shared schema engine). An entry is the View-page counterpart of a form field: it binds a
 * state path (the record attribute it shows), a humanized label, an optional placeholder for an
 * empty value, and a {@code formatStateUsing} transform. It never dehydrates and is never validated:
 * an infolist is a structured READ of a record.
 *
 * <p>CRTP self-type {@code SELF} keeps the fluent chain typed through the concrete entry; the value
 * a concrete entry exposes is resolved through {@link #resolveState(EvaluationContext)}, which reads
 * the bound path from the context and runs the format transform.
 *
 * @param <SELF> the concrete entry type, for fluent returns
 */
public abstract sealed class Entry<SELF extends Entry<SELF>> implements InfolistComponent
        permits TextEntry, IconEntry, ImageEntry, ColorEntry, CodeEntry, ViewEntry,
                KeyValueEntry, RepeatableEntry {

    private final String name;
    private final String label;
    private @Nullable String placeholder;
    private boolean visible = true;
    private int columnSpan = 1;
    private Function<@Nullable Object, @Nullable Object> formatState = v -> v;

    /**
     * @param name the record attribute (state path) the entry reads, humanized into a label
     */
    protected Entry(String name) {
        this.name = Objects.requireNonNull(name, "name");
        this.label = humanize(name);
    }

    /**
     * @return {@code this}, typed as the concrete entry
     */
    @SuppressWarnings("unchecked")
    protected final SELF self() {
        return (SELF) this;
    }

    /**
     * @return the bound state path (the record attribute the entry shows)
     */
    public String statePath() {
        return name;
    }

    /**
     * @return the display label
     */
    public String label() {
        return label;
    }

    /**
     * Sets the text shown when the resolved value is null/blank (the empty-state placeholder).
     *
     * @param placeholder the placeholder text
     * @return this entry
     */
    public SELF placeholder(String placeholder) {
        this.placeholder = Objects.requireNonNull(placeholder, "placeholder");
        return self();
    }

    /**
     * @return the empty-value placeholder, or {@code null}
     */
    public @Nullable String placeholder() {
        return placeholder;
    }

    /**
     * Hides the entry.
     *
     * @param visible whether the entry renders
     * @return this entry
     */
    public SELF visible(boolean visible) {
        this.visible = visible;
        return self();
    }

    /**
     * @return {@code true} if the entry renders
     */
    public boolean isVisible() {
        return visible;
    }

    @Override
    public final boolean isVisibleComponent() {
        return visible;
    }

    /**
     * Sets how many parent grid columns this entry spans (the filament {@code columnSpan}); the
     * default is 1. A wide entry (a description, a key-value table) spans the full grid via
     * {@code columnSpan(layoutColumns)}.
     *
     * @param columnSpan the span (at least 1)
     * @return this entry
     */
    public SELF columnSpan(int columnSpan) {
        if (columnSpan < 1) {
            throw new IllegalArgumentException("columnSpan must be at least 1");
        }
        this.columnSpan = columnSpan;
        return self();
    }

    /**
     * @return the number of parent grid columns this entry spans (default 1)
     */
    public int columnSpan() {
        return columnSpan;
    }

    /**
     * The entry-kind tag a renderer branches on (the filament entry type). The base is
     * {@code "text"}; visual entries override ({@code "icon"} / {@code "image"} / {@code "color"} /
     * {@code "code"}).
     *
     * @return the entry kind tag
     */
    public String kind() {
        return "text";
    }

    /**
     * Resolves this entry into a {@link ResolvedNode.Field} (label + projected display + kind +
     * span). {@link KeyValueEntry} overrides to a {@link ResolvedNode.KeyValue} so its map is finally
     * reached. A hidden entry never reaches here (the container skips it via
     * {@link #isVisibleComponent()}).
     *
     * @param context the live evaluation context
     * @return the resolved field node
     */
    @Override
    public ResolvedNode resolveNode(EvaluationContext context) {
        return new ResolvedNode.Field(label(), resolveDisplay(context), kind(), columnSpan);
    }

    /**
     * Sets a transform applied to the raw state before display (the {@code formatStateUsing} of
     * Filament): map an enum to a human label, a cents integer to a currency string, etc.
     *
     * @param formatState the display transform
     * @return this entry
     */
    public SELF formatStateUsing(Function<@Nullable Object, @Nullable Object> formatState) {
        this.formatState = Objects.requireNonNull(formatState, "formatState");
        return self();
    }

    /**
     * Resolves the entry's display value against the live context: reads the bound path and runs the
     * {@code formatStateUsing} transform. Does NOT apply the placeholder (a renderer applies it when
     * the result is null/blank), so callers can distinguish "no value" from a formatted empty string.
     *
     * @param context the live evaluation context (its {@code get} reads the record's attributes)
     * @return the formatted value, possibly {@code null}
     */
    public @Nullable Object resolveState(EvaluationContext context) {
        return formatState.apply(context.get(statePath()));
    }

    /**
     * Resolves the entry's value as the display STRING, substituting the placeholder when the
     * formatted value is null/blank.
     *
     * @param context the live evaluation context
     * @return the display string (placeholder applied), or the empty string when no placeholder is set
     */
    public String resolveDisplay(EvaluationContext context) {
        @Nullable Object value = resolveState(context);
        if (value == null || String.valueOf(value).isBlank()) {
            return placeholder == null ? "" : placeholder;
        }
        return String.valueOf(value);
    }

    /** Title-cases an attribute name into a default label ({@code created_at} to {@code Created At}). */
    static String humanize(String name) {
        String spaced = name.replace('_', ' ').replaceAll("([a-z])([A-Z])", "$1 $2").trim();
        if (spaced.isEmpty()) {
            return spaced;
        }
        StringBuilder out = new StringBuilder();
        for (String word : spaced.split("\\s+")) {
            if (out.length() > 0) {
                out.append(' ');
            }
            out.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return out.toString();
    }
}
