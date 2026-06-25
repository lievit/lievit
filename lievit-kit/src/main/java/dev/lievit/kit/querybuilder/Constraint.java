/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.querybuilder;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import org.jspecify.annotations.Nullable;

/**
 * A constraint a {@link QueryBuilder} offers over one field (the Filament query-builder
 * {@code Constraint} family carried over): it names a field and the set of operators a user may pick
 * for it. The concrete subtypes ({@link TextConstraint}, {@link NumberConstraint},
 * {@link DateConstraint}, {@link BooleanConstraint}, {@link SelectConstraint},
 * {@link RelationshipConstraint}) declare their own operator vocabulary.
 *
 * <p>Every constraint also exposes the value-free {@code isFilled} / {@code isBlank} operators (the
 * Filament base operators), so a user can match presence without a value. Building a
 * {@link Predicate} validates the operator against this set, so an invalid operator never reaches
 * the adopter's repository.
 */
public abstract class Constraint {

    /** Operators every constraint owns: match a non-empty / empty field with no value. */
    static final List<String> BASE_OPERATORS = List.of("isFilled", "isBlank");

    private final String field;
    private final Set<String> operators;

    /**
     * @param field the column this constraint filters
     * @param ownOperators the type-specific operators (the base filled/blank are added)
     */
    protected Constraint(String field, List<String> ownOperators) {
        this.field = Objects.requireNonNull(field, "field");
        Set<String> all = new LinkedHashSet<>(ownOperators);
        all.addAll(BASE_OPERATORS);
        this.operators = Set.copyOf(all);
    }

    /** @return the column this constraint filters */
    public String field() {
        return field;
    }

    /** @return the operators this constraint offers (type-specific + filled/blank) */
    public Set<String> operators() {
        return operators;
    }

    /**
     * Builds an active predicate over this constraint, validating the operator.
     *
     * @param operator the picked operator (must be one of {@link #operators()})
     * @param value the predicate value (ignored for a value-free operator)
     * @return the predicate
     * @throws IllegalArgumentException if the operator is not owned by this constraint
     */
    public Predicate predicate(String operator, @Nullable String value) {
        if (!operators.contains(operator)) {
            throw new IllegalArgumentException(
                    "constraint " + field + " has no operator '" + operator + "'");
        }
        boolean valueFree = BASE_OPERATORS.contains(operator) || isUnary(operator);
        return Predicate.of(field, operator, valueFree ? null : value, isRelationship());
    }

    /**
     * Builds a value-free predicate (for {@code isFilled} / {@code isBlank} and the boolean unary
     * operators).
     *
     * @param operator the value-free operator
     * @return the predicate
     */
    public Predicate predicate(String operator) {
        return predicate(operator, null);
    }

    /** @return whether this constraint filters across a relationship (overridden by the rel type) */
    protected boolean isRelationship() {
        return false;
    }

    /** @return whether a type-specific operator takes no value (overridden by the boolean type) */
    protected boolean isUnary(String operator) {
        return false;
    }
}
