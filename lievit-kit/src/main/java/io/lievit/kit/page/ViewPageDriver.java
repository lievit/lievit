/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.page;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.AdminAuthorizer;
import io.lievit.kit.AdminOperation;
import io.lievit.kit.AdminRoutes;
import io.lievit.kit.AdminViewView;
import io.lievit.kit.Resource;
import io.lievit.kit.ResourcePages;
import io.lievit.kit.schema.infolist.Infolist;

/**
 * The reusable logic of the full-page <strong>View</strong> (detail) page (the Filament
 * {@code ViewRecord}, full-page mode), factored out of the wire component for the same reason as
 * {@link ListPageDriver} / {@link FormPageDriver}: the lievit core binds only the wire fields +
 * actions declared on the component class itself, so a concrete {@code @LievitComponent} declares
 * its own and delegates here.
 *
 * <p>The driver owns: loading a record by id, resolving the resource's
 * {@link Resource#infolist() Infolist} against the record's
 * {@link Resource#recordAttributes(Object) attributes} under
 * {@link io.lievit.kit.support.EvaluationContext.Operation#VIEW VIEW}, and producing the
 * {@link AdminViewView} (the already-projected label-to-display sections + the header actions). The
 * read is bounded to one record (a single {@link io.lievit.kit.RecordRepository#findById}); a
 * missing record yields {@link Resolution#notFound()} so the page renders a 404-style empty state
 * rather than throwing.
 *
 * <p>It gates the read through the {@link AdminAuthorizer} under the {@code VIEW_LIST} read operation
 * (viewing a record is a read, like listing; there is no separate per-record VIEW operation in the
 * v0.1 {@link AdminOperation} set): a forbidden principal gets {@link Resolution#forbidden()}.
 *
 * @param <T> the resource row type
 */
public final class ViewPageDriver<T> {

    private final Resource<T> resource;
    private final String panelId;
    private final AdminAuthorizer authorizer;

    /**
     * @param resource the admin resource (must declare an {@link Resource#infolist()})
     * @param panelId the owning panel id (the route prefix)
     * @param authorizer the authorization seam (host policy, or {@link AdminAuthorizer#permitAll()})
     */
    public ViewPageDriver(Resource<T> resource, String panelId, AdminAuthorizer authorizer) {
        this.resource = Objects.requireNonNull(resource, "resource");
        this.panelId = Objects.requireNonNull(panelId, "panelId");
        this.authorizer = Objects.requireNonNull(authorizer, "authorizer");
        if (resource.infolist().isEmpty()) {
            throw new IllegalStateException(
                    "Resource."
                            + resource.slug()
                            + " has no infolist(); a View page needs one (override Resource.infolist())");
        }
    }

    /**
     * Loads the record by id and resolves the detail view-model.
     *
     * @param recordId the id of the record to show (a blank id resolves to {@link Resolution#notFound()})
     * @return the resolution: the view-model when found + authorized, otherwise not-found / forbidden
     */
    public Resolution view(String recordId) {
        if (recordId == null || recordId.isBlank()) {
            return Resolution.notFound();
        }
        @Nullable T record = resource.repository().findById(recordId).orElse(null);
        if (record == null) {
            return Resolution.notFound();
        }
        if (!authorizer.isAllowed(AdminOperation.VIEW_LIST, resource, record)) {
            return Resolution.forbidden();
        }
        Infolist infolist = resource.infolist().orElseThrow();
        Map<String, @Nullable Object> attributes = resource.recordAttributes(record);
        AdminViewView view =
                AdminViewView.of(
                        heading(record),
                        recordId,
                        infolist,
                        attributes,
                        headerActions(recordId));
        return Resolution.found(view);
    }

    /**
     * The detail heading. Defaults to the resource label; a resource that wants a row-specific title
     * (e.g. the listing's city) does it through its infolist or by overriding the page component's
     * heading. Kept simple here so the driver stays head-less.
     */
    private String heading(T record) {
        return resource.label();
    }

    /**
     * The toolbar actions for the detail page. v0.1 ships the standard Filament {@code ViewRecord}
     * navigations derived from the routes: an Edit link (primary) when the resource is editable and a
     * back-to-list link (secondary). The richer {@link io.lievit.kit.AdminAction} header placement
     * (K3) layers on top.
     */
    private List<AdminViewView.HeaderAction> headerActions(String recordId) {
        AdminRoutes routes = routes();
        List<AdminViewView.HeaderAction> actions = new ArrayList<>();
        if (resource.pages().map(ResourcePages::isEditable).orElse(false)) {
            actions.add(AdminViewView.HeaderAction.primary("Edit", routes.edit(recordId)));
        }
        actions.add(AdminViewView.HeaderAction.secondary("Back", routes.list()));
        return actions;
    }

    /** @return the resource this driver serves */
    public Resource<T> resource() {
        return resource;
    }

    /** @return the resource's CRUD routes under the owning panel */
    public AdminRoutes routes() {
        return AdminRoutes.of(panelId, resource);
    }

    /**
     * The outcome of resolving a detail page: the view-model when the record was found and the read
     * authorized, or a not-found / forbidden marker the page renders as the right empty state.
     *
     * @param status the outcome status
     * @param view the resolved view-model when {@link Status#FOUND}, otherwise {@code null}
     */
    public record Resolution(Status status, @Nullable AdminViewView view) {

        /** The outcome of a view resolution. */
        public enum Status {
            /** The record was found and the read authorized: {@link #view()} is present. */
            FOUND,
            /** No record matched the id (or the id was blank). */
            NOT_FOUND,
            /** The principal may not read this record. */
            FORBIDDEN
        }

        /**
         * @param view the resolved view-model
         * @return a found resolution
         */
        public static Resolution found(AdminViewView view) {
            return new Resolution(Status.FOUND, Objects.requireNonNull(view, "view"));
        }

        /** @return a not-found resolution (no record matched) */
        public static Resolution notFound() {
            return new Resolution(Status.NOT_FOUND, null);
        }

        /** @return a forbidden resolution (the principal may not read the record) */
        public static Resolution forbidden() {
            return new Resolution(Status.FORBIDDEN, null);
        }

        /** @return whether a record was found and resolved */
        public boolean isFound() {
            return status == Status.FOUND;
        }
    }
}
