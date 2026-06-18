/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.querybuilder;

import io.lievit.kit.Filter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * The QueryBuilder table filter (the Filament {@code tables/Filters/QueryBuilder}): a single
 * {@link Filter} under which a power user composes ad-hoc {@link Constraint constraints} across many
 * columns, instead of the resource author hand-writing one filter per column.
 *
 * <p>A QueryBuilder declares the constraints it offers ({@link #constraints(Constraint...)}); the
 * user's active picks are a list of {@link Predicate}s ({@link #apply(Predicate...)}) the adopter's
 * repository composes into a WHERE clause. As a {@link Filter} it carries the intent and the
 * presentation (the per-predicate removable {@link #indicators() indicators}); the kit never
 * executes the query, matching the rest of the filter family.
 *
 * <p>It is immutable in the builder sense: {@link #apply(Predicate...)} returns a new QueryBuilder
 * carrying the active predicates so the same declaration can be reused across requests.
 */
public final class QueryBuilder extends Filter {

    private final Map<String, Constraint> constraints = new LinkedHashMap<>();
    private final List<Predicate> active = new ArrayList<>();

    private QueryBuilder(String name) {
        super(name);
    }

    /**
     * @param name the filter name (the stable id)
     * @return a query builder
     */
    public static QueryBuilder make(String name) {
        return new QueryBuilder(name);
    }

    /**
     * Declares the constraints this builder offers.
     *
     * @param declared the constraints, keyed by their field, in declaration order
     * @return this builder
     */
    public QueryBuilder constraints(Constraint... declared) {
        for (Constraint c : declared) {
            constraints.put(c.field(), Objects.requireNonNull(c, "constraint"));
        }
        return this;
    }

    /**
     * Returns a copy of this builder carrying the given active predicates (the user's current
     * picks).
     *
     * @param predicates the active predicates, in display order
     * @return a new builder with the predicates attached; the declaration is preserved
     */
    public QueryBuilder apply(Predicate... predicates) {
        QueryBuilder copy = new QueryBuilder(name());
        copy.constraints.putAll(this.constraints);
        copy.active.addAll(this.active);
        for (Predicate p : predicates) {
            copy.active.add(Objects.requireNonNull(p, "predicate"));
        }
        return copy;
    }

    /** @return the declared constraint field names, in declaration order */
    public List<String> constraintNames() {
        return List.copyOf(constraints.keySet());
    }

    /**
     * @param field a constraint field
     * @return the declared constraint for that field, empty if none
     */
    public Optional<Constraint> constraint(String field) {
        return Optional.ofNullable(constraints.get(field));
    }

    /** @return the active predicates, in display order */
    public List<Predicate> activePredicates() {
        return List.copyOf(active);
    }

    /** @return whether any predicate is active (so the table shows the filter) */
    public boolean hasActivePredicates() {
        return !active.isEmpty();
    }

    /** @return the removable-indicator label for each active predicate, in order */
    public List<String> indicators() {
        return active.stream().map(Predicate::indicator).toList();
    }
}
