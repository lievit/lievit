/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;

import org.jspecify.annotations.Nullable;
import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * The {@link AdminAuthorizer} that delegates every per-action / per-record check to Spring Security's
 * {@link PermissionEvaluator} SPI (ADR-0053, issue #57): the kit Resource thereby gets an automatic
 * per-resource policy check on each operation (view / create / update / delete), the Filament
 * {@code HasAuthorization} / Laravel-Policy analog. Wiring this authorizer is how an adopter turns the
 * kit's write boundary from "permit all" (the v0.1 default) into "deny unless the policy grants it".
 *
 * <p>Each {@link AdminOperation} maps to a permission name (the {@code permission} argument the host's
 * {@code PermissionEvaluator} matches), one per Laravel-Policy ability: {@code VIEW_LIST -> "view"},
 * {@code CREATE -> "create"}, {@code UPDATE -> "update"}, {@code DELETE -> "delete"},
 * {@code RESTORE -> "restore"}, {@code FORCE_DELETE -> "forceDelete"}, {@code REORDER -> "reorder"}.
 * The target depends on scope:
 *
 * <ul>
 *   <li><strong>Record-scoped</strong> (a non-null {@code record}, the edit / delete of a specific
 *       row): the object form {@code hasPermission(auth, record, permission)} runs, so the host's
 *       evaluator can do row-level checks ("is this the agent's own listing?").
 *   <li><strong>Resource-scoped</strong> (a null {@code record}, the list / create): the id-based
 *       form {@code hasPermission(auth, resourceSlug, targetType, permission)} runs, with the
 *       resource's {@code slug()} as both the id and the type, so the evaluator can grant "create on
 *       the immobili resource" without a record in hand.
 * </ul>
 *
 * <p><strong>Deny-by-default applies only when this authorizer is wired</strong> (the secure
 * convention). Absent it, the kit keeps {@link AdminAuthorizer#permitAll()} (the backward-compatible
 * allow-behavior the existing kit ITs rely on). An unauthenticated principal (no
 * {@link Authentication} in the context) is denied: the kit's write boundary is not reachable without
 * a logged-in user.
 */
public final class PermissionEvaluatorAdminAuthorizer implements AdminAuthorizer {

    private final PermissionEvaluator permissionEvaluator;

    /**
     * @param permissionEvaluator the host's permission evaluator (the same SPI bean
     *     {@code @LievitAuthorize}'s {@code hasPermission(...)} resolves through)
     */
    public PermissionEvaluatorAdminAuthorizer(PermissionEvaluator permissionEvaluator) {
        this.permissionEvaluator =
                Objects.requireNonNull(permissionEvaluator, "permissionEvaluator");
    }

    @Override
    public boolean isAllowed(AdminOperation operation, Resource<?> resource, @Nullable Object record) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            // No authenticated principal: the policy-gated write boundary is closed.
            return false;
        }
        String permission = permissionName(operation);
        if (record != null) {
            // Row-level: authorize against the concrete record (the object form of the SPI).
            return permissionEvaluator.hasPermission(authentication, record, permission);
        }
        // Resource-level: authorize against the resource identity (the id/type form of the SPI).
        return permissionEvaluator.hasPermission(
                authentication, resource.slug(), resource.slug(), permission);
    }

    /** Maps a CRUD operation to the permission name the host's evaluator matches. */
    private static String permissionName(AdminOperation operation) {
        return switch (operation) {
            case VIEW_LIST -> "view";
            case CREATE -> "create";
            case UPDATE -> "update";
            case DELETE -> "delete";
            case RESTORE -> "restore";
            case FORCE_DELETE -> "forceDelete";
            case REORDER -> "reorder";
        };
    }
}
