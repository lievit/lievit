/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import dev.lievit.component.LievitEffects;

/**
 * A test harness for admin actions (the Filament {@code testing} helpers: {@code callAction},
 * {@code assertActionExists}, {@code assertActionHalted}), so an adopter can drive an action against
 * a resource without booting the wire. It builds the {@link AdminActionContext}, runs the action,
 * and exposes assertions over the {@link AdminActionResult}.
 *
 * <p>This lives in {@code main} (not {@code test}) so adopters depending on {@code lievit-kit} can
 * use it in their own test sources; it has no JUnit dependency and throws {@link AssertionError} on
 * a failed assertion.
 *
 * @param <T> the resource row type
 */
public final class ActionTester<T> {

    private final Resource<T> resource;
    private final String panelId;
    private final AdminAuthorizer authorizer;

    private ActionTester(Resource<T> resource, String panelId, AdminAuthorizer authorizer) {
        this.resource = Objects.requireNonNull(resource, "resource");
        this.panelId = Objects.requireNonNull(panelId, "panelId");
        this.authorizer = Objects.requireNonNull(authorizer, "authorizer");
    }

    /**
     * @param resource the resource under test
     * @param panelId the owning panel id
     * @param authorizer the authorizer (use {@link AdminAuthorizer#permitAll()} for an open test)
     * @param <T> the row type
     * @return a tester
     */
    public static <T> ActionTester<T> of(
            Resource<T> resource, String panelId, AdminAuthorizer authorizer) {
        return new ActionTester<>(resource, panelId, authorizer);
    }

    /**
     * Asserts a registry holds an action under the given placement and name (mirrors
     * {@code assertActionExists}).
     *
     * @param registry the host registry
     * @param placement the placement
     * @param name the action name
     * @return this tester
     */
    public ActionTester<T> assertActionExists(
            ActionRegistry<T> registry, ActionPlacement placement, String name) {
        if (registry.find(placement, name).isEmpty()) {
            throw new AssertionError(
                    "expected a " + placement + " action named '" + name + "' but none was registered");
        }
        return this;
    }

    /**
     * Runs a single-record action and returns its result (mirrors {@code callAction}).
     *
     * @param action the action to run
     * @param recordId the targeted record id, or {@code null} for a resource-scoped action
     * @param formState the submitted form state (empty for actions with no form)
     * @return the action result
     */
    public AdminActionResult callAction(
            AdminAction<T> action, @Nullable String recordId, Map<String, String> formState) {
        AdminActionContext<T> context =
                new AdminActionContext<>(
                        resource,
                        AdminRoutes.of(panelId, resource),
                        authorizer,
                        LievitEffects.capturing(),
                        recordId,
                        formState);
        return action.run(context);
    }

    /**
     * Runs an action with no form against a record.
     *
     * @param action the action
     * @param recordId the record id
     * @return the result
     */
    public AdminActionResult callAction(AdminAction<T> action, @Nullable String recordId) {
        return callAction(action, recordId, Map.of());
    }

    /**
     * Asserts the result is not completed (the action halted: forbidden or invalid), mirroring
     * {@code assertActionHalted}.
     *
     * @param result the action result
     * @return this tester
     */
    public ActionTester<T> assertActionHalted(AdminActionResult result) {
        if (result.isCompleted()) {
            throw new AssertionError("expected the action to halt but it completed");
        }
        return this;
    }

    /**
     * Asserts the result completed.
     *
     * @param result the action result
     * @return this tester
     */
    public ActionTester<T> assertActionCompleted(AdminActionResult result) {
        if (!result.isCompleted()) {
            throw new AssertionError("expected the action to complete but it was " + result.status());
        }
        return this;
    }

    /**
     * Runs a bulk action over a selection and returns the counts.
     *
     * @param action the bulk action
     * @param selectedIds the selected record ids
     * @return the bulk result
     */
    public BulkActionResult callBulkAction(BulkAction<T> action, java.util.List<String> selectedIds) {
        BulkActionContext<T> context =
                new BulkActionContext<>(
                        resource,
                        AdminRoutes.of(panelId, resource),
                        authorizer,
                        LievitEffects.capturing(),
                        selectedIds);
        return action.runBulk(context);
    }
}
