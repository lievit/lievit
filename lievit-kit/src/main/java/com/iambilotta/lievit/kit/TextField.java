/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

/**
 * A single-line text input field (the most common form field type).
 *
 * <p>Carries no configuration beyond the bound name and display label: a plain {@code <input
 * type="text">} in the rendered form. Use {@link TextareaField} for multi-line text, or
 * {@link SelectField} when the value comes from a fixed option set.
 *
 * <p>Extends {@link Field} (same package; the package-private constructor is the encapsulation
 * boundary). Construction is via the static {@link #make} factories, consistent with the
 * rest of the fluent kit DSL.
 */
public final class TextField extends Field {

    /**
     * Creates a text field with an explicit label.
     *
     * @param name  the bound field name
     * @param label the display label
     * @return a new text field
     */
    public static TextField make(String name, String label) {
        return new TextField(name, label);
    }

    /**
     * Creates a text field whose label is humanized from its name
     * ({@code "city"} → {@code "City"}).
     *
     * @param name the bound field name
     * @return a new text field
     */
    public static TextField make(String name) {
        return new TextField(name, Field.humanize(name));
    }

    private TextField(String name, String label) {
        super(name, label);
    }
}
