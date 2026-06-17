/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.support;

import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * The typed evaluation context handed to every value-or-closure (the Java replacement for
 * Filament's reflective {@code EvaluatesClosures}, decided ONCE here, see the support-engine spec).
 *
 * <p>Filament's PHP {@code evaluate()} reflects a closure's parameter <em>names</em>
 * ({@code $state}, {@code $record}, {@code $get}, {@code $set}, {@code $operation}, …) and fills
 * each from a named/typed injection map. Java cannot introspect lambda parameter names, so the kit
 * inverts the mechanism: a closure is a {@code Function<EvaluationContext, T>} and reads what it
 * needs through named accessors on this context. The mapping from Filament's injected names to
 * these accessors is the documented contract:
 *
 * <table>
 *   <caption>Filament injected name to lievit accessor</caption>
 *   <tr><th>Filament</th><th>lievit</th></tr>
 *   <tr><td>{@code $state}</td><td>{@link #state()}</td></tr>
 *   <tr><td>{@code $rawState}</td><td>{@link #rawState()}</td></tr>
 *   <tr><td>{@code $record}</td><td>{@link #record()}</td></tr>
 *   <tr><td>{@code $get}</td><td>{@link #get(String)}</td></tr>
 *   <tr><td>{@code $set}</td><td>{@link #set(String, Object)} (only on a mutable context)</td></tr>
 *   <tr><td>{@code $operation}</td><td>{@link #operation()}</td></tr>
 *   <tr><td>{@code $old}</td><td>{@link #old()}</td></tr>
 *   <tr><td>{@code $livewire} / {@code $component}</td><td>not injected: the closure is a method
 *       reference on the host component, so {@code this} already carries them</td></tr>
 * </table>
 *
 * <p>The default {@code read-only} context throws on {@link #set(String, Object)}; the form-state
 * engine supplies a mutable one (the {@code afterStateUpdated} hook needs to write siblings).
 */
public class EvaluationContext {

    /** The CRUD operation a schema is evaluated under. */
    public enum Operation {
        /** Building a new record (the create page). */
        CREATE,
        /** Editing an existing record (the edit page). */
        EDIT,
        /** Read-only view (an infolist). */
        VIEW
    }

    private final @Nullable Object state;
    private final @Nullable Object record;
    private final Operation operation;
    private final Map<String, @Nullable Object> values;
    private final Map<String, @Nullable Object> old;

    /**
     * @param state the current component's state value (the {@code $state} of Filament)
     * @param record the record being edited, or {@code null} when creating
     * @param operation the CRUD operation in effect
     * @param values the live state of every sibling field keyed by state path (backs {@link #get})
     * @param old the previous state of every field (backs {@link #old()}); may equal {@code values}
     */
    protected EvaluationContext(
            @Nullable Object state,
            @Nullable Object record,
            Operation operation,
            Map<String, @Nullable Object> values,
            Map<String, @Nullable Object> old) {
        this.state = state;
        this.record = record;
        this.operation = Objects.requireNonNull(operation, "operation");
        this.values = Objects.requireNonNull(values, "values");
        this.old = Objects.requireNonNull(old, "old");
    }

    /**
     * @return the current component's own state value, or {@code null} if it has none
     */
    public @Nullable Object state() {
        return state;
    }

    /**
     * @return the current component's state coerced to {@code String}, or the empty string if null
     */
    public String rawState() {
        return state == null ? "" : String.valueOf(state);
    }

    /**
     * @return the record being edited, empty when creating
     */
    public Optional<Object> record() {
        return Optional.ofNullable(record);
    }

    /**
     * @return the CRUD operation the schema is being evaluated under
     */
    public Operation operation() {
        return operation;
    }

    /**
     * Reads a sibling field's live value by state path (the {@code $get} of Filament). This is how a
     * conditional or dependent field reads another field without a hard reference.
     *
     * @param path the dot state path of the sibling field
     * @return the sibling's current value, or {@code null} if unset
     */
    public @Nullable Object get(String path) {
        return values.get(Objects.requireNonNull(path, "path"));
    }

    /**
     * Reads a sibling field's live value as a {@code String} (the empty string when unset).
     *
     * @param path the dot state path of the sibling field
     * @return the value coerced to a non-null string
     */
    public String getString(String path) {
        @Nullable Object v = get(path);
        return v == null ? "" : String.valueOf(v);
    }

    /**
     * Writes a sibling field's value by state path (the {@code $set} of Filament). The read-only
     * base context refuses: only the mutable form-state context supports it.
     *
     * @param path the dot state path of the sibling field to write
     * @param value the new value
     * @throws UnsupportedOperationException always, on the read-only base context
     */
    public void set(String path, @Nullable Object value) {
        throw new UnsupportedOperationException(
                "this EvaluationContext is read-only; set() is only available while a field's"
                        + " afterStateUpdated hook runs against the live form state");
    }

    /**
     * @return the previous state of every field keyed by path (the {@code $old} of Filament)
     */
    public Map<String, @Nullable Object> old() {
        return old;
    }

    /**
     * Builds a read-only context, the common case (visibility, disabled, default, label closures
     * that only READ state).
     *
     * @param state the current component's state value
     * @param record the record being edited, or {@code null}
     * @param operation the CRUD operation
     * @param values the live state of every field keyed by path
     * @return a read-only evaluation context
     */
    public static EvaluationContext readOnly(
            @Nullable Object state,
            @Nullable Object record,
            Operation operation,
            Map<String, @Nullable Object> values) {
        return new EvaluationContext(state, record, operation, Map.copyOf(values), Map.copyOf(values));
    }

    /**
     * Builds a minimal read-only context with no record and an empty state map: useful for unit
     * tests of a closure that only reads its own {@link #state()}.
     *
     * @param state the current component's state value
     * @return a bare read-only context under the {@link Operation#CREATE} operation
     */
    public static EvaluationContext of(@Nullable Object state) {
        return readOnly(state, null, Operation.CREATE, Map.of());
    }
}
