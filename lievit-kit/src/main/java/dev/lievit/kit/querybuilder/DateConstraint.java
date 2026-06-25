/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.querybuilder;

import java.util.List;

/**
 * A date constraint (the Filament {@code DateConstraint}): isAfter / isBefore / isDate / isMonth /
 * isYear over a date column.
 */
public final class DateConstraint extends Constraint {

    private DateConstraint(String field) {
        super(field, List.of("isAfter", "isBefore", "isDate", "isMonth", "isYear"));
    }

    /**
     * @param field the date column
     * @return a date constraint
     */
    public static DateConstraint make(String field) {
        return new DateConstraint(field);
    }
}
