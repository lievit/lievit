/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

/**
 * A multi-line text area field.
 *
 * <p>Renders as a {@code <textarea>} in the form. The visible row count defaults to {@value #DEFAULT_ROWS}
 * and can be adjusted via {@link #rows(int)}.
 */
public final class TextareaField extends Field {

    /** The default number of visible rows rendered for this field. */
    public static final int DEFAULT_ROWS = 3;

    private int rows = DEFAULT_ROWS;

    /**
     * Creates a textarea field with an explicit label.
     *
     * @param name  the bound field name
     * @param label the display label
     * @return a new textarea field
     */
    public static TextareaField make(String name, String label) {
        return new TextareaField(name, label);
    }

    /**
     * Creates a textarea field whose label is humanized from its name.
     *
     * @param name the bound field name
     * @return a new textarea field
     */
    public static TextareaField make(String name) {
        return new TextareaField(name, Field.humanize(name));
    }

    private TextareaField(String name, String label) {
        super(name, label);
    }

    /**
     * Sets the number of visible rows in the rendered textarea.
     *
     * @param rows a positive row count
     * @return this field
     * @throws IllegalArgumentException if {@code rows} is not positive
     */
    public TextareaField rows(int rows) {
        if (rows <= 0) {
            throw new IllegalArgumentException("rows must be positive, got: " + rows);
        }
        this.rows = rows;
        return this;
    }

    /**
     * @return the number of visible rows (default {@value #DEFAULT_ROWS})
     */
    public int rows() {
        return rows;
    }
}
