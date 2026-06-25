/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.SelectOption;

/**
 * A multi-choice checkbox list (the filament-forms {@code CheckboxList} carried over): binds a
 * {@link List} of the selected option values. Searchable and bulk-toggle ("select all") are
 * presentation behaviors for long option sets.
 */
public final class CheckboxList extends SchemaField<List<String>, CheckboxList> {

    private final List<SelectOption> options = new ArrayList<>();
    private boolean searchable;
    private boolean bulkToggleable;

    private CheckboxList(String name) {
        super(name);
        cast(multiValueCast());
    }

    /**
     * @param name the field name and state path
     * @return a new checkbox list bound to a list of values
     */
    public static CheckboxList make(String name) {
        return new CheckboxList(name);
    }

    /**
     * Declares the selectable options.
     *
     * @param toAdd the options in display order
     * @return this field
     */
    public CheckboxList options(List<SelectOption> toAdd) {
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
     * Makes the list searchable (a filter box over the options).
     *
     * @return this field
     */
    public CheckboxList searchable() {
        this.searchable = true;
        return this;
    }

    /**
     * @return {@code true} if the list is searchable
     */
    public boolean isSearchable() {
        return searchable;
    }

    /**
     * Adds a "select all / none" bulk toggle.
     *
     * @return this field
     */
    public CheckboxList bulkToggleable() {
        this.bulkToggleable = true;
        return this;
    }

    /**
     * @return {@code true} if a bulk toggle is shown
     */
    public boolean isBulkToggleable() {
        return bulkToggleable;
    }

    /** A cast that round-trips a list of values to/from a comma-joined wire string. */
    static StateCast<List<String>> multiValueCast() {
        return new StateCast<>() {
            @Override
            public List<String> hydrate(@Nullable Object raw) {
                if (raw instanceof List<?> list) {
                    return list.stream().map(String::valueOf).toList();
                }
                String s = raw == null ? "" : String.valueOf(raw).trim();
                if (s.isEmpty()) {
                    return List.of();
                }
                return List.of(s.split(","));
            }

            @Override
            public @Nullable Object dehydrate(@Nullable List<String> value) {
                return value == null ? List.of() : List.copyOf(value);
            }
        };
    }
}
