/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The authorization seam at the action / mount boundary (the load-bearing filament-internals.md
 * lesson: "Authorization belongs at the Resource/Page boundary, not scattered in the view";
 * Filament calls {@code authorizeAccess()} in {@code mount()} on every page).
 *
 * <p>v0.1 ships the <em>seam</em>, not a policy engine: the kit always asks before a write, the host
 * app decides. The default {@link #permitAll()} allows everything (so the skeleton runs); a real
 * deployment supplies a bean that delegates to the host's authorization (Spring Security
 * {@code AuthorizationManager}, a domain policy, an ABAC check). Because the kit funnels every write
 * through here, wiring the host's policy later is a one-bean change, not a scatter-edit across pages.
 *
 * <p>The full per-record policy layer (Filament's {@code HasAuthorization} with row-level gates)
 * lands in a later wave; this interface already accepts the optional record so that layer slots in
 * without a signature break.
 */
@FunctionalInterface
public interface AdminAuthorizer {

    /**
     * Decides whether the current principal may perform {@code operation} on {@code resource},
     * optionally against a specific {@code record}.
     *
     * @param operation the operation about to run
     * @param resource the resource it targets
     * @param record the specific record for a row-scoped operation (edit / delete), or {@code null}
     *     for a resource-scoped one (view list / create)
     * @return {@code true} to allow, {@code false} to deny
     */
    boolean isAllowed(AdminOperation operation, Resource<?> resource, @Nullable Object record);

    /**
     * @return an authorizer that allows every operation (the v0.1 default; a real deployment
     *     replaces it with one bound to the host's authorization)
     */
    static AdminAuthorizer permitAll() {
        return (operation, resource, record) -> true;
    }

    /**
     * Filters a selection of records by per-record authorization for a bulk operation (the Filament
     * {@code getIndividuallyAuthorizedSelectedRecords} seam, issue #327): each record is checked
     * with {@link #isAllowed}; denied records are dropped and counted as failures so the bulk action
     * can report "deleted 8 of 10, 2 were not yours". This is the engine the
     * {@code DeleteBulkAction}-family shares.
     *
     * @param operation the bulk operation (typically {@link AdminOperation#DELETE})
     * @param resource the resource the selection belongs to
     * @param selection the selected records
     * @param <T> the record type
     * @return the authorized subset plus the count of denied records
     */
    default <T> BulkAuthorization<T> filterAuthorized(
            AdminOperation operation, Resource<?> resource, Collection<T> selection) {
        Objects.requireNonNull(operation, "operation");
        Objects.requireNonNull(resource, "resource");
        Objects.requireNonNull(selection, "selection");
        List<T> authorized = new ArrayList<>();
        int denied = 0;
        for (T record : selection) {
            if (isAllowed(operation, resource, record)) {
                authorized.add(record);
            } else {
                denied++;
            }
        }
        return new BulkAuthorization<>(List.copyOf(authorized), denied);
    }

    /**
     * The outcome of {@link #filterAuthorized}: the records the principal may act on, and how many
     * were dropped because they were not authorized.
     *
     * @param authorized the authorized records (a sub-list of the selection, order preserved)
     * @param deniedCount the number of selected records the principal was not authorized for
     * @param <T> the record type
     */
    record BulkAuthorization<T>(List<T> authorized, int deniedCount) {

        /** Compact constructor: defends the authorized list and rejects a negative denied count. */
        public BulkAuthorization {
            authorized = List.copyOf(authorized);
            if (deniedCount < 0) {
                throw new IllegalArgumentException("deniedCount must be >= 0, got: " + deniedCount);
            }
        }

        /** @return whether every selected record was authorized */
        public boolean allAuthorized() {
            return deniedCount == 0;
        }
    }
}
