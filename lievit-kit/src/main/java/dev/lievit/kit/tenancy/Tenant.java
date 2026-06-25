/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.tenancy;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * A tenant: the ownership boundary a panel scopes its records by (the Filament tenant model, reduced
 * to its identity). The {@code slug} is the route segment when the panel uses path-based tenancy
 * ({@code /app/{tenant}/...}); it defaults to the id.
 *
 * @param id the stable tenant id (the value a record's tenant key matches)
 * @param name the human name shown in the tenant switcher
 * @param slug the url slug for path-based tenancy
 */
public record Tenant(String id, String name, String slug) {

    /** Compact constructor: defends the fields. */
    public Tenant {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(slug, "slug");
    }

    /**
     * Builds a tenant whose slug is its id.
     *
     * @param id the tenant id
     * @param name the human name
     * @return the tenant
     */
    public static Tenant of(String id, String name) {
        return new Tenant(id, name, id);
    }

    /**
     * Builds a tenant with an explicit slug.
     *
     * @param id the tenant id
     * @param name the human name
     * @param slug the route slug
     * @return the tenant
     */
    public static Tenant of(String id, String name, @Nullable String slug) {
        return new Tenant(id, name, slug == null ? id : slug);
    }
}
