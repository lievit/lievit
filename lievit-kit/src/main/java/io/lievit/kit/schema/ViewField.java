/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * A custom-view form field (the filament-forms {@code ViewField} carried over onto the schema
 * engine): the escape hatch that renders an arbitrary template bound to the field's state, for a
 * one-off custom input the built-in palette does not cover, without forking the kit.
 *
 * <p>Unlike the read-only {@link io.lievit.kit.schema.infolist.ViewEntry}, a {@code ViewField} is a
 * full {@link SchemaField}: it binds a state path, hydrates/validates/dehydrates like any field, and
 * carries the validation surface (so a custom view can still be {@code required()} and ruled). The
 * kit holds the template name and an optional bag of static view data; the template reads and writes
 * the bound value through the standard state binding at {@link #statePath()}.
 *
 * @param <T> the in-memory (hydrated) value type the custom view binds
 */
public final class ViewField<T extends @Nullable Object> extends SchemaField<T, ViewField<T>> {

    private final String view;
    private final Map<String, @Nullable Object> viewData = new LinkedHashMap<>();

    private ViewField(String name, String view) {
        super(name);
        this.view = Objects.requireNonNull(view, "view");
    }

    /**
     * @param name the field name and state path the custom view reads and writes
     * @param view the template name/path the renderer resolves
     * @param <T> the bound value type
     * @return a new view field
     */
    public static <T extends @Nullable Object> ViewField<T> make(String name, String view) {
        return new ViewField<>(name, view);
    }

    /**
     * @return the template name/path the renderer resolves
     */
    public String view() {
        return view;
    }

    /**
     * Passes an extra static datum to the custom view (the filament {@code viewData}): merged into
     * the template's model alongside the bound state, so a one-off view can carry render config
     * without a closure.
     *
     * @param key the datum key
     * @param value the datum value (may be {@code null})
     * @return this field
     */
    public ViewField<T> viewData(String key, @Nullable Object value) {
        viewData.put(Objects.requireNonNull(key, "key"), value);
        return this;
    }

    /**
     * @return the extra static view data, in insertion order (unmodifiable)
     */
    public Map<String, @Nullable Object> viewData() {
        return Map.copyOf(viewData);
    }
}
