/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

import java.util.Map;
import java.util.Objects;

import dev.lievit.component.LievitEffects;
import dev.lievit.kit.AdminActionContext;
import dev.lievit.kit.AdminActionResult;
import dev.lievit.kit.AdminAuthorizer;
import dev.lievit.kit.AdminListView;
import dev.lievit.kit.AdminRoutes;
import dev.lievit.kit.DeleteAction;
import dev.lievit.kit.RecordRepository;
import dev.lievit.kit.Resource;

/**
 * The reusable logic of a full-page <strong>List</strong> page (the Filament {@code ListRecords},
 * full-page mode), factored out of the wire component because the lievit core binds only the
 * {@code @Wire} fields and {@code @LievitAction} methods <em>declared on the component class itself</em>
 * (not inherited; {@code ComponentMetadata} reflects {@code getDeclaredFields}). So a concrete
 * {@code @LievitComponent} declares its own wire fields + actions and <em>delegates</em> to this
 * driver, exactly as the hello-admin list component delegates to {@link AdminListView}.
 *
 * <p>The driver owns: building the bounded {@link AdminListView} for a page (through
 * {@link RecordRepository#page}, never the whole table), and running the row-level
 * {@link DeleteAction} (authorize, delete, flash + redirect) on the lievit
 * {@link LievitEffects effects substrate}.
 *
 * @param <T> the resource row type
 */
public final class ListPageDriver<T> {

    private final Resource<T> resource;
    private final String panelId;
    private final AdminAuthorizer authorizer;

    /**
     * @param resource the admin resource
     * @param panelId the owning panel id (the route prefix)
     * @param authorizer the authorization seam (host policy, or {@link AdminAuthorizer#permitAll()})
     */
    public ListPageDriver(Resource<T> resource, String panelId, AdminAuthorizer authorizer) {
        this.resource = Objects.requireNonNull(resource, "resource");
        this.panelId = Objects.requireNonNull(panelId, "panelId");
        this.authorizer = Objects.requireNonNull(authorizer, "authorizer");
    }

    /**
     * Builds the bounded list view-model for a one-based page.
     *
     * @param page the one-based page number
     * @return the list view-model (its {@link AdminListView.Pagination} clamps the page to a real one)
     */
    public AdminListView view(int page) {
        return AdminListView.of(resource, page);
    }

    /**
     * Builds the bounded list view-model for a full list request (page, size, sort, search,
     * filters).
     *
     * @param request the user-driven list state
     * @return the list view-model
     */
    public AdminListView view(dev.lievit.kit.ListRequest request) {
        return AdminListView.of(resource, request);
    }

    /**
     * Runs the row-level delete: authorize, delete the record, flash a success notification, and
     * redirect to the list. A blank id is a no-op (nothing armed).
     *
     * @param recordId the id of the row to delete
     * @param effects the current wire-call effects sink (from {@link LievitEffects#current()})
     * @return the action outcome (completed / forbidden); never invalid (delete has no form)
     */
    public AdminActionResult delete(String recordId, LievitEffects effects) {
        Objects.requireNonNull(effects, "effects");
        if (recordId == null || recordId.isBlank()) {
            return AdminActionResult.completed(null);
        }
        AdminActionContext<T> context =
                new AdminActionContext<>(
                        resource,
                        AdminRoutes.of(panelId, resource),
                        authorizer,
                        effects,
                        recordId,
                        Map.of());
        return new DeleteAction<T>().run(context);
    }

    /** @return the resource this driver serves */
    public Resource<T> resource() {
        return resource;
    }

    /** @return the resource's CRUD routes under the owning panel */
    public AdminRoutes routes() {
        return AdminRoutes.of(panelId, resource);
    }
}
