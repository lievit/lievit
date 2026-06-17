/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;

/**
 * A single option in a {@link SelectField}: a submitted {@code value} paired with a human
 * {@code label} shown in the rendered {@code <select>} element.
 *
 * <p>Immutable value type; construction via the {@link #of} factory keeps call sites readable.
 */
public record SelectOption(String value, String label) {

    /**
     * Compact canonical constructor: enforces non-null on both components.
     */
    public SelectOption {
        Objects.requireNonNull(value, "value");
        Objects.requireNonNull(label, "label");
    }

    /**
     * Convenience factory.
     *
     * @param value the submitted form value
     * @param label the displayed option text
     * @return a new option
     */
    public static SelectOption of(String value, String label) {
        return new SelectOption(value, label);
    }
}
