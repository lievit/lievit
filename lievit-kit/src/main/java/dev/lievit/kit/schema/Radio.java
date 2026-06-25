/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.BiPredicate;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.SelectOption;
import dev.lievit.kit.support.EvaluationContext;

/**
 * A radio-button group (the filament-forms {@code Radio} carried over): a single-choice field over
 * a fixed option set, binding the selected option's value as a {@link String}. Use a {@link Select}
 * for a dropdown over the same data, or a {@link CheckboxList} for multi-choice.
 */
public final class Radio extends SchemaField<String, Radio> {

    private final List<SelectOption> options = new ArrayList<>();
    private boolean inline;
    private @Nullable BiPredicate<String, EvaluationContext> disableOptionWhen;

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

    /**
     * Disables individual options reactively (the filament {@code disableOptionWhen}): the predicate
     * receives an option's value and the live context, and a {@code true} return greys that option
     * out (still rendered, not selectable). This is the per-option twin of the field-wide
     * {@code disabled} closure, so one option can lock while the rest stay open, recomputed from the
     * live state.
     *
     * @param predicate {@code (optionValue, context)} to whether THAT option is disabled
     * @return this field
     */
    public Radio disableOptionWhen(BiPredicate<String, EvaluationContext> predicate) {
        this.disableOptionWhen = Objects.requireNonNull(predicate, "predicate");
        return this;
    }

    /**
     * Resolves whether a specific option is disabled against the live context.
     *
     * @param optionValue the option's submitted value
     * @param context the live evaluation context
     * @return {@code true} if that option is disabled
     */
    public boolean isOptionDisabled(String optionValue, EvaluationContext context) {
        return disableOptionWhen != null
                && disableOptionWhen.test(Objects.requireNonNull(optionValue, "optionValue"), context);
    }

    /**
     * @return {@code true} if a per-option disable predicate is set
     */
    public boolean hasDisableOptionWhen() {
        return disableOptionWhen != null;
    }
}
