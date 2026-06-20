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

    private boolean inline;

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

    /**
     * Lays the checkbox inline with its label (the filament {@code inline}), rather than stacked.
     *
     * @return this field
     */
    public Checkbox inline() {
        this.inline = true;
        return this;
    }

    /**
     * @return {@code true} if the checkbox lays out inline with its label
     */
    public boolean isInline() {
        return inline;
    }

    /**
     * Requires the checkbox to be ticked to pass validation (the filament {@code accepted}): the
     * "you must agree to the terms" gate.
     *
     * @return this field
     */
    public Checkbox accepted() {
        rule(Rules.accepted());
        return this;
    }

    /**
     * Requires the checkbox to be unticked to pass validation (the filament {@code declined}).
     *
     * @return this field
     */
    public Checkbox declined() {
        rule(Rules.declined());
        return this;
    }
}
