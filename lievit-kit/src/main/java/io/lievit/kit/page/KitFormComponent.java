/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.page;

import io.lievit.kit.AdminFormView;
import io.lievit.kit.AdminRoutes;
import io.lievit.kit.Resource;
import java.util.Objects;

/**
 * The kit-owned, GENERIC render entry for the canonical form chrome ({@code kit/form.jte}): the
 * reusable logic a concrete {@code @LievitComponent} (or a plain controller) delegates to in order to
 * render any {@link Resource}'s create / edit page as the full Filament form, instead of
 * hand-assembling the field-wrapper chrome per resource.
 *
 * <p>It is the form-side twin of {@link KitTableComponent}: it builds the bounded {@link AdminFormView}
 * from the resource's {@link Resource#form() form} and wraps it in a {@link KitFormView} carrying the
 * <em>render-time</em> facts the {@code kit/form.jte} template needs and the pure {@link AdminFormView}
 * deliberately does not carry: the native {@code <form>} POST action url and the cancel href, both
 * derived from the resource's {@link AdminRoutes} so a host gets a correct, JS-off form for free. A
 * host that needs more (custom submit / cancel labels) layers them on with the {@link KitFormView}
 * withers.
 *
 * @param <T> the resource row type
 */
public final class KitFormComponent<T> {

    private final Resource<T> resource;
    private final AdminRoutes routes;

    /**
     * @param resource the admin resource
     * @param panelId the owning panel id (the route prefix, e.g. {@code "admin"})
     */
    public KitFormComponent(Resource<T> resource, String panelId) {
        this.resource = Objects.requireNonNull(resource, "resource");
        this.routes = AdminRoutes.of(panelId, resource);
    }

    /**
     * Builds the render bundle for a fresh create page: a blank {@link AdminFormView} wrapped with the
     * resource's create POST action ({@code /{panel}/{slug}/create}) and the list cancel href.
     *
     * @return the render bundle the {@code kit/form.jte} template reads
     */
    public KitFormView createView() {
        return KitFormView.of(AdminFormView.forCreate(resource.form()), routes.create())
                .withCancelUrl(routes.list());
    }

    /**
     * Builds the render bundle for an edit page prefilled from an existing record: the prefilled
     * {@link AdminFormView} wrapped with the resource's update POST action ({@code
     * /{panel}/{slug}/{id}/edit}) and the list cancel href.
     *
     * @param id the record id
     * @param record the record being edited
     * @return the render bundle
     */
    public KitFormView editView(String id, T record) {
        return KitFormView.of(AdminFormView.forEdit(resource.form(), record), routes.edit(id))
                .withCancelUrl(routes.list());
    }

    /**
     * Wraps an already-built {@link AdminFormView} (e.g. a re-render after a failed submit, carrying
     * the submitted values + errors) with the resource's POST action and the list cancel href. The
     * host can still override the labels on the returned bundle.
     *
     * @param view the bounded form view-model (typically from {@link AdminFormView#withErrors})
     * @param action the native {@code <form>} POST action url (create or update route)
     * @return the render bundle
     */
    public KitFormView decorate(AdminFormView view, String action) {
        return KitFormView.of(view, action).withCancelUrl(routes.list());
    }

    /** @return the resource this component renders */
    public Resource<T> resource() {
        return resource;
    }

    /** @return the resource's CRUD routes under the owning panel */
    public AdminRoutes routes() {
        return routes;
    }
}
