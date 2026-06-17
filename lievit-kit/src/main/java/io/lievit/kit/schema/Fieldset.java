/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.Objects;

/**
 * A bordered group with a legend label (the filament-schemas {@code Fieldset} carried over):
 * renders as an HTML {@code <fieldset>} with a {@code <legend>}, grouping related fields without the
 * full chrome of a {@link Section}.
 */
public final class Fieldset extends Layout<Fieldset> {

    private final String label;

    private Fieldset(String label) {
        this.label = Objects.requireNonNull(label, "label");
    }

    /**
     * @param label the legend label
     * @return a new fieldset
     */
    public static Fieldset make(String label) {
        return new Fieldset(label);
    }

    /**
     * @return the legend label
     */
    public String label() {
        return label;
    }
}
