/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

/**
 * A one-time-code input (the filament-forms {@code OneTimeCodeInput} carried over): a row of
 * single-character boxes for an OTP / 2FA code. Binds the assembled code as a {@link String} and
 * enforces the exact {@code length} (default 6) and, by default, a digits-only format.
 */
public final class OneTimeCodeInput extends SchemaField<String, OneTimeCodeInput> {

    private int length = 6;
    private boolean digitsOnly = true;

    private OneTimeCodeInput(String name) {
        super(name);
        rule(
                (value, ctx) -> {
                    if (value == null || String.valueOf(value).isBlank()) {
                        return null;
                    }
                    String s = String.valueOf(value);
                    if (s.length() != length) {
                        return "Must be exactly " + length + " characters.";
                    }
                    if (digitsOnly && !s.chars().allMatch(Character::isDigit)) {
                        return "May only contain digits.";
                    }
                    return null;
                });
    }

    /**
     * @param name the field name and state path
     * @return a new one-time-code input of length 6, digits only
     */
    public static OneTimeCodeInput make(String name) {
        return new OneTimeCodeInput(name);
    }

    /**
     * Sets the exact code length.
     *
     * @param length the number of boxes / characters (at least 1)
     * @return this field
     */
    public OneTimeCodeInput length(int length) {
        if (length < 1) {
            throw new IllegalArgumentException("length must be at least 1");
        }
        this.length = length;
        return this;
    }

    /**
     * @return the exact code length (default 6)
     */
    public int length() {
        return length;
    }

    /**
     * Allows alphanumeric codes (digits-only is the default).
     *
     * @return this field
     */
    public OneTimeCodeInput alphanumeric() {
        this.digitsOnly = false;
        return this;
    }

    /**
     * @return {@code true} if the code must be digits only (default {@code true})
     */
    public boolean isDigitsOnly() {
        return digitsOnly;
    }
}
