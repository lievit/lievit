/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.querybuilder;

import java.util.List;

/**
 * A boolean constraint (the Filament {@code BooleanConstraint}): isTrue / isFalse over a boolean
 * column. Both operators are value-free (the truth value is the operator itself).
 */
public final class BooleanConstraint extends Constraint {

    private BooleanConstraint(String field) {
        super(field, List.of("isTrue", "isFalse"));
    }

    /**
     * @param field the boolean column
     * @return a boolean constraint
     */
    public static BooleanConstraint make(String field) {
        return new BooleanConstraint(field);
    }

    @Override
    protected boolean isUnary(String operator) {
        return operator.equals("isTrue") || operator.equals("isFalse");
    }
}
