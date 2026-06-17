/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import org.jspecify.annotations.Nullable;

/**
 * A single-line text input (the filament-forms {@code TextInput} carried over onto the schema
 * engine). Carries the HTML input type, the max-length, and the affix/helper surface from
 * {@link SchemaField}. Use {@link Select} for option-bound values and {@link Checkbox} for booleans.
 */
public final class TextInput extends SchemaField<String, TextInput> {

    /** The input type the field renders as. */
    public enum Type {
        /** Plain text. */
        TEXT("text"),
        /** Email (mobile keyboard + native hint). */
        EMAIL("email"),
        /** Password (masked). */
        PASSWORD("password"),
        /** Numeric. */
        NUMBER("number"),
        /** Telephone. */
        TEL("tel"),
        /** URL. */
        URL("url");

        private final String html;

        Type(String html) {
            this.html = html;
        }

        /** @return the HTML {@code type} attribute value */
        public String html() {
            return html;
        }
    }

    private Type type = Type.TEXT;
    private @Nullable Integer maxLength;

    private TextInput(String name) {
        super(name);
    }

    private TextInput(String name, String label) {
        super(name, label);
    }

    /**
     * @param name the field name and state path
     * @return a new text input
     */
    public static TextInput make(String name) {
        return new TextInput(name);
    }

    /**
     * @param name the field name and state path
     * @param label the explicit label
     * @return a new text input
     */
    public static TextInput make(String name, String label) {
        return new TextInput(name, label);
    }

    /**
     * Sets the input type and, where it maps to a format rule, adds the matching validation.
     *
     * @param type the input type
     * @return this field
     */
    public TextInput type(Type type) {
        this.type = type;
        if (type == Type.EMAIL) {
            rule(Rules.email());
        } else if (type == Type.URL) {
            rule(Rules.url());
        }
        return this;
    }

    /**
     * Convenience for {@code type(Type.EMAIL)}.
     *
     * @return this field, as an email input
     */
    public TextInput email() {
        return type(Type.EMAIL);
    }

    /**
     * Convenience for {@code type(Type.PASSWORD)}.
     *
     * @return this field, as a password input
     */
    public TextInput password() {
        return type(Type.PASSWORD);
    }

    /**
     * @return the input type (default {@link Type#TEXT})
     */
    public Type type() {
        return type;
    }

    /**
     * Sets the maximum length and adds the matching {@code max} validation rule.
     *
     * @param maxLength the maximum character count
     * @return this field
     */
    public TextInput maxLength(int maxLength) {
        if (maxLength < 1) {
            throw new IllegalArgumentException("maxLength must be at least 1");
        }
        this.maxLength = maxLength;
        return rule(Rules.max(maxLength));
    }

    /**
     * @return the maximum length, or {@code null} if unbounded
     */
    public @Nullable Integer maxLength() {
        return maxLength;
    }
}
