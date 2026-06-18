/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.SelectOption;
import io.lievit.kit.support.EvaluationContext;

/**
 * A polymorphic-relation selector (the filament-forms {@code MorphToSelect} carried over onto the
 * schema engine): the user first picks a related TYPE, then a record of that type. It writes BOTH
 * sides of the morph, the type column and the id column, so a {@code commentable} morph fills
 * {@code commentable_type} and {@code commentable_id} from one field.
 *
 * <p>The field's {@code name} is the morph relation; by convention the two underlying columns are
 * {@code <name>_type} (the {@link #typePath()}) and {@code <name>_id} (the {@link #statePath()},
 * the field's own bound path). Each {@link Type} carries its stable type value (what lands in the
 * type column), a label, and a record-option source resolved from the live state, so the id options
 * recompute when the chosen type changes (the dependent-dropdown shape {@link Select} already uses).
 */
public final class MorphToSelect extends SchemaField<String, MorphToSelect> {

    /**
     * One selectable morph target: the type value written to the type column, its label, and the
     * source of record options for that type.
     *
     * @param value the stable type value persisted to the type column (e.g. a class alias)
     * @param label the human label shown in the type selector
     * @param optionsSource produces the record options (id + label) for this type from the live state
     */
    public record Type(
            String value, String label, Function<EvaluationContext, List<SelectOption>> optionsSource) {

        /** Compact constructor: defends non-null. */
        public Type {
            Objects.requireNonNull(value, "value");
            Objects.requireNonNull(label, "label");
            Objects.requireNonNull(optionsSource, "optionsSource");
        }

        /**
         * Builds a morph target with a fixed record option set.
         *
         * @param value the type value
         * @param label the type label
         * @param options the fixed record options
         * @return a morph target
         */
        public static Type of(String value, String label, List<SelectOption> options) {
            List<SelectOption> snapshot = List.copyOf(options);
            return new Type(value, label, ctx -> snapshot);
        }

        /**
         * Builds a morph target whose record options recompute from the live state.
         *
         * @param value the type value
         * @param label the type label
         * @param optionsSource produces the record options from the live context
         * @return a morph target
         */
        public static Type using(
                String value, String label, Function<EvaluationContext, List<SelectOption>> optionsSource) {
            return new Type(value, label, optionsSource);
        }
    }

    private final String typePath;
    private final List<Type> types = new ArrayList<>();
    private boolean searchable;

    private MorphToSelect(String name) {
        super(name + "_id");
        this.typePath = name + "_type";
    }

    /**
     * @param name the morph relation name (its columns are {@code <name>_type} and {@code <name>_id})
     * @return a new morph-to select
     */
    public static MorphToSelect make(String name) {
        return new MorphToSelect(name);
    }

    /**
     * Sets the selectable morph targets, in display order.
     *
     * @param types the morph targets
     * @return this field
     */
    public MorphToSelect types(List<Type> types) {
        this.types.clear();
        for (Type t : types) {
            this.types.add(Objects.requireNonNull(t, "type"));
        }
        return this;
    }

    /**
     * @return the morph targets in display order (unmodifiable)
     */
    public List<Type> types() {
        return List.copyOf(types);
    }

    /**
     * @return the state path of the type column ({@code <name>_type})
     */
    public String typePath() {
        return typePath;
    }

    /**
     * Makes the record selector searchable (a typeahead over the chosen type's options).
     *
     * @return this field
     */
    public MorphToSelect searchable() {
        this.searchable = true;
        return this;
    }

    /**
     * @return {@code true} if the record selector is searchable
     */
    public boolean isSearchable() {
        return searchable;
    }

    /**
     * The type options shown in the first (type) selector: one option per declared {@link Type}.
     *
     * @return the type options in declaration order
     */
    public List<SelectOption> typeOptions() {
        List<SelectOption> out = new ArrayList<>();
        for (Type t : types) {
            out.add(SelectOption.of(t.value(), t.label()));
        }
        return out;
    }

    /**
     * Resolves the record options for the currently chosen type, read from the type column in the
     * live state. Empty when no type is chosen or the chosen type is unknown.
     *
     * @param context the live evaluation context
     * @return the record options for the chosen type, or empty
     */
    public List<SelectOption> resolveRecordOptions(EvaluationContext context) {
        @Nullable Object chosen = context.get(typePath);
        if (chosen == null) {
            return List.of();
        }
        return findType(chosen.toString())
                .map(t -> new ArrayList<>(t.optionsSource().apply(context)))
                .map(list -> (List<SelectOption>) list)
                .orElse(List.of());
    }

    /**
     * @param typeValue a type value
     * @return the matching declared type, if any
     */
    public Optional<Type> findType(String typeValue) {
        Objects.requireNonNull(typeValue, "typeValue");
        return types.stream().filter(t -> t.value().equals(typeValue)).findFirst();
    }
}
