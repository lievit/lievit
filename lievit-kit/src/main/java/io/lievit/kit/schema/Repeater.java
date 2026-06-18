/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.support.EvaluationContext;

/**
 * A repeater of a repeated sub-schema (the filament-forms {@code Repeater} carried over): edits a
 * variable-length list of items, each item a record over the same child {@code schema} of fields.
 * It binds a {@link List} of item maps at its state path, so item 1's {@code qty} field lives at
 * {@code items.1.qty} (the dot-path grammar {@link SchemaState} already addresses).
 *
 * <p>Behaviors: add / delete / reorder / clone rows, {@code minItems}/{@code maxItems} bounds,
 * {@code defaultItems} seeded on create, a computed per-item collapsible {@code itemLabel}, and a
 * column grid. The {@code relationship()} marker declares HasMany persistence mode (the host's
 * create/update/delete diff); the kit carries the marker and the column name, the persistence is the
 * adopter's.
 *
 * <p>It is a {@link SchemaField} (it binds and dehydrates a value) that ALSO holds a child schema:
 * {@link SchemaForm} walks the child schema once per item, prefixing the indexed path, so nested
 * fields hydrate, validate (with indexed error paths {@code items.0.name}), and dehydrate per item.
 */
public final class Repeater extends SchemaField<List<Map<String, @Nullable Object>>, Repeater> {

    private final List<SchemaComponent<?, ?>> childSchema = new ArrayList<>();
    private int columns = 1;
    private @Nullable Integer minItems;
    private @Nullable Integer maxItems;
    private int defaultItems = 1;
    private boolean addable = true;
    private boolean deletable = true;
    private boolean reorderable = true;
    private boolean cloneable;
    private boolean collapsible;
    private @Nullable Function<EvaluationContext, @Nullable String> itemLabel;
    private @Nullable String relationship;

    private Repeater(String name) {
        super(name);
        cast(listCast());
    }

    /**
     * @param name the field name and state path (the list lives here)
     * @return a new repeater
     */
    public static Repeater make(String name) {
        return new Repeater(name);
    }

    /**
     * Declares the sub-schema repeated per item.
     *
     * @param components the child components, in declaration order
     * @return this repeater
     */
    public Repeater schema(SchemaComponent<?, ?>... components) {
        for (SchemaComponent<?, ?> c : components) {
            childSchema.add(Objects.requireNonNull(c, "component"));
        }
        return this;
    }

    /**
     * @return the child sub-schema in declaration order (unmodifiable)
     */
    public List<SchemaComponent<?, ?>> childSchema() {
        return List.copyOf(childSchema);
    }

    /**
     * Lays each item's fields out in an {@code n}-column grid.
     *
     * @param columns the column count (at least 1)
     * @return this repeater
     */
    public Repeater columns(int columns) {
        if (columns < 1) {
            throw new IllegalArgumentException("columns must be at least 1");
        }
        this.columns = columns;
        return this;
    }

    /**
     * @return the per-item column count (default 1)
     */
    public int columns() {
        return columns;
    }

    /**
     * Sets the minimum number of items and adds the matching {@code min} validation rule.
     *
     * @param minItems the inclusive lower bound
     * @return this repeater
     */
    public Repeater minItems(int minItems) {
        if (minItems < 0) {
            throw new IllegalArgumentException("minItems must not be negative");
        }
        this.minItems = minItems;
        return rule(Rules.min(minItems));
    }

    /**
     * @return the minimum item count, or {@code null} if unbounded
     */
    public @Nullable Integer minItems() {
        return minItems;
    }

    /**
     * Sets the maximum number of items and adds the matching {@code max} validation rule.
     *
     * @param maxItems the inclusive upper bound
     * @return this repeater
     */
    public Repeater maxItems(int maxItems) {
        if (maxItems < 1) {
            throw new IllegalArgumentException("maxItems must be at least 1");
        }
        this.maxItems = maxItems;
        return rule(Rules.max(maxItems));
    }

    /**
     * @return the maximum item count, or {@code null} if unbounded
     */
    public @Nullable Integer maxItems() {
        return maxItems;
    }

    /**
     * Sets how many empty items are seeded on create.
     *
     * @param defaultItems the count (zero for none)
     * @return this repeater
     */
    public Repeater defaultItems(int defaultItems) {
        if (defaultItems < 0) {
            throw new IllegalArgumentException("defaultItems must not be negative");
        }
        this.defaultItems = defaultItems;
        return this;
    }

    /**
     * @return the count of items seeded on create (default 1)
     */
    public int defaultItems() {
        return defaultItems;
    }

    /**
     * Forbids adding items.
     *
     * @param addable whether items can be added
     * @return this repeater
     */
    public Repeater addable(boolean addable) {
        this.addable = addable;
        return this;
    }

    /**
     * @return {@code true} if items can be added (default {@code true})
     */
    public boolean isAddable() {
        return addable;
    }

    /**
     * Forbids deleting items.
     *
     * @param deletable whether items can be deleted
     * @return this repeater
     */
    public Repeater deletable(boolean deletable) {
        this.deletable = deletable;
        return this;
    }

    /**
     * @return {@code true} if items can be deleted (default {@code true})
     */
    public boolean isDeletable() {
        return deletable;
    }

    /**
     * Forbids drag-reordering items.
     *
     * @param reorderable whether items can be reordered
     * @return this repeater
     */
    public Repeater reorderable(boolean reorderable) {
        this.reorderable = reorderable;
        return this;
    }

    /**
     * @return {@code true} if items can be reordered (default {@code true})
     */
    public boolean isReorderable() {
        return reorderable;
    }

    /**
     * Allows cloning an item into a new one.
     *
     * @return this repeater
     */
    public Repeater cloneable() {
        this.cloneable = true;
        return this;
    }

    /**
     * @return {@code true} if items can be cloned
     */
    public boolean isCloneable() {
        return cloneable;
    }

    /**
     * Makes items collapsible (a per-item toggle, paired with {@link #itemLabel}).
     *
     * @return this repeater
     */
    public Repeater collapsible() {
        this.collapsible = true;
        return this;
    }

    /**
     * @return {@code true} if items are collapsible
     */
    public boolean isCollapsible() {
        return collapsible;
    }

    /**
     * Computes a per-item header label from the item's own state (a closure over a context whose
     * {@link EvaluationContext#state()} is the item map).
     *
     * @param itemLabel produces the header from the item context
     * @return this repeater
     */
    public Repeater itemLabel(Function<EvaluationContext, @Nullable String> itemLabel) {
        this.itemLabel = Objects.requireNonNull(itemLabel, "itemLabel");
        return this;
    }

    /**
     * Resolves a single item's collapsible header label, or {@code null} when none is configured.
     *
     * @param itemContext a context whose own state is the item map
     * @return the item header, or {@code null}
     */
    public @Nullable String resolveItemLabel(EvaluationContext itemContext) {
        return itemLabel == null ? null : itemLabel.apply(itemContext);
    }

    /**
     * Declares HasMany relationship-persistence mode: the items load from and save to the named
     * relation (the host applies the create/update/delete diff).
     *
     * @param relationship the relation name
     * @return this repeater
     */
    public Repeater relationship(String relationship) {
        this.relationship = Objects.requireNonNull(relationship, "relationship");
        return this;
    }

    /**
     * @return the relationship name, or {@code null} when the repeater binds a plain array
     */
    public @Nullable String relationship() {
        return relationship;
    }

    /**
     * @return {@code true} if the repeater persists to a HasMany relation
     */
    public boolean isRelationship() {
        return relationship != null;
    }

    /**
     * @param state the live schema state
     * @return the current number of items at this repeater's path
     */
    public int itemCount(SchemaState state) {
        @Nullable List<Map<String, @Nullable Object>> items = read(state);
        return items == null ? 0 : items.size();
    }

    /**
     * Validates every item's sub-schema, returning failures keyed by the INDEXED state path
     * ({@code items.0.name}). Each item is validated against its own map so a child field's
     * conditional rules read its sibling within the same item, and the index prefix makes the error
     * paths line up with the dot-path state grammar.
     *
     * @param state the live schema state
     * @param operation the CRUD operation in effect
     * @param record the record being edited, or {@code null}
     * @return indexed-path to first-failure-message for every failing item field; empty when valid
     */
    public Map<String, String> validateItems(
            SchemaState state,
            EvaluationContext.Operation operation,
            @Nullable Object record) {
        Map<String, String> errors = new java.util.LinkedHashMap<>();
        @Nullable List<Map<String, @Nullable Object>> items = read(state);
        if (items == null) {
            return errors;
        }
        String base = statePath();
        if (base == null) {
            return errors;
        }
        for (int i = 0; i < items.size(); i++) {
            Map<String, @Nullable Object> item = items.get(i);
            SchemaState itemState = SchemaState.of(item == null ? Map.of() : item);
            EvaluationContext itemContext =
                    EvaluationContext.readOnly(null, record, operation, itemState.flatten());
            for (SchemaField<?, ?> child : childFields()) {
                String childPath = child.statePath();
                if (childPath == null) {
                    continue;
                }
                int index = i;
                child.validate(itemState, itemContext)
                        .ifPresent(
                                message ->
                                        errors.put(base + "." + index + "." + childPath, message));
            }
        }
        return errors;
    }

    /** The leaf input fields of the child sub-schema, flattened across nested layout containers. */
    private List<SchemaField<?, ?>> childFields() {
        List<SchemaField<?, ?>> out = new ArrayList<>();
        collectChildFields(childSchema, out);
        return out;
    }

    private static void collectChildFields(
            List<SchemaComponent<?, ?>> components, List<SchemaField<?, ?>> out) {
        for (SchemaComponent<?, ?> c : components) {
            if (c instanceof SchemaField<?, ?> field) {
                out.add(field);
            } else if (c instanceof Layout<?> layout) {
                collectChildFields(layout.children(), out);
            }
        }
    }

    /** A cast that takes a raw list of item maps straight through (defensive copy on dehydrate). */
    @SuppressWarnings("unchecked")
    static StateCast<List<Map<String, @Nullable Object>>> listCast() {
        return new StateCast<>() {
            @Override
            public List<Map<String, @Nullable Object>> hydrate(@Nullable Object raw) {
                List<Map<String, @Nullable Object>> out = new ArrayList<>();
                if (raw instanceof List<?> list) {
                    for (Object element : list) {
                        if (element instanceof Map<?, ?> map) {
                            out.add(new java.util.LinkedHashMap<>((Map<String, @Nullable Object>) map));
                        }
                    }
                }
                return out;
            }

            @Override
            public @Nullable Object dehydrate(@Nullable List<Map<String, @Nullable Object>> value) {
                return value == null ? new ArrayList<>() : new ArrayList<>(value);
            }
        };
    }
}
