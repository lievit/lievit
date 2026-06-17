/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * Declares which concrete {@code @LievitComponent} classes render a {@link Resource}'s full-page CRUD
 * pages (the Filament {@code getPages()}), so the panel can mount each at its {@link AdminRoutes} URL.
 *
 * <p>The page components are adopter-written (they must declare their own {@code @Wire} fields and
 * {@code @LievitAction} methods, which the lievit core binds only when declared on the component
 * class itself) and delegate their logic to {@link io.lievit.kit.page.ListPageDriver} /
 * {@link io.lievit.kit.page.FormPageDriver}. A {@link Resource} declares this triple from
 * {@link Resource#pages()}; the {@code create} and {@code edit} entries are optional (a list-only,
 * read-only resource declares only {@code list}).
 *
 * @param list the list-page component class (required)
 * @param create the create-page component class, or {@code null} if the resource is not creatable
 * @param edit the edit-page component class, or {@code null} if the resource is not editable
 */
public record ResourcePages(
        Class<?> list, @Nullable Class<?> create, @Nullable Class<?> edit) {

    /** Compact constructor: the list page is required. */
    public ResourcePages {
        Objects.requireNonNull(list, "list");
    }

    /**
     * Declares a full CRUD page set (list + create + edit).
     *
     * @param list the list-page component class
     * @param create the create-page component class
     * @param edit the edit-page component class
     * @return the page set
     */
    public static ResourcePages of(Class<?> list, Class<?> create, Class<?> edit) {
        return new ResourcePages(list, create, edit);
    }

    /**
     * Declares a list-only page set (a read-only resource).
     *
     * @param list the list-page component class
     * @return the page set
     */
    public static ResourcePages listOnly(Class<?> list) {
        return new ResourcePages(list, null, null);
    }

    /** @return whether this resource exposes a create page */
    public boolean isCreatable() {
        return create != null;
    }

    /** @return whether this resource exposes an edit page */
    public boolean isEditable() {
        return edit != null;
    }
}
