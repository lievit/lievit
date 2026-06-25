/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import dev.lievit.LievitUrl.History;

/**
 * The reflected {@code @LievitUrl} binding of a {@code @Wire} field: which query-parameter key it
 * maps to, whether an empty value stays in the URL, and whether a change pushes or replaces a
 * history entry (ADR-0001, ADR-0012, the URL-binding feature).
 *
 * <p>A field carries one of these only when it is annotated {@code @LievitUrl}; an unannotated field
 * has {@code null} here and never participates in URL reflection. The {@code key} is resolved at
 * reflection time (the {@code as} / {@code key} alias falls back to the field name), so the wire
 * layer never re-derives it.
 *
 * @param key the query-parameter name this field maps to (already resolved from the alias or the
 *     field name)
 * @param keepEmpty whether to keep the parameter in the URL when the value is empty / null
 * @param history whether a change pushes a new history entry or replaces the current one
 */
public record UrlBinding(String key, boolean keepEmpty, History history) {

    /**
     * @param key the query-parameter name (must be non-blank)
     */
    public UrlBinding {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("a @LievitUrl binding needs a non-blank key");
        }
    }
}
