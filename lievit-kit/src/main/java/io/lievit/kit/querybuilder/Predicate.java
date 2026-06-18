/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.querybuilder;

import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;

/**
 * One active constraint of a {@link QueryBuilder}: a field, an operator, an optional value, the
 * negation flag, and whether it filters across a relationship (the Filament query-builder applied
 * constraint carried over). It is the unit the adopter's repository turns into a WHERE clause; the
 * kit composes and carries predicates, it never executes them.
 *
 * <p>Value-free operators ({@code isFilled}, {@code isBlank}, {@code isTrue}, {@code isFalse}) carry
 * an empty value. {@code negated} flips the predicate (the Filament per-operator {@code invert}).
 */
public final class Predicate {

    private final String field;
    private final String operator;
    private final @Nullable String value;
    private final boolean negated;
    private final boolean relationship;

    private Predicate(
            String field,
            String operator,
            @Nullable String value,
            boolean negated,
            boolean relationship) {
        this.field = Objects.requireNonNull(field, "field");
        this.operator = Objects.requireNonNull(operator, "operator");
        this.value = value;
        this.negated = negated;
        this.relationship = relationship;
    }

    static Predicate of(String field, String operator, @Nullable String value, boolean relationship) {
        return new Predicate(field, operator, value, false, relationship);
    }

    /**
     * @return a copy of this predicate with the negation flag set (the Filament {@code invert})
     */
    public Predicate negated() {
        return new Predicate(field, operator, value, true, relationship);
    }

    /** @return the field (a column, or {@code relation.column} for a relationship predicate) */
    public String field() {
        return field;
    }

    /** @return the operator name ({@code contains}, {@code isAfter}, {@code equals}, …) */
    public String operator() {
        return operator;
    }

    /** @return the predicate value, empty for a value-free operator */
    public Optional<String> value() {
        return Optional.ofNullable(value);
    }

    /** @return whether the predicate is negated */
    public boolean isNegated() {
        return negated;
    }

    /** @return whether the predicate filters across a relationship */
    public boolean isRelationship() {
        return relationship;
    }

    /**
     * @return a human label for the removable active-constraint indicator ({@code field operator
     *     value}, or {@code field not operator} when negated / value-free)
     */
    public String indicator() {
        StringBuilder sb = new StringBuilder(field).append(' ');
        if (negated) {
            sb.append("not ");
        }
        sb.append(operator);
        if (value != null) {
            sb.append(' ').append(value);
        }
        return sb.toString();
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof Predicate p
                && negated == p.negated
                && relationship == p.relationship
                && field.equals(p.field)
                && operator.equals(p.operator)
                && Objects.equals(value, p.value);
    }

    @Override
    public int hashCode() {
        return Objects.hash(field, operator, value, negated, relationship);
    }

    @Override
    public String toString() {
        return "Predicate[" + indicator() + (relationship ? " (rel)" : "") + "]";
    }
}
