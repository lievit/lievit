/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.SelectOption;
import io.lievit.kit.support.EvaluationContext;

/**
 * A select / dropdown field (the filament-forms {@code Select} carried over onto the schema engine,
 * with the depth the spine's static {@code SelectField} lacked): searchable, multiple, preload, and
 * a REACTIVE option set whose options recompute from the live state (the dependent-dropdown:
 * country to region). A multiple select binds a {@link List}; a single select binds a {@link String}.
 */
public final class Select extends SchemaField<Object, Select> {

    private Function<EvaluationContext, List<SelectOption>> optionsSource = ctx -> List.of();
    private boolean multiple;
    private boolean searchable;
    private boolean preload;

    private Select(String name) {
        super(name);
    }

    /**
     * @param name the field name and state path
     * @return a new select
     */
    public static Select make(String name) {
        return new Select(name);
    }

    /**
     * Sets a fixed option set.
     *
     * @param options the options in display order
     * @return this field
     */
    public Select options(List<SelectOption> options) {
        List<SelectOption> snapshot = List.copyOf(Objects.requireNonNull(options, "options"));
        this.optionsSource = ctx -> snapshot;
        return this;
    }

    /**
     * Sets a REACTIVE option set: the options recompute from the live state on each evaluation (the
     * dependent-dropdown path). Pair with a {@code .live()} source field whose
     * {@code afterStateUpdated} clears this field when the parent changes.
     *
     * @param source produces the options from the live context
     * @return this field
     */
    public Select optionsUsing(Function<EvaluationContext, List<SelectOption>> source) {
        this.optionsSource = Objects.requireNonNull(source, "source");
        return this;
    }

    /**
     * Resolves the current option set against the live context.
     *
     * @param context the live evaluation context
     * @return the options for the current state
     */
    public List<SelectOption> resolveOptions(EvaluationContext context) {
        return new ArrayList<>(optionsSource.apply(context));
    }

    /**
     * Allows selecting multiple values (binds a list, casts through the multi-value cast).
     *
     * @return this field
     */
    public Select multiple() {
        this.multiple = true;
        cast(castMultiAsObject());
        return this;
    }

    /**
     * @return {@code true} if multiple values may be selected
     */
    public boolean isMultiple() {
        return multiple;
    }

    /**
     * Makes the select searchable (a typeahead over the options).
     *
     * @return this field
     */
    public Select searchable() {
        this.searchable = true;
        return this;
    }

    /**
     * @return {@code true} if the select is searchable
     */
    public boolean isSearchable() {
        return searchable;
    }

    /**
     * Preloads the option set on mount (rather than fetching on first search); only meaningful with
     * {@link #searchable()}.
     *
     * @return this field
     */
    public Select preload() {
        this.preload = true;
        return this;
    }

    /**
     * @return {@code true} if the options preload on mount
     */
    public boolean isPreload() {
        return preload;
    }

    /** Adapts the list-valued multi cast to this field's {@code Object} value type. */
    private static StateCast<Object> castMultiAsObject() {
        StateCast<List<String>> delegate = CheckboxList.multiValueCast();
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
