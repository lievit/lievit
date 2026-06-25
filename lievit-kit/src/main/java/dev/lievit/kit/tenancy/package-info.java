/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Multi-tenancy for a panel (the Filament {@code HasTenancy} concern + the tenancy pages), kept an
 * opt-in module rather than baked into {@link dev.lievit.kit.Panel} (the filament-internals.md lesson:
 * tenancy is the single largest panel subsystem; it stays off the core panel's ten concerns and a
 * panel turns it on with one {@link dev.lievit.kit.tenancy.Tenancy} config).
 *
 * <p>The pieces:
 *
 * <ul>
 *   <li>{@link dev.lievit.kit.tenancy.Tenant}: a tenant (id + name + optional slug for the route
 *       prefix).
 *   <li>{@link dev.lievit.kit.tenancy.HasTenants}: the principal-side port the host's user implements
 *       to declare which tenants it belongs to and its default; the {@code canAccessTenant} gate.
 *   <li>{@link dev.lievit.kit.tenancy.TenantScope}: the per-resource query scoping seam, the analogue
 *       of Filament's per-resource tenant global scope; the kit narrows a {@link
 *       dev.lievit.kit.RecordRepository} to the active tenant through it.
 *   <li>{@link dev.lievit.kit.tenancy.TenantContext}: the resolved active tenant for a request, the
 *       analogue of Filament's {@code Filament::getTenant()}.
 *   <li>{@link dev.lievit.kit.tenancy.Tenancy}: the panel config (route prefix or path, the
 *       registration/profile page toggles, the membership provider).
 *   <li>{@link dev.lievit.kit.tenancy.TenantMenu}: the tenant-switcher menu view-model.
 * </ul>
 *
 * <p>As everywhere in the kit, persistence stays the adopter's: the membership list and the
 * per-resource scope predicate are supplied by the host, the kit owns the resolution + switching +
 * gating logic.
 */
@NullMarked
package dev.lievit.kit.tenancy;

import org.jspecify.annotations.NullMarked;
