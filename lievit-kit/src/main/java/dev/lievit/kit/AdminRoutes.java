/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;

/**
 * Derives the full-page CRUD URLs of a {@link Resource} under a {@link Panel}, the one place the
 * route shape lives (so the pages, the actions, and the navigation agree). The shape mirrors
 * Filament's resource routes:
 *
 * <pre>
 *   /{panel}/{slug}            list
 *   /{panel}/{slug}/create     create
 *   /{panel}/{slug}/{id}       view (detail)
 *   /{panel}/{slug}/{id}/edit  edit
 * </pre>
 *
 * @param panelId the owning panel id (the route prefix, for example {@code "admin"})
 * @param slug the resource slug (for example {@code "listings"})
 */
public record AdminRoutes(String panelId, String slug) {

    /** Compact constructor: both components are required and must be non-blank. */
    public AdminRoutes {
        Objects.requireNonNull(panelId, "panelId");
        Objects.requireNonNull(slug, "slug");
        if (panelId.isBlank() || slug.isBlank()) {
            throw new IllegalArgumentException("panelId and slug must be non-blank");
        }
    }

    /**
     * @param panelId the owning panel id
     * @param resource the resource
     * @return the routes for that resource under that panel
     */
    public static AdminRoutes of(String panelId, Resource<?> resource) {
        return new AdminRoutes(panelId, resource.slug());
    }

    /** @return the list page URL ({@code /{panel}/{slug}}) */
    public String list() {
        return "/" + panelId + "/" + slug;
    }

    /** @return the create page URL ({@code /{panel}/{slug}/create}) */
    public String create() {
        return list() + "/create";
    }

    /**
     * The detail (view) page URL. Mirrors Filament's {@code ViewRecord} route: the bare id under the
     * resource slug, with {@link #edit(String)} appending {@code /edit} on top, so a detail page is
     * URL-addressable and bookmarkable.
     *
     * @param id the record id
     * @return the view page URL ({@code /{panel}/{slug}/{id}})
     */
    public String view(String id) {
        return list() + "/" + Objects.requireNonNull(id, "id");
    }

    /**
     * @param id the record id
     * @return the edit page URL ({@code /{panel}/{slug}/{id}/edit})
     */
    public String edit(String id) {
        return list() + "/" + Objects.requireNonNull(id, "id") + "/edit";
    }
}
