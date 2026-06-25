/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * A read-only has-many display field: shows a collection of related records on a view/edit form.
 *
 * <p>This is a display-only v0.1 slice. The field renders the related items returned by the
 * {@link #items() item loader} — for example as a count badge or a compact inline list. Write
 * operations on the relation (add/remove) are deferred to a later slice.
 *
 * <p>The item loader is a {@link Supplier} evaluated at render time, not at build time, so the
 * displayed set always reflects the current state of the relation.
 */
public final class HasManyField extends Field {

    private final Supplier<List<?>> loader;

    /**
     * Creates a has-many display field with an explicit label.
     *
     * @param name   the bound field name (identifies the relation in the form model)
     * @param label  the display label
     * @param loader supplies the related items at render time
     * @return a new has-many display field
     */
    public static HasManyField make(String name, String label, Supplier<List<?>> loader) {
        return new HasManyField(name, label, loader);
    }

    /**
     * Creates a has-many display field with a humanized label.
     *
     * @param name   the bound field name
     * @param loader supplies the related items at render time
     * @return a new has-many display field
     */
    public static HasManyField make(String name, Supplier<List<?>> loader) {
        return new HasManyField(name, Field.humanize(name), loader);
    }

    private HasManyField(String name, String label, Supplier<List<?>> loader) {
        super(name, label);
        this.loader = Objects.requireNonNull(loader, "loader");
    }

    /**
     * Loads the current set of related items by invoking the item loader.
     *
     * @return the related items (may be empty, never null)
     */
    public List<?> items() {
        return loader.get();
    }
}
