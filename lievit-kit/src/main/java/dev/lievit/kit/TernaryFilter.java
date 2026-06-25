/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * A ternary filter: true / false / all (the Filament {@code TernaryFilter}). When set to true or
 * false it narrows the query to rows matching that boolean; the "all" state (the filter inactive)
 * imposes no constraint.
 *
 * <p>The state value is {@link #TRUE} or {@link #FALSE}; an absent value (or {@link #ALL}) means no
 * constraint. {@link #resolve(FilterState)} reads the state back as a tri-state {@code Optional}
 * of {@code Boolean}.
 *
 * <p>Beyond the bare resolve it carries the Filament {@code TernaryFilter} configuration surface: the
 * per-state option labels ({@link #trueLabel(String)} / {@link #falseLabel(String)} /
 * {@link #placeholder(String)}), the {@link #attribute(String) attribute} the boolean maps to (so the
 * filter name and the column can differ), and a {@link #query(Function) query closure} the repository
 * applies. {@link #nullable()} flips the semantics to "present / absent / all" (Filament's
 * {@code ->nullable()}), where "true" means the attribute IS NOT NULL.
 */
public final class TernaryFilter extends Filter {

    /** The filter-state value meaning "true". */
    public static final String TRUE = "true";
    /** The filter-state value meaning "false". */
    public static final String FALSE = "false";
    /** The (absent) filter-state value meaning "no constraint". */
    public static final String ALL = "";

    private String trueLabel = "Yes";
    private String falseLabel = "No";
    private String placeholder = "All";
    private @Nullable String attribute;
    private boolean nullable;
    private @Nullable Function<Boolean, FilterState> queryClosure;

    private TernaryFilter(String name) {
        super(name);
    }

    /**
     * @param name the filter name (the {@link FilterState} key and, by default, the boolean column)
     * @return a ternary filter
     */
    public static TernaryFilter make(String name) {
        return new TernaryFilter(name);
    }

    /**
     * Sets the label of the "true" option (the Filament {@code ->trueLabel(...)}).
     *
     * @param label the true-option label
     * @return this filter
     */
    public TernaryFilter trueLabel(String label) {
        this.trueLabel = Objects.requireNonNull(label, "label");
        return this;
    }

    /**
     * Sets the label of the "false" option (the Filament {@code ->falseLabel(...)}).
     *
     * @param label the false-option label
     * @return this filter
     */
    public TernaryFilter falseLabel(String label) {
        this.falseLabel = Objects.requireNonNull(label, "label");
        return this;
    }

    /**
     * Sets the label of the unselected "all" option (the Filament {@code ->placeholder(...)}).
     *
     * @param label the all-option label
     * @return this filter
     */
    public TernaryFilter placeholder(String label) {
        this.placeholder = Objects.requireNonNull(label, "label");
        return this;
    }

    /**
     * Declares the record attribute the boolean maps to, decoupled from the filter name (the Filament
     * {@code ->attribute(...)}): the repository constrains this column while the filter keeps its own
     * stable {@link #name()}.
     *
     * @param attr the attribute/column name
     * @return this filter
     */
    public TernaryFilter attribute(String attr) {
        this.attribute = Objects.requireNonNull(attr, "attr");
        return this;
    }

    /**
     * Switches to nullable semantics (the Filament {@code ->nullable()}): "true" now means the
     * {@linkplain #attribute() attribute} IS NOT NULL and "false" means IS NULL. The default option
     * labels become "Filled" / "Empty" unless overridden.
     *
     * @return this filter
     */
    public TernaryFilter nullable() {
        this.nullable = true;
        if ("Yes".equals(trueLabel)) {
            this.trueLabel = "Filled";
        }
        if ("No".equals(falseLabel)) {
            this.falseLabel = "Empty";
        }
        return this;
    }

    /**
     * Declares a query closure the repository applies to translate the resolved boolean into the
     * active {@link FilterState} (the Filament {@code ->queries(true: ..., false: ..., blank: ...)}).
     * The kit never runs SQL; the closure lets the adopter remap the boolean to a different column or
     * a composite filter state, which {@link #toFilterState(FilterState)} returns for the repository.
     *
     * @param closure maps the resolved boolean to the filter state to apply
     * @return this filter
     */
    public TernaryFilter query(Function<Boolean, FilterState> closure) {
        this.queryClosure = Objects.requireNonNull(closure, "closure");
        return this;
    }

    /** @return the "true" option label */
    public String trueLabel() {
        return trueLabel;
    }

    /** @return the "false" option label */
    public String falseLabel() {
        return falseLabel;
    }

    /** @return the unselected "all" option label */
    public String placeholder() {
        return placeholder;
    }

    /** @return the constrained attribute/column, defaulting to the filter {@link #name()} */
    public String attribute() {
        return attribute != null ? attribute : name();
    }

    /** @return whether this filter uses nullable (present/absent) semantics */
    public boolean isNullable() {
        return nullable;
    }

    /**
     * Reads the tri-state value back from the filter state.
     *
     * @param state the active filter state
     * @return {@code Optional.of(true/false)} when constrained, {@code Optional.empty()} for "all"
     */
    public Optional<Boolean> resolve(FilterState state) {
        Optional<String> v = state.value(name());
        if (v.isEmpty()) {
            return Optional.empty();
        }
        return switch (v.get()) {
            case TRUE -> Optional.of(Boolean.TRUE);
            case FALSE -> Optional.of(Boolean.FALSE);
            default -> Optional.empty();
        };
    }

    /**
     * Resolves the {@link FilterState} the repository should apply for this filter, threading the
     * resolved boolean through the {@link #query(Function) query closure} when one is declared. With
     * no closure it maps the boolean onto the {@link #attribute()} key (so a filter named differently
     * from its column still constrains the right column).
     *
     * @param state the active filter state
     * @return the filter state the repository applies (empty when the filter is in the "all" state)
     */
    public FilterState toFilterState(FilterState state) {
        Optional<Boolean> resolved = resolve(state);
        if (resolved.isEmpty()) {
            return FilterState.EMPTY;
        }
        boolean value = resolved.get();
        if (queryClosure != null) {
            return queryClosure.apply(value);
        }
        return FilterState.EMPTY.with(attribute(), value ? TRUE : FALSE);
    }
}
