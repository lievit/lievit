/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * Declares which concrete {@code @LievitComponent} classes render a {@link Resource}'s full-page CRUD
 * pages (the Filament {@code getPages()}), so the panel can mount each at its {@link AdminRoutes} URL.
 *
 * <p>The page components are adopter-written (they must declare their own {@code @Wire} fields and
 * {@code @LievitAction} methods, which the lievit core binds only when declared on the component
 * class itself) and delegate their logic to {@link dev.lievit.kit.page.ListPageDriver} /
 * {@link dev.lievit.kit.page.FormPageDriver} / {@link dev.lievit.kit.page.ViewPageDriver}. A
 * {@link Resource} declares this set from {@link Resource#pages()}; only {@code list} is required.
 * The {@code create}, {@code edit}, and {@code view} entries are optional (a list-only, read-only
 * resource declares only {@code list}; a resource with an {@link dev.lievit.kit.schema.infolist.Infolist
 * Infolist} but no edit declares {@code list} + {@code view}).
 *
 * @param list the list-page component class (required)
 * @param create the create-page component class, or {@code null} if the resource is not creatable
 * @param edit the edit-page component class, or {@code null} if the resource is not editable
 * @param view the view (detail) page component class, or {@code null} if the resource has no detail
 *     page
 */
public record ResourcePages(
        Class<?> list,
        @Nullable Class<?> create,
        @Nullable Class<?> edit,
        @Nullable Class<?> view) {

    /** Compact constructor: the list page is required. */
    public ResourcePages {
        Objects.requireNonNull(list, "list");
    }

    /**
     * Declares a CRUD page set (list + create + edit) with no detail page.
     *
     * @param list the list-page component class
     * @param create the create-page component class
     * @param edit the edit-page component class
     * @return the page set
     */
    public static ResourcePages of(Class<?> list, Class<?> create, Class<?> edit) {
        return new ResourcePages(list, create, edit, null);
    }

    /**
     * Declares a full page set (list + create + edit + view detail).
     *
     * @param list the list-page component class
     * @param create the create-page component class
     * @param edit the edit-page component class
     * @param view the view (detail) page component class
     * @return the page set
     */
    public static ResourcePages of(Class<?> list, Class<?> create, Class<?> edit, Class<?> view) {
        return new ResourcePages(list, create, edit, view);
    }

    /**
     * Declares a list-only page set (a read-only resource).
     *
     * @param list the list-page component class
     * @return the page set
     */
    public static ResourcePages listOnly(Class<?> list) {
        return new ResourcePages(list, null, null, null);
    }

    /**
     * Adds (or replaces) the view (detail) page on this set.
     *
     * @param view the view-page component class
     * @return a copy carrying the view page
     */
    public ResourcePages withView(Class<?> view) {
        return new ResourcePages(list, create, edit, Objects.requireNonNull(view, "view"));
    }

    /** @return whether this resource exposes a create page */
    public boolean isCreatable() {
        return create != null;
    }

    /** @return whether this resource exposes an edit page */
    public boolean isEditable() {
        return edit != null;
    }

    /** @return whether this resource exposes a view (detail) page */
    public boolean isViewable() {
        return view != null;
    }
}
