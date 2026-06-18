/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import io.lievit.kit.querybuilder.BooleanConstraint;
import io.lievit.kit.querybuilder.Constraint;
import io.lievit.kit.querybuilder.DateConstraint;
import io.lievit.kit.querybuilder.NumberConstraint;
import io.lievit.kit.querybuilder.Predicate;
import io.lievit.kit.querybuilder.QueryBuilder;
import io.lievit.kit.querybuilder.RelationshipConstraint;
import io.lievit.kit.querybuilder.SelectConstraint;
import io.lievit.kit.querybuilder.TextConstraint;

/**
 * Specifies the {@link QueryBuilder} table filter: a user-built set of constraints, each exposing
 * its operators with negation and isFilled/isBlank, composed into a list of {@link Predicate}s the
 * adopter's repository turns into a WHERE clause. The kit carries the intent; it never executes it.
 */
class QueryBuilderFilterTest {

    /**
     * @spec.given a QueryBuilder declaring text/number/date constraints
     * @spec.when  its available constraints are read
     * @spec.then  each constraint is present under its name and exposes its operators
     */
    @Test
    void declares_constraints_and_their_operators() {
        QueryBuilder qb =
                QueryBuilder.make("filters")
                        .constraints(
                                TextConstraint.make("name"),
                                NumberConstraint.make("price"),
                                DateConstraint.make("created_at"));

        assertThat(qb.constraintNames()).containsExactly("name", "price", "created_at");
        Constraint text = qb.constraint("name").orElseThrow();
        assertThat(text.operators()).contains("contains", "startsWith", "endsWith", "equals");
        assertThat(qb.constraint("created_at").orElseThrow().operators())
                .contains("isAfter", "isBefore", "isMonth", "isYear");
        // Every constraint supports the value-agnostic filled/blank operators.
        assertThat(text.operators()).contains("isFilled", "isBlank");
    }

    /**
     * @spec.given a text constraint
     * @spec.when  an active predicate is built for it with negation
     * @spec.then  the predicate carries field, operator, the negated flag, and the value
     */
    @Test
    void builds_a_negatable_predicate() {
        TextConstraint name = TextConstraint.make("name");

        Predicate p = name.predicate("contains", "ada").negated();

        assertThat(p.field()).isEqualTo("name");
        assertThat(p.operator()).isEqualTo("contains");
        assertThat(p.isNegated()).isTrue();
        assertThat(p.value()).contains("ada");
    }

    /**
     * @spec.given the value-agnostic operators
     * @spec.when  an isBlank predicate is built
     * @spec.then  it needs no value (isFilled/isBlank are unary)
     */
    @Test
    void supports_value_free_operators() {
        Predicate blank = TextConstraint.make("name").predicate("isBlank");

        assertThat(blank.operator()).isEqualTo("isBlank");
        assertThat(blank.value()).isEmpty();
    }

    /**
     * @spec.given a QueryBuilder with several active predicates
     * @spec.when  they are attached to it
     * @spec.then  the active list composes in order and each shows as a removable indicator label
     */
    @Test
    void composes_active_predicates_in_order() {
        QueryBuilder qb =
                QueryBuilder.make("filters")
                        .constraints(
                                TextConstraint.make("name"),
                                BooleanConstraint.make("active"),
                                SelectConstraint.make("status").options(List.of("open", "closed")));

        QueryBuilder applied =
                qb.apply(
                        TextConstraint.make("name").predicate("startsWith", "a"),
                        BooleanConstraint.make("active").predicate("isTrue"),
                        SelectConstraint.make("status").predicate("equals", "open"));

        assertThat(applied.activePredicates())
                .extracting(Predicate::field)
                .containsExactly("name", "active", "status");
        assertThat(applied.indicators())
                .containsExactly("name startsWith a", "active isTrue", "status equals open");
    }

    /**
     * @spec.given a relationship constraint
     * @spec.when  a predicate filters across the relation
     * @spec.then  the predicate is marked as a relationship predicate carrying the relation path
     */
    @Test
    void filters_across_a_relationship() {
        RelationshipConstraint author =
                RelationshipConstraint.make("author", "name");

        Predicate p = author.predicate("equals", "Ada");

        assertThat(p.field()).isEqualTo("author.name");
        assertThat(p.isRelationship()).isTrue();
    }

    /**
     * @spec.given a constraint asked for an operator it does not own
     * @spec.when  a predicate is built with it
     * @spec.then  it is rejected so an invalid operator never reaches the repository
     */
    @Test
    void rejects_an_unknown_operator() {
        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () -> NumberConstraint.make("price").predicate("contains", "1"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /**
     * @spec.given a QueryBuilder is a Filter
     * @spec.when  it has active predicates
     * @spec.then  it reports active so the table shows it (the Filter contract holds)
     */
    @Test
    void is_a_filter_and_reports_active_when_predicates_present() {
        QueryBuilder qb =
                QueryBuilder.make("filters").constraints(TextConstraint.make("name"));

        assertThat(qb.hasActivePredicates()).isFalse();
        assertThat(qb.apply(TextConstraint.make("name").predicate("isFilled")).hasActivePredicates())
                .isTrue();
        assertThat(qb).isInstanceOf(Filter.class);
    }
}
