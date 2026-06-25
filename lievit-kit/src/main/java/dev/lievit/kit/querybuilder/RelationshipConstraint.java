/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.querybuilder;

import java.util.List;
import java.util.Objects;

/**
 * A relationship constraint (the Filament {@code RelationshipConstraint}): filters across a relation
 * by a column on the related record. The {@link Predicate}'s field is the dotted path
 * {@code relation.column} and it is flagged as a relationship predicate, so the adopter's repository
 * knows to join rather than filter a local column.
 *
 * <p>It offers equals / contains on the related column plus the value-free filled/blank, which cover
 * the common "this row's author is X" / "has any author" cases without reproducing every text
 * operator across the join.
 */
public final class RelationshipConstraint extends Constraint {

    private RelationshipConstraint(String relation, String column) {
        super(relation + "." + column, List.of("equals", "contains"));
    }

    /**
     * @param relation the relation name (for example {@code "author"})
     * @param column the column on the related record (for example {@code "name"})
     * @return a relationship constraint over {@code relation.column}
     */
    public static RelationshipConstraint make(String relation, String column) {
        Objects.requireNonNull(relation, "relation");
        Objects.requireNonNull(column, "column");
        return new RelationshipConstraint(relation, column);
    }

    @Override
    protected boolean isRelationship() {
        return true;
    }
}
