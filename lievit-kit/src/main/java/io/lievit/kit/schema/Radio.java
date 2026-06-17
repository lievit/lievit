/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import io.lievit.kit.SelectOption;

/**
 * A radio-button group (the filament-forms {@code Radio} carried over): a single-choice field over
 * a fixed option set, binding the selected option's value as a {@link String}. Use a {@link Select}
 * for a dropdown over the same data, or a {@link CheckboxList} for multi-choice.
 */
public final class Radio extends SchemaField<String, Radio> {

    private final List<SelectOption> options = new ArrayList<>();
    private boolean inline;

    private Radio(String name) {
        super(name);
    }

    /**
     * @param name the field name and state path
     * @return a new radio group
     */
    public static Radio make(String name) {
        return new Radio(name);
    }

    /**
     * Declares the selectable options.
     *
     * @param toAdd the options in display order
     * @return this field
     */
    public Radio options(List<SelectOption> toAdd) {
        options.addAll(Objects.requireNonNull(toAdd, "options"));
        return this;
    }

    /**
     * @return the options in declaration order (unmodifiable), with an {@code in} rule added once
     */
    public List<SelectOption> options() {
        return List.copyOf(options);
    }

    /**
     * Lays the options out inline (in a row) rather than stacked.
     *
     * @return this field
     */
    public Radio inline() {
        this.inline = true;
        return this;
    }

    /**
     * @return {@code true} if the options render inline
     */
    public boolean isInline() {
        return inline;
    }
}
