/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.page;

import io.lievit.kit.AdminListView;
import io.lievit.kit.AdminRoutes;
import io.lievit.kit.ListRequest;
import io.lievit.kit.Resource;
import io.lievit.kit.Sort;
import java.util.Objects;

/**
 * The kit-owned, GENERIC render entry for the canonical table chrome ({@code kit/table.jte}): the
 * reusable logic a concrete {@code @LievitComponent} (or a plain controller) delegates to in order to
 * render any {@link Resource} as the full Filament table, instead of hand-assembling the chrome.
 *
 * <p>It mirrors {@link ListPageDriver} (which it wraps for the bounded read) but adds the
 * <em>render-time</em> facts the {@code kit/table.jte} template needs and the pure {@link AdminListView}
 * deliberately does not carry: the server-first URL patterns the controls stamp (numbered page link,
 * sortable header link, per-page size link), all derived from the resource's {@link AdminRoutes} so a
 * host gets correct, JS-off links for free. A host that needs more (filter indicator chips, bulk
 * selection, summaries) layers them on with the {@link KitTableView} withers.
 *
 * <p>Why a separate driver and not a component: the lievit core binds only the {@code @Wire} fields
 * and {@code @LievitAction} methods declared on the component class ITSELF (not inherited), so the kit
 * cannot ship a base {@code @LievitComponent} a resource subclasses. Instead a concrete component
 * declares its own thin wire surface (page / search) and delegates the render bundle to this driver,
 * exactly as the hello-admin list component delegates to {@link ListPageDriver}. See
 * {@code KitTableComponentTest} for the worked host.
 *
 * @param <T> the resource row type
 */
public final class KitTableComponent<T> {

    private final Resource<T> resource;
    private final AdminRoutes routes;
    private final ListPageDriver<T> driver;

    /**
     * @param resource the admin resource
     * @param panelId the owning panel id (the route prefix, e.g. {@code "admin"})
     * @param authorizer the authorization seam (host policy, or
     *     {@link io.lievit.kit.AdminAuthorizer#permitAll()})
     */
    public KitTableComponent(
            Resource<T> resource, String panelId, io.lievit.kit.AdminAuthorizer authorizer) {
        this.resource = Objects.requireNonNull(resource, "resource");
        this.routes = AdminRoutes.of(panelId, resource);
        this.driver = new ListPageDriver<>(resource, panelId, authorizer);
    }

    /**
     * Builds the render bundle for a one-based page (no search / sort / filters): the bounded
     * {@link AdminListView} wrapped with the resource's server-first URL patterns.
     *
     * @param page the one-based page number
     * @return the render bundle the {@code kit/table.jte} template reads
     */
    public KitTableView render(int page) {
        return decorate(driver.view(page));
    }

    /**
     * Builds the render bundle for a full list request (page / size / sort / search / filters).
     *
     * @param request the user-driven list state
     * @return the render bundle
     */
    public KitTableView render(ListRequest request) {
        return decorate(driver.view(request));
    }

    /**
     * Wraps a bounded {@link AdminListView} with the resource's server-first URL patterns: the
     * numbered-page link ({@code ?page=%d}), the sortable-header link ({@code ?sort=%s}), and the
     * per-page size link ({@code ?size=%d}), all rooted at the resource's list route. The host can
     * still override or extend any of these (and add chips / selection / summaries) on the returned
     * bundle.
     *
     * @param view the bounded list view-model
     * @return the render bundle with the resource's default URL patterns applied
     */
    public KitTableView decorate(AdminListView view) {
        String list = routes.list();
        return KitTableView.of(view)
                .withPageHref(list + "?page=%d")
                .withSortHref(list + "?sort=%s")
                .withSizeHref(list + "?size=%d");
    }

    /**
     * Convenience: a {@link ListRequest} at the resource table's default page size, page 1, no sort,
     * no search, the table's default filters. The host usually carries its own wire-bound page /
     * search and builds the request itself; this is the simplest first-load.
     *
     * @return the default first-page request
     */
    public ListRequest defaultRequest() {
        return new ListRequest(
                1,
                resource.table().defaultPageSize(),
                Sort.NONE,
                "",
                resource.table().defaultFilters());
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
