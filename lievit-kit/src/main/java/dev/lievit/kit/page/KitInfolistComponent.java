/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

import dev.lievit.kit.AdminAuthorizer;
import dev.lievit.kit.AdminRoutes;
import dev.lievit.kit.Resource;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * The kit-owned, GENERIC render entry for the canonical infolist (detail / View) chrome
 * ({@code kit/infolist.jte}): the reusable logic a concrete {@code @LievitComponent} (or a plain
 * controller) delegates to in order to render any {@link Resource}'s record as the full Filament
 * {@code ViewRecord} page, instead of hand-assembling the chrome. It is the detail-page analogue of
 * {@link KitTableComponent}.
 *
 * <p>It wraps {@link ViewPageDriver} (the bounded read: load the record by id, resolve the infolist
 * into the {@link dev.lievit.kit.AdminViewView}, gate through the {@link AdminAuthorizer}) and adds the
 * render-time facts the {@code kit/infolist.jte} template needs and the pure view-model does not
 * carry: the back-to-list href, derived from the resource's {@link AdminRoutes}. A host that needs
 * more layers it on with the {@link KitInfolistView} withers.
 *
 * <p>Why a separate driver and not a component: identical to {@link KitTableComponent}, the lievit
 * core binds only the {@code @Wire} fields + {@code @LievitAction} methods declared on the component
 * class ITSELF (not inherited), so the kit cannot ship a base {@code @LievitComponent} a resource
 * subclasses. A concrete component declares its own thin wire surface and delegates the render bundle
 * to this driver.
 *
 * @param <T> the resource row type
 */
public final class KitInfolistComponent<T> {

    private final Resource<T> resource;
    private final AdminRoutes routes;
    private final ViewPageDriver<T> driver;

    /**
     * @param resource the admin resource (must declare an {@link Resource#infolist()})
     * @param panelId the owning panel id (the route prefix, e.g. {@code "admin"})
     * @param authorizer the authorization seam (host policy, or {@link AdminAuthorizer#permitAll()})
     */
    public KitInfolistComponent(Resource<T> resource, String panelId, AdminAuthorizer authorizer) {
        this.resource = Objects.requireNonNull(resource, "resource");
        this.routes = AdminRoutes.of(panelId, resource);
        this.driver = new ViewPageDriver<>(resource, panelId, authorizer);
    }

    /**
     * Resolves the detail page for a record id into the render bundle, OR the not-found / forbidden
     * marker the page renders as the right empty state.
     *
     * @param recordId the id of the record to show
     * @return the resolution: the render bundle when found + authorized, otherwise not-found / forbidden
     */
    public Resolution render(String recordId) {
        ViewPageDriver.Resolution resolution = driver.view(recordId);
        if (!resolution.isFound()) {
            return new Resolution(resolution.status(), null);
        }
        return new Resolution(resolution.status(), decorate(resolution.view()));
    }

    /**
     * Wraps a bounded {@link dev.lievit.kit.AdminViewView} with the resource's back-to-list href (the
     * Filament {@code ViewRecord} default back navigation), rooted at the resource's list route. The
     * host can still override or extend it on the returned bundle.
     *
     * @param view the bounded detail view-model
     * @return the render bundle with the resource's default back href applied
     */
    public KitInfolistView decorate(dev.lievit.kit.AdminViewView view) {
        return KitInfolistView.of(view).withBackHref(routes.list());
    }

    /** @return the resource this component renders */
    public Resource<T> resource() {
        return resource;
    }

    /** @return the resource's CRUD routes under the owning panel */
    public AdminRoutes routes() {
        return routes;
    }

    /**
     * The outcome of resolving the detail page: the render bundle when the record was found and the
     * read authorized, or a not-found / forbidden marker, mirroring {@link ViewPageDriver.Resolution}
     * but carrying the render-decorated {@link KitInfolistView}.
     *
     * @param status the outcome status
     * @param bundle the render bundle when {@link ViewPageDriver.Resolution.Status#FOUND}, else {@code null}
     */
    public record Resolution(
            ViewPageDriver.Resolution.Status status, @Nullable KitInfolistView bundle) {

        /** @return whether a record was found and resolved (the bundle is present) */
        public boolean isFound() {
            return status == ViewPageDriver.Resolution.Status.FOUND;
        }
    }
}
