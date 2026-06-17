/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.support.EvaluationContext;
import io.lievit.kit.support.EvaluationContext.Operation;

/**
 * The top-level schema container that ties a tree of {@link SchemaComponent}s to a live
 * {@link SchemaState} and drives the full lifecycle (the filament-schemas {@code Schema} root
 * carried over). It is the engine's entry point: walk the tree to hydrate on mount, collect the
 * visible fields, validate them, and dehydrate the persist-ready data on submit.
 *
 * <p>This is what the brief's P0 "schema state engine" issue asks for as a coherent whole: not N
 * independent components, but one engine that hydrates, validates, and dehydrates the WHOLE tree
 * consistently, honoring conditional visibility and the dehydration flags.
 */
public final class SchemaForm {

    private final List<SchemaComponent<?, ?>> components = new ArrayList<>();
    private Operation operation = Operation.CREATE;
    private @Nullable Object record;

    private SchemaForm() {}

    /**
     * @return a new, empty schema form
     */
    public static SchemaForm create() {
        return new SchemaForm();
    }

    /**
     * Adds top-level components (fields or layout containers) to the schema.
     *
     * @param toAdd the components in declaration order
     * @return this schema
     */
    public SchemaForm components(SchemaComponent<?, ?>... toAdd) {
        for (SchemaComponent<?, ?> c : toAdd) {
            components.add(Objects.requireNonNull(c, "component"));
        }
        return this;
    }

    /**
     * Sets the CRUD operation the schema runs under (drives {@code visibleOn}/{@code hiddenOn} and
     * the {@code unique}-on-edit semantics) and the record being edited.
     *
     * @param operation the CRUD operation
     * @param record the record being edited, or {@code null} when creating
     * @return this schema
     */
    public SchemaForm operating(Operation operation, @Nullable Object record) {
        this.operation = Objects.requireNonNull(operation, "operation");
        this.record = record;
        return this;
    }

    /**
     * @return the top-level components in declaration order (unmodifiable)
     */
    public List<SchemaComponent<?, ?>> components() {
        return List.copyOf(components);
    }

    /**
     * @return every leaf field in the tree, flattened across layout containers, in declaration order
     */
    public List<SchemaField<?, ?>> fields() {
        List<SchemaField<?, ?>> out = new ArrayList<>();
        collectFields(components, out);
        return out;
    }

    /**
     * Hydrates the whole tree against a state on mount: applies each field's default and fires its
     * {@code afterStateHydrated} hooks.
     *
     * @param state the live schema state
     */
    public void hydrate(SchemaState state) {
        EvaluationContext context = contextOver(state);
        walk(components, c -> c.hydrate(state, context));
    }

    /**
     * Validates every VISIBLE leaf field against the live state, collecting one message per failing
     * field keyed by its state path (the first failing rule per field).
     *
     * @param state the live schema state
     * @return field path to failure message; empty when the whole schema is valid
     */
    public Map<String, String> validate(SchemaState state) {
        EvaluationContext context = contextOver(state);
        Map<String, String> errors = new LinkedHashMap<>();
        for (SchemaField<?, ?> field : fields()) {
            field.validate(state, context)
                    .ifPresent(
                            message -> {
                                if (field.statePath() != null) {
                                    errors.put(field.statePath(), message);
                                }
                            });
        }
        return errors;
    }

    /**
     * Dehydrates the whole tree into the persist-ready data, honoring visibility and the dehydration
     * flags (a hidden field with {@code dehydratedWhenHidden(false)} is omitted).
     *
     * @param state the live schema state
     * @return the persist-ready flat data keyed by state path
     */
    public Map<String, @Nullable Object> dehydrate(SchemaState state) {
        EvaluationContext context = contextOver(state);
        Map<String, @Nullable Object> persisted = new LinkedHashMap<>();
        walk(components, c -> c.dehydrate(state, context, persisted::put));
        return persisted;
    }

    private EvaluationContext contextOver(SchemaState state) {
        // A mutable context so afterStateUpdated hooks invoked downstream can write siblings.
        return MutableEvaluationContext.over(null, record, operation, state);
    }

    private static void walk(
            List<SchemaComponent<?, ?>> components, java.util.function.Consumer<SchemaComponent<?, ?>> visit) {
        for (SchemaComponent<?, ?> c : components) {
            visit.accept(c);
            if (c instanceof Layout<?> layout) {
                walk(layout.children(), visit);
            } else if (c instanceof Tabs tabs) {
                for (Tabs.Tab tab : tabs.tabs()) {
                    visit.accept(tab);
                    walk(tab.children(), visit);
                }
            } else if (c instanceof Wizard wizard) {
                for (Wizard.Step step : wizard.steps()) {
                    visit.accept(step);
                    walk(step.children(), visit);
                }
            }
        }
    }

    private static void collectFields(
            List<SchemaComponent<?, ?>> components, List<SchemaField<?, ?>> out) {
        for (SchemaComponent<?, ?> c : components) {
            if (c instanceof SchemaField<?, ?> field) {
                out.add(field);
            } else if (c instanceof Layout<?> layout) {
                collectFields(layout.children(), out);
            } else if (c instanceof Tabs tabs) {
                for (Tabs.Tab tab : tabs.tabs()) {
                    collectFields(tab.children(), out);
                }
            } else if (c instanceof Wizard wizard) {
                for (Wizard.Step step : wizard.steps()) {
                    collectFields(step.children(), out);
                }
            }
        }
    }
}
