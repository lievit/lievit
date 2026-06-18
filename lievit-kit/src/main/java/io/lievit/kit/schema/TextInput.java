/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.List;

import org.jspecify.annotations.Nullable;

/**
 * A single-line text input (the filament-forms {@code TextInput} carried over onto the schema
 * engine). Carries the HTML input type, the length constraints, an input mask, a password-reveal
 * toggle, datalist suggestions, autocomplete/step hints, and the affix/helper surface from
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
    private @Nullable Integer minLength;
    private @Nullable String mask;
    private boolean revealable;
    private @Nullable String autocomplete;
    private @Nullable Long step;
    private List<String> datalist = List.of();

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

    /**
     * Convenience for {@code type(Type.URL)}.
     *
     * @return this field, as a URL input
     */
    public TextInput url() {
        return type(Type.URL);
    }

    /**
     * Convenience for {@code type(Type.TEL)}.
     *
     * @return this field, as a telephone input
     */
    public TextInput tel() {
        return type(Type.TEL);
    }

    /**
     * Convenience for {@code type(Type.NUMBER)}.
     *
     * @return this field, as a numeric input
     */
    public TextInput numeric() {
        return type(Type.NUMBER);
    }

    /**
     * Sets the minimum length and adds the matching {@code min} validation rule.
     *
     * @param minLength the minimum character count
     * @return this field
     */
    public TextInput minLength(int minLength) {
        if (minLength < 0) {
            throw new IllegalArgumentException("minLength must not be negative");
        }
        this.minLength = minLength;
        return rule(Rules.min(minLength));
    }

    /**
     * @return the minimum length, or {@code null} if unbounded
     */
    public @Nullable Integer minLength() {
        return minLength;
    }

    /**
     * Sets an input mask (the client-side formatting template, e.g. {@code "999.999.999-99"}). The
     * kit carries the mask string; the client applies it.
     *
     * @param mask the mask template
     * @return this field
     */
    public TextInput mask(String mask) {
        this.mask = java.util.Objects.requireNonNull(mask, "mask");
        return this;
    }

    /**
     * @return the input mask, or {@code null} if none
     */
    public @Nullable String mask() {
        return mask;
    }

    /**
     * Adds a password-reveal toggle (only meaningful on a {@link Type#PASSWORD} input).
     *
     * @return this field
     */
    public TextInput revealable() {
        this.revealable = true;
        return this;
    }

    /**
     * @return {@code true} if a password-reveal toggle is shown
     */
    public boolean isRevealable() {
        return revealable;
    }

    /**
     * Sets the HTML {@code autocomplete} attribute (for example {@code "off"} or {@code "email"}).
     *
     * @param autocomplete the autocomplete token
     * @return this field
     */
    public TextInput autocomplete(String autocomplete) {
        this.autocomplete = java.util.Objects.requireNonNull(autocomplete, "autocomplete");
        return this;
    }

    /**
     * @return the autocomplete token, or {@code null} for the browser default
     */
    public @Nullable String autocomplete() {
        return autocomplete;
    }

    /**
     * Sets the numeric step (only meaningful on a {@link Type#NUMBER} input).
     *
     * @param step the step
     * @return this field
     */
    public TextInput step(long step) {
        if (step < 1) {
            throw new IllegalArgumentException("step must be at least 1");
        }
        this.step = step;
        return this;
    }

    /**
     * @return the numeric step, or {@code null} for the default granularity
     */
    public @Nullable Long step() {
        return step;
    }

    /**
     * Sets datalist suggestions (a browser-native typeahead; the value stays free).
     *
     * @param options the suggested values
     * @return this field
     */
    public TextInput datalist(List<String> options) {
        this.datalist = List.copyOf(options);
        return this;
    }

    /**
     * @return the datalist suggestions (unmodifiable; empty for none)
     */
    public List<String> datalist() {
        return datalist;
    }
}
