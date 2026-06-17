/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.Objects;

/**
 * One field of an {@link AdminForm}: a bound name plus a display label (the filament-internals.md
 * {@code TextInput} carried over at its v0.1 minimum; the rich field types are a later slice).
 */
public final class AdminField {

    private final String name;
    private final String label;

    /**
     * @param name the bound field name (matches the model attribute / {@code @Wire} field)
     * @param label the display label
     */
    AdminField(String name, String label) {
        this.name = Objects.requireNonNull(name, "name");
        this.label = Objects.requireNonNull(label, "label");
    }

    /**
     * @return the bound field name
     */
    public String name() {
        return name;
    }

    /**
     * @return the display label
     */
    public String label() {
        return label;
    }

    /**
     * Humanizes a field name into a default label: {@code "city"} -&gt; {@code "City"},
     * {@code "postal_code"} / {@code "postalCode"} -&gt; {@code "Postal Code"}.
     *
     * @param name the field name
     * @return a title-cased, space-separated label
     */
    static String humanize(String name) {
        String spaced =
                name.replace('_', ' ')
                        .replaceAll("([a-z])([A-Z])", "$1 $2")
                        .trim();
        if (spaced.isEmpty()) {
            return spaced;
        }
        String[] words = spaced.split("\\s+");
        StringBuilder out = new StringBuilder();
        for (String word : words) {
            if (out.length() > 0) {
                out.append(' ');
            }
            out.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return out.toString();
    }
}
