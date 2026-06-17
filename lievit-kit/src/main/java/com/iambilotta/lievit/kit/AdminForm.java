/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * The form-view builder of an {@link AdminResource}: an ordered list of {@link AdminField fields}
 * built with a fluent DSL (the filament-internals.md Form builder, on the shared {@link AdminSchema}
 * parent so it never needs a later unification with the table builder).
 *
 * @param <T> the row type the form edits
 */
public final class AdminForm<T> extends AdminSchema<T, AdminForm<T>> {

    private final List<AdminField> fields = new ArrayList<>();

    private AdminForm() {}

    /**
     * @param <T> the row type
     * @return a new, empty form builder
     */
    public static <T> AdminForm<T> create() {
        return new AdminForm<>();
    }

    /**
     * Adds a field with an explicit label.
     *
     * @param name the bound field name
     * @param label the display label
     * @return this builder
     */
    public AdminForm<T> field(String name, String label) {
        fields.add(new AdminField(name, label));
        return this;
    }

    /**
     * Adds a field whose label is humanized from its name ({@code "city"} -&gt; {@code "City"}).
     *
     * @param name the bound field name
     * @return this builder
     */
    public AdminForm<T> field(String name) {
        return field(name, AdminField.humanize(name));
    }

    /**
     * @return the fields, in declaration order, as an unmodifiable snapshot
     */
    public List<AdminField> fields() {
        return Collections.unmodifiableList(fields);
    }
}
