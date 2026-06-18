/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.querybuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * A select constraint (the Filament {@code SelectConstraint}): equals / isIn over a column whose
 * value comes from a fixed option set. {@link #options(List)} declares the pickable values.
 */
public final class SelectConstraint extends Constraint {

    private final List<String> options = new ArrayList<>();

    private SelectConstraint(String field) {
        super(field, List.of("equals", "isIn"));
    }

    /**
     * @param field the column
     * @return a select constraint
     */
    public static SelectConstraint make(String field) {
        return new SelectConstraint(field);
    }

    /**
     * Sets the pickable options.
     *
     * @param values the option values
     * @return this constraint
     */
    public SelectConstraint options(List<String> values) {
        Objects.requireNonNull(values, "values");
        options.clear();
        options.addAll(values);
        return this;
    }

    /** @return the pickable option values, in declaration order */
    public List<String> options() {
        return List.copyOf(options);
    }
}
