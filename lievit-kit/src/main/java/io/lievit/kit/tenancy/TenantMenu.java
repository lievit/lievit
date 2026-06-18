/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.tenancy;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * The tenant-switcher view-model (the Filament tenant menu): the label to show on the trigger, and
 * one {@link Entry} per accessible tenant, each carrying the route to switch to it and a flag
 * marking the active one. A panel renders this in the topbar when tenancy is on and the principal
 * belongs to more than one tenant.
 *
 * @param label the trigger label (the configured switcher label or the active tenant's name)
 * @param entries the tenant entries, in the principal's tenant order
 */
public record TenantMenu(String label, List<Entry> entries) {

    /** Compact constructor: defends the entries. */
    public TenantMenu {
        Objects.requireNonNull(label, "label");
        entries = List.copyOf(entries);
    }

    /**
     * Builds the switcher for a principal.
     *
     * @param tenancy the tenancy config (for the label + route building)
     * @param panelPath the panel route prefix
     * @param principal the principal whose tenants populate the menu
     * @param active the active tenant
     * @return the switcher menu
     */
    public static TenantMenu build(
            Tenancy tenancy, String panelPath, HasTenants principal, Tenant active) {
        List<Entry> entries = new ArrayList<>();
        for (Tenant tenant : principal.tenants()) {
            entries.add(
                    new Entry(
                            tenant.id(),
                            tenant.name(),
                            tenancy.prefix(panelPath, tenant),
                            tenant.id().equals(active.id())));
        }
        String label = tenancy.switcherLabel() != null ? tenancy.switcherLabel() : active.name();
        return new TenantMenu(label, entries);
    }

    /** @return whether the menu offers a real choice (more than one tenant) */
    public boolean hasChoice() {
        return entries.size() > 1;
    }

    /**
     * One switcher entry.
     *
     * @param tenantId the tenant id
     * @param name the tenant name
     * @param url the route that switches to this tenant
     * @param active whether this is the active tenant
     */
    public record Entry(String tenantId, String name, String url, boolean active) {

        /** Compact constructor: defends the fields. */
        public Entry {
            Objects.requireNonNull(tenantId, "tenantId");
            Objects.requireNonNull(name, "name");
            Objects.requireNonNull(url, "url");
        }
    }
}
