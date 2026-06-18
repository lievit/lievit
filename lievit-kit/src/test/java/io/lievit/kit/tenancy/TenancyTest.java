/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.tenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import io.lievit.kit.RecordRepository;

/**
 * Specifies multi-tenancy (the Filament {@code HasTenancy}): tenant resolution from the url with a
 * default fallback, the {@code canAccessTenant} membership gate, per-resource query scoping that
 * isolates one tenant's records (read, create-stamping, and cross-tenant write refusal), and the
 * tenant-switcher menu.
 */
class TenancyTest {

    static final class Doc {
        final String id;
        String tenantId;

        Doc(String id, String tenantId) {
            this.id = id;
            this.tenantId = tenantId;
        }
    }

    private static final Tenant ACME = Tenant.of("acme", "Acme Inc");
    private static final Tenant GLOBEX = Tenant.of("globex", "Globex");

    /**
     * @spec.given a principal belonging to two tenants and a url naming the second
     * @spec.when  the tenant context is resolved
     * @spec.then  the named, accessible tenant is the active one
     */
    @Test
    void it_resolves_the_requested_accessible_tenant() {
        HasTenants principal = () -> List.of(ACME, GLOBEX);

        Optional<TenantContext> ctx = TenantContext.resolve(principal, "globex");

        assertThat(ctx).isPresent();
        assertThat(ctx.get().tenant()).isEqualTo(GLOBEX);
    }

    /**
     * @spec.given a principal asked for a tenant it does not belong to
     * @spec.when  the tenant context is resolved
     * @spec.then  it falls back to the default tenant (a url cannot grant access membership denies)
     */
    @Test
    void an_inaccessible_url_tenant_falls_back_to_the_default() {
        HasTenants principal = () -> List.of(ACME);

        Optional<TenantContext> ctx = TenantContext.resolve(principal, "globex");

        assertThat(ctx).get().extracting(TenantContext::tenant).isEqualTo(ACME);
        assertThat(principal.canAccessTenant(GLOBEX)).isFalse();
        assertThat(principal.canAccessTenant(ACME)).isTrue();
    }

    /**
     * @spec.given a repository of docs across two tenants, scoped to one
     * @spec.when  the scoped repository pages and looks up by id
     * @spec.then  only the active tenant's docs are visible, even another tenant's doc by its id
     */
    @Test
    void scoping_isolates_a_tenants_records() {
        InMemoryDocs repo = new InMemoryDocs();
        repo.create(new Doc("1", "acme"));
        repo.create(new Doc("2", "globex"));
        TenantScope<Doc> scope =
                TenantScope.of((doc, t) -> doc.tenantId.equals(t.id()), (doc, t) -> doc.tenantId = t.id());

        RecordRepository<Doc> scoped = scope.scope(repo, ACME);

        assertThat(scoped.findAll()).extracting(d -> d.id).containsExactly("1");
        assertThat(scoped.findById("2")).isEmpty();
        assertThat(scoped.page(RecordRepository.Query.of(0, 10)).total()).isEqualTo(1);
    }

    /**
     * @spec.given a tenant-scoped repository
     * @spec.when  a record is created
     * @spec.then  the active tenant is stamped onto it before persistence
     */
    @Test
    void create_stamps_the_active_tenant() {
        InMemoryDocs repo = new InMemoryDocs();
        TenantScope<Doc> scope =
                TenantScope.of((doc, t) -> doc.tenantId.equals(t.id()), (doc, t) -> doc.tenantId = t.id());

        scope.scope(repo, GLOBEX).create(new Doc("9", "unset"));

        assertThat(repo.findById("9")).get().extracting(d -> d.tenantId).isEqualTo("globex");
    }

    /**
     * @spec.given a doc owned by another tenant
     * @spec.when  the active tenant's scope tries to update it
     * @spec.then  the write is refused (the cross-tenant isolation guarantee)
     */
    @Test
    void scoping_refuses_a_cross_tenant_write() {
        InMemoryDocs repo = new InMemoryDocs();
        repo.create(new Doc("1", "globex"));
        TenantScope<Doc> scope =
                TenantScope.of((doc, t) -> doc.tenantId.equals(t.id()), (doc, t) -> doc.tenantId = t.id());

        assertThatThrownBy(() -> scope.scope(repo, ACME).update("1", new Doc("1", "acme")))
                .isInstanceOf(IllegalStateException.class);
        // The delete of a non-owned row is a silent no-op (the row is invisible to this tenant).
        scope.scope(repo, ACME).delete("1");
        assertThat(repo.findById("1")).isPresent();
    }

    /**
     * @spec.given tenancy enabled and a principal with two tenants
     * @spec.when  the switcher is built for the active tenant
     * @spec.then  it offers a choice, marks the active entry, and routes per tenant slug
     */
    @Test
    void the_switcher_lists_the_tenants_and_marks_the_active() {
        Tenancy tenancy = Tenancy.enabled();
        HasTenants principal = () -> List.of(ACME, GLOBEX);

        TenantMenu menu = tenancy.switcher("app", principal, ACME);

        assertThat(menu.hasChoice()).isTrue();
        assertThat(menu.label()).isEqualTo("Acme Inc");
        assertThat(menu.entries())
                .anySatisfy(
                        e -> {
                            assertThat(e.tenantId()).isEqualTo("acme");
                            assertThat(e.active()).isTrue();
                            assertThat(e.url()).isEqualTo("/app/acme");
                        })
                .anySatisfy(e -> assertThat(e.url()).isEqualTo("/app/globex"));
    }

    static final class InMemoryDocs implements RecordRepository<Doc> {
        private final List<Doc> docs = new ArrayList<>();

        @Override
        public Page<Doc> page(Query query) {
            return Page.of(docs, docs.size());
        }

        @Override
        public Optional<Doc> findById(String id) {
            return docs.stream().filter(d -> d.id.equals(id)).findFirst();
        }

        @Override
        public Doc create(Doc record) {
            docs.add(record);
            return record;
        }

        @Override
        public Doc update(String id, Doc record) {
            return record;
        }

        @Override
        public void delete(String id) {
            docs.removeIf(d -> d.id.equals(id));
        }

        @Override
        public List<Doc> findAll() {
            return List.copyOf(docs);
        }
    }
}
