/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.querybuilder;

import java.util.List;

/**
 * A text-field constraint (the Filament {@code TextConstraint}): contains / startsWith / endsWith /
 * equals over a string column, each negatable on the resulting {@link Predicate}.
 */
public final class TextConstraint extends Constraint {

    private TextConstraint(String field) {
        super(field, List.of("contains", "startsWith", "endsWith", "equals"));
    }

    /**
     * @param field the string column
     * @return a text constraint
     */
    public static TextConstraint make(String field) {
        return new TextConstraint(field);
    }
}
