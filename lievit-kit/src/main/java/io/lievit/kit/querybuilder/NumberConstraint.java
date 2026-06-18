/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.querybuilder;

import java.util.List;

/**
 * A numeric constraint (the Filament {@code NumberConstraint}): equals / isMin / isMax / isBetween
 * over a number column.
 */
public final class NumberConstraint extends Constraint {

    private NumberConstraint(String field) {
        super(field, List.of("equals", "isMin", "isMax", "isBetween"));
    }

    /**
     * @param field the numeric column
     * @return a number constraint
     */
    public static NumberConstraint make(String field) {
        return new NumberConstraint(field);
    }
}
