/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.SelectOption;

/**
 * A segmented-choice control (the filament-forms {@code ToggleButtons} carried over): renders the
 * options as a row of toggle buttons. In single mode it binds the selected value as a
 * {@link String}; in {@link #multiple()} mode it binds a {@link List} of values (like a
 * {@link CheckboxList} but rendered as buttons). {@code inline} lays the buttons in a row,
 * {@code grouped} joins them into one segmented bar.
 */
public final class ToggleButtons extends SchemaField<Object, ToggleButtons> {

    private final List<SelectOption> options = new ArrayList<>();
    private boolean multiple;
    private boolean inline;
    private boolean grouped;

    private ToggleButtons(String name) {
        super(name);
    }

    /**
     * @param name the field name and state path
     * @return a new toggle-buttons control
     */
    public static ToggleButtons make(String name) {
        return new ToggleButtons(name);
    }

    /**
     * Declares the choices.
     *
     * @param toAdd the options in display order
     * @return this field
     */
    public ToggleButtons options(List<SelectOption> toAdd) {
        options.addAll(Objects.requireNonNull(toAdd, "options"));
        return this;
    }

    /**
     * @return the options in declaration order (unmodifiable)
     */
    public List<SelectOption> options() {
        return List.copyOf(options);
    }

    /**
     * Allows selecting multiple values (binds a list through the multi-value cast).
     *
     * @return this field
     */
    public ToggleButtons multiple() {
        this.multiple = true;
        cast(asObject(CheckboxList.multiValueCast()));
        return this;
    }

    /**
     * @return {@code true} if multiple values may be selected
     */
    public boolean isMultiple() {
        return multiple;
    }

    /**
     * Lays the buttons out in a row.
     *
     * @return this field
     */
    public ToggleButtons inline() {
        this.inline = true;
        return this;
    }

    /**
     * @return {@code true} if the buttons render inline
     */
    public boolean isInline() {
        return inline;
    }

    /**
     * Joins the buttons into one segmented bar (no gaps).
     *
     * @return this field
     */
    public ToggleButtons grouped() {
        this.grouped = true;
        return this;
    }

    /**
     * @return {@code true} if the buttons render as one segmented bar
     */
    public boolean isGrouped() {
        return grouped;
    }

    /** Adapts the list-valued multi cast to this field's {@code Object} value type. */
    private static StateCast<Object> asObject(StateCast<List<String>> delegate) {
        return new StateCast<>() {
            @Override
            public @Nullable Object hydrate(@Nullable Object raw) {
                return delegate.hydrate(raw);
            }

            @Override
            @SuppressWarnings("unchecked")
            public @Nullable Object dehydrate(@Nullable Object value) {
                return delegate.dehydrate((List<String>) value);
            }
        };
    }
}
