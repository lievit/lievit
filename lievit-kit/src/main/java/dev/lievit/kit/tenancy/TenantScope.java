/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.tenancy;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.BiConsumer;
import java.util.function.BiPredicate;

import dev.lievit.kit.RecordRepository;

/**
 * The per-resource tenant scoping seam (the Filament per-resource tenant global scope, made explicit
 * rather than an Eloquent magic-scope): given the active {@link Tenant} and an ownership predicate +
 * stamper supplied by the host, it wraps a resource's {@link RecordRepository} so the kit only ever
 * sees the active tenant's rows.
 *
 * <p>It narrows the four repository operations to the tenant:
 *
 * <ul>
 *   <li><strong>page</strong> / <strong>findById</strong> filter to rows the {@code belongsTo}
 *       predicate accepts for the active tenant (a row of another tenant is invisible, even by id:
 *       the isolation guarantee).
 *   <li><strong>create</strong> stamps the active tenant on the new row via {@code assignTenant}
 *       before delegating, so a created record cannot land in the wrong tenant.
 *   <li><strong>update</strong> / <strong>delete</strong> refuse to touch a row of another tenant.
 * </ul>
 *
 * <p>The kit owns the wrapping + the refusal; the host owns the two host-specific facts (does a row
 * belong to a tenant, and how to stamp a tenant onto a new row), kept off the persistence-agnostic
 * floor.
 *
 * @param <T> the row type
 */
public final class TenantScope<T> {

    private final BiPredicate<T, Tenant> belongsTo;
    private final BiConsumer<T, Tenant> assignTenant;

    private TenantScope(BiPredicate<T, Tenant> belongsTo, BiConsumer<T, Tenant> assignTenant) {
        this.belongsTo = Objects.requireNonNull(belongsTo, "belongsTo");
        this.assignTenant = Objects.requireNonNull(assignTenant, "assignTenant");
    }

    /**
     * Builds a tenant scope.
     *
     * @param belongsTo holds when a row belongs to the given tenant
     * @param assignTenant stamps the given tenant onto a new row (the create path)
     * @param <T> the row type
     * @return the scope
     */
    public static <T> TenantScope<T> of(
            BiPredicate<T, Tenant> belongsTo, BiConsumer<T, Tenant> assignTenant) {
        return new TenantScope<>(belongsTo, assignTenant);
    }

    /**
     * @param row the row
     * @param tenant the active tenant
     * @return whether the row belongs to the tenant
     */
    public boolean belongsTo(T row, Tenant tenant) {
        return belongsTo.test(row, tenant);
    }

    /**
     * Wraps a repository so every operation is confined to the active tenant.
     *
     * @param delegate the underlying repository
     * @param tenant the active tenant
     * @return the tenant-scoped repository
     */
    public RecordRepository<T> scope(RecordRepository<T> delegate, Tenant tenant) {
        Objects.requireNonNull(delegate, "delegate");
        Objects.requireNonNull(tenant, "tenant");
        return new ScopedRepository(delegate, tenant);
    }

    private final class ScopedRepository implements RecordRepository<T> {

        private final RecordRepository<T> delegate;
        private final Tenant tenant;

        ScopedRepository(RecordRepository<T> delegate, Tenant tenant) {
            this.delegate = delegate;
            this.tenant = tenant;
        }

        @Override
        public Page<T> page(Query query) {
            // Filter to the tenant in-memory over the delegate's page. An adopter whose backend
            // can push the tenant predicate into SQL wires a tenant-aware repository directly and
            // skips this wrapper; this is the correct-by-default fallback that holds isolation
            // for any repository.
            List<T> all = delegate.findAll().stream().filter(r -> belongsTo.test(r, tenant)).toList();
            int from = Math.min(query.offset(), all.size());
            int to = Math.min(from + query.limit(), all.size());
            return Page.of(all.subList(from, to), all.size());
        }

        @Override
        public Optional<T> findById(String id) {
            return delegate.findById(id).filter(r -> belongsTo.test(r, tenant));
        }

        @Override
        public T create(T record) {
            assignTenant.accept(record, tenant);
            return delegate.create(record);
        }

        @Override
        public T update(String id, T record) {
            // Refuse to edit a row of another tenant (the row is not visible to this tenant).
            delegate.findById(id)
                    .filter(r -> belongsTo.test(r, tenant))
                    .orElseThrow(() -> new IllegalStateException("record " + id + " is not in tenant " + tenant.id()));
            assignTenant.accept(record, tenant);
            return delegate.update(id, record);
        }

        @Override
        public void delete(String id) {
            delegate.findById(id)
                    .filter(r -> belongsTo.test(r, tenant))
                    .ifPresent(r -> delegate.delete(id));
        }

        @Override
        public List<T> findAll() {
            return delegate.findAll().stream().filter(r -> belongsTo.test(r, tenant)).toList();
        }
    }
}
