/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

import dev.lievit.kit.ActionGroup;
import dev.lievit.kit.ActionPlacement;
import dev.lievit.kit.AdminAction;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * The render-time bundle the kit action cluster template ({@code kit/action/group.jte}) reads: a
 * placement's flat {@link AdminAction actions} and optional {@link ActionGroup} PLUS the render-only
 * facts that depend on the current request / row and the pure action model deliberately does not
 * carry, mirroring {@link KitTableView} for the table chrome:
 *
 * <ul>
 *   <li>the {@link #placement() placement} (HEADER / ROW / BULK) the cluster lays out for;
 *   <li>the host {@link #record() record} (or {@code null} for a header-scoped cluster) the actions
 *       resolve their per-record url + visibility against;
 *   <li>the {@link #recordId() row id} the wire / confirm actions carry as the SAFE escaped {@code id}
 *       argument (the button partial's {@code wireArgs} channel);
 *   <li>the {@link #modalPrefix() per-action modal-id prefix} a confirmed action's trigger opens
 *       (paired with {@code kit/action/modal.jte}, which renders that {@code <dialog>} under
 *       {@code modalPrefix + action.name()}), so the invoker and the dialog agree on the id;
 *   <li>the optional {@link #dropdownId() dropdown panel id} the {@code ⋮} {@link ActionGroup} opens.
 * </ul>
 *
 * <p>This split keeps the action model pure (testable from the builders alone) while giving the
 * template ONE typed object carrying every render-time fact the cluster needs. A host builds it with
 * {@link #of(List, ActionPlacement)} and layers on the row-specific facts through the withers, exactly
 * as a host decorates a {@link KitTableView}. {@link KitActionComponent} derives the defaults from a
 * resource's routes.
 *
 * @param actions the flat actions for this placement, in declaration order
 * @param group the optional action group folded into a {@code ⋮} dropdown, or {@code null}
 * @param placement the placement the cluster lays out for
 * @param record the host record the actions resolve against, or {@code null} for header scope
 * @param recordId the row id carried into wire / confirm actions as the SAFE {@code id} arg, or {@code ""}
 * @param modalPrefix the per-action {@code <dialog>} id prefix for confirmed actions
 * @param dropdownId the {@code ⋮} dropdown panel id, or {@code ""} to let the template derive it
 */
public record KitActionView(
        List<? extends AdminAction<?>> actions,
        @Nullable ActionGroup<?> group,
        ActionPlacement placement,
        @Nullable Object record,
        String recordId,
        String modalPrefix,
        String dropdownId) {

    /** Compact constructor: defends the action list + the never-null tokens. */
    public KitActionView {
        actions = List.copyOf(actions);
        placement = placement == null ? ActionPlacement.ROW : placement;
        recordId = recordId == null ? "" : recordId;
        modalPrefix = modalPrefix == null || modalPrefix.isBlank() ? "lv-action-" : modalPrefix;
        dropdownId = dropdownId == null ? "" : dropdownId;
    }

    /**
     * The minimal bundle: the flat actions for a placement, no group, no record, the default modal
     * prefix, a template-derived dropdown id. The host layers the rest on with the withers.
     *
     * @param actions the flat actions
     * @param placement the placement
     * @return the bundle
     */
    public static KitActionView of(List<? extends AdminAction<?>> actions, ActionPlacement placement) {
        return new KitActionView(actions, null, placement, null, "", "lv-action-", "");
    }

    /**
     * @param group the action group folded into the {@code ⋮} dropdown
     * @return a copy carrying the dropdown group
     */
    public KitActionView withGroup(ActionGroup<?> group) {
        return new KitActionView(
                actions, group, placement, record, recordId, modalPrefix, dropdownId);
    }

    /**
     * Binds the cluster to one row: the record the actions resolve against + the SAFE id they carry.
     *
     * @param record the host record (or {@code null})
     * @param recordId the row id for the wire / confirm {@code id} argument
     * @return a copy bound to that row
     */
    public KitActionView forRecord(@Nullable Object record, String recordId) {
        return new KitActionView(
                actions, group, placement, record,
                Objects.requireNonNull(recordId, "recordId"), modalPrefix, dropdownId);
    }

    /**
     * @param prefix the per-action {@code <dialog>} id prefix for confirmed actions
     * @return a copy carrying the modal-id prefix
     */
    public KitActionView withModalPrefix(String prefix) {
        return new KitActionView(
                actions, group, placement, record, recordId,
                Objects.requireNonNull(prefix, "prefix"), dropdownId);
    }

    /**
     * @param id the {@code ⋮} dropdown panel id
     * @return a copy carrying the dropdown id
     */
    public KitActionView withDropdownId(String id) {
        return new KitActionView(
                actions, group, placement, record, recordId, modalPrefix,
                Objects.requireNonNull(id, "id"));
    }

    /** @return whether a {@code ⋮} dropdown group renders */
    public boolean hasGroup() {
        return group != null;
    }

    /** @return whether this cluster is bound to a concrete row (a non-blank record id) */
    public boolean hasRecordId() {
        return !recordId.isBlank();
    }

    /**
     * The {@code <dialog>} id a confirmed action's trigger opens (and the matching
     * {@code kit/action/modal.jte} renders the dialog under): {@link #modalPrefix} + the action name.
     *
     * @param actionName the confirmed action's name
     * @return the modal id for that action in this cluster
     */
    public String modalIdFor(String actionName) {
        return modalPrefix + Objects.requireNonNull(actionName, "actionName");
    }
}
