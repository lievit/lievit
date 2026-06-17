/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

/**
 * A boolean checkbox (the filament-forms {@code Checkbox} carried over). Binds a {@link Boolean}
 * value through the boolean {@link StateCast}, so the wire's {@code "true"}/{@code "false"} strings
 * round-trip to a real boolean.
 */
public final class Checkbox extends SchemaField<Boolean, Checkbox> {

    private Checkbox(String name) {
        super(name);
        cast(StateCasts.bool());
        defaultValue(false);
    }

    /**
     * @param name the field name and state path
     * @return a new checkbox bound to a boolean
     */
    public static Checkbox make(String name) {
        return new Checkbox(name);
    }
}
