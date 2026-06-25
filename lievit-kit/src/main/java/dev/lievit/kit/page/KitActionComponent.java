/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

import dev.lievit.kit.ActionPlacement;
import dev.lievit.kit.AdminAction;
import dev.lievit.kit.AdminRoutes;
import dev.lievit.kit.Resource;
import java.util.List;
import java.util.Objects;

/**
 * The kit-owned, GENERIC render entry for the canonical action clusters ({@code kit/action/group.jte}
 * + {@code kit/action.jte} + {@code kit/action/modal.jte}): the reusable logic a concrete
 * {@code @LievitComponent} (or a plain controller) delegates to in order to render a {@link Resource}'s
 * header / row / bulk actions as the Filament action affordance, instead of hand-assembling the
 * cluster. Mirrors {@link KitTableComponent} for the table chrome.
 *
 * <p>It derives the <em>render-time</em> facts the action templates need and the pure action model
 * deliberately does not carry: the per-action {@code <dialog>} id prefix a confirmed action's trigger
 * opens (rooted at the resource slug so two resources on one page never collide), and the row-scoped
 * dropdown id, both stamped from the resource's {@link AdminRoutes}. A host that needs more layers it
 * on with the {@link KitActionView} withers.
 *
 * <p>Why a separate driver and not a component: the lievit core binds only the {@code @Wire} fields and
 * {@code @LievitAction} methods declared on the component class ITSELF (not inherited), so the kit
 * cannot ship a base {@code @LievitComponent} a resource subclasses. A concrete component declares its
 * own thin wire surface (the action handlers) and delegates the render bundle to this driver, exactly
 * as the list component delegates to {@link ListPageDriver}.
 *
 * @param <T> the resource row type
 */
public final class KitActionComponent<T> {

    private final Resource<T> resource;
    private final AdminRoutes routes;
    private final String modalPrefix;

    /**
     * @param resource the admin resource
     * @param panelId the owning panel id (the route prefix, e.g. {@code "admin"})
     */
    public KitActionComponent(Resource<T> resource, String panelId) {
        this.resource = Objects.requireNonNull(resource, "resource");
        this.routes = AdminRoutes.of(panelId, resource);
        // root the modal id at the resource slug so a page hosting two resources cannot collide.
        this.modalPrefix = "lv-action-" + resource.slug() + "-";
    }

    /**
     * The HEADER cluster: the resource-scoped header actions (Create / Export), no record, the
     * resource's modal-id prefix.
     *
     * @return the header action cluster bundle
     */
    public KitActionView header() {
        return KitActionView.of(resource.headerActions(), ActionPlacement.HEADER)
                .withModalPrefix(modalPrefix)
                .withDropdownId(routes.list() + "#header-actions");
    }

    /**
     * A ROW cluster bound to one record: the given row actions resolve their url + visibility against
     * the record and carry its id into the wire / confirm channel; a confirmed action's trigger opens
     * {@code modalPrefix + record-id + "-" + action.name()} so two rows' modals never share an id.
     *
     * @param rowActions the per-row actions (the host supplies these; the kit's v0.1 resource carries
     *     header actions, a host layers its own row actions)
     * @param record the row record
     * @param recordId the row id
     * @return the row action cluster bundle bound to that row
     */
    public KitActionView row(
            List<? extends AdminAction<?>> rowActions, Object record, String recordId) {
        Objects.requireNonNull(recordId, "recordId");
        return KitActionView.of(rowActions, ActionPlacement.ROW)
                .forRecord(record, recordId)
                // per-row modal prefix so row A's confirm dialog id differs from row B's.
                .withModalPrefix(modalPrefix + recordId + "-")
                .withDropdownId(routes.list() + "#row-" + recordId);
    }

    /** @return the resource this component renders actions for */
    public Resource<T> resource() {
        return resource;
    }

    /** @return the resource's CRUD routes under the owning panel */
    public AdminRoutes routes() {
        return routes;
    }

    /** @return the per-action {@code <dialog>} id prefix rooted at the resource slug */
    public String modalPrefix() {
        return modalPrefix;
    }
}
