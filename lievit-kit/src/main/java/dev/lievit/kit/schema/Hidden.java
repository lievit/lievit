/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

/**
 * A hidden field (the filament-forms {@code Hidden} carried over): carries a value through the form
 * without rendering a visible control. Unlike a {@code .hidden(true)} input it STILL dehydrates (it
 * exists precisely to persist a non-visible value, such as a token or a computed key), so it sets
 * {@code dehydratedWhenHidden(true)} and renders no label.
 *
 * <p>It is not validated by the usual visibility gate because it is never "visible"; if a hidden
 * value must be checked, attach a rule explicitly (rules still run since the field is dehydrated).
 */
public final class Hidden extends SchemaField<String, Hidden> {

    private Hidden(String name) {
        super(name);
        dehydratedWhenHidden(true);
    }

    /**
     * @param name the field name and state path
     * @return a new hidden field that still persists its value
     */
    public static Hidden make(String name) {
        return new Hidden(name);
    }
}
