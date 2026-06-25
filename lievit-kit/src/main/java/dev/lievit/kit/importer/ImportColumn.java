/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.importer;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * One column of an {@link Importer} (the Filament {@code ImportColumn}): a named target attribute,
 * the candidate file headers it maps from (header guessing), whether it is required, an ordered list
 * of per-cell validation rules, a cast from the raw string to the typed value, and an optional
 * relationship resolver (look up a related record by a key cell).
 *
 * <p>Casting/validation run per row inside the import job; a rule failure or a cast exception is the
 * per-row failure the job captures (allow-failures). The resolved typed value is written into the
 * row's attribute map the {@link Importer#persist} step reads.
 *
 * @param <V> the typed value this column produces
 */
public final class ImportColumn<V> {

    private final String name;
    private final List<String> guesses = new ArrayList<>();
    private final List<Rule> rules = new ArrayList<>();

    private @Nullable String label;
    private boolean required;
    private Function<String, V> cast;

    private ImportColumn(String name, Function<String, V> cast) {
        this.name = Objects.requireNonNull(name, "name");
        this.cast = Objects.requireNonNull(cast, "cast");
        this.guesses.add(name);
    }

    /**
     * Declares a string column (the common case; no cast).
     *
     * @param name the target attribute name
     * @return the column
     */
    public static ImportColumn<String> make(String name) {
        return new ImportColumn<>(name, Function.identity());
    }

    /**
     * Declares a column with a cast from the raw cell to a typed value.
     *
     * @param name the target attribute name
     * @param cast maps the raw cell string to the typed value (throwing rejects the row)
     * @param <V> the typed value type
     * @return the column
     */
    public static <V> ImportColumn<V> of(String name, Function<String, V> cast) {
        return new ImportColumn<>(name, cast);
    }

    /**
     * Sets the human label shown in the header-mapping modal (defaults to the name).
     *
     * @param label the label
     * @return this column
     */
    public ImportColumn<V> label(String label) {
        this.label = Objects.requireNonNull(label, "label");
        return this;
    }

    /**
     * Adds candidate file headers this column maps from, for auto-guessing the header mapping (the
     * Filament {@code guess()}). The column name is always a candidate.
     *
     * @param headers the candidate header texts
     * @return this column
     */
    public ImportColumn<V> guess(String... headers) {
        for (String h : headers) {
            guesses.add(Objects.requireNonNull(h, "header"));
        }
        return this;
    }

    /**
     * Marks the column required: a blank cell fails the row.
     *
     * @return this column
     */
    public ImportColumn<V> required() {
        this.required = true;
        return this;
    }

    /**
     * Adds a validation rule run against the raw cell value before casting; a failing rule rejects
     * the row with its message.
     *
     * @param predicate must hold for the cell to pass
     * @param message the failure message
     * @return this column
     */
    public ImportColumn<V> rule(java.util.function.Predicate<String> predicate, String message) {
        rules.add(new Rule(Objects.requireNonNull(predicate, "predicate"), Objects.requireNonNull(message, "message")));
        return this;
    }

    /** @return the target attribute name */
    public String name() {
        return name;
    }

    /** @return the human label */
    public String label() {
        return label != null ? label : name;
    }

    /** @return the candidate file headers, including the name */
    public List<String> guesses() {
        return List.copyOf(guesses);
    }

    /** @return whether the column is required */
    public boolean isRequired() {
        return required;
    }

    /**
     * Validates and casts a raw cell into the typed value, throwing {@link ImportRowException} with a
     * human reason on a required-but-blank cell, a failing rule, or a cast exception.
     *
     * @param raw the raw cell value (may be empty)
     * @return the cast typed value, or {@code null} when an optional column's cell is blank
     */
    public @Nullable V resolve(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) {
            if (required) {
                throw new ImportRowException(label() + " is required");
            }
            return null;
        }
        for (Rule r : rules) {
            if (!r.predicate().test(value)) {
                throw new ImportRowException(r.message());
            }
        }
        try {
            return cast.apply(value);
        } catch (RuntimeException e) {
            throw new ImportRowException(
                    label() + " is invalid: " + (e.getMessage() == null ? e.toString() : e.getMessage()));
        }
    }

    private record Rule(java.util.function.Predicate<String> predicate, String message) {}
}
