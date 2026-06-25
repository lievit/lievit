/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.cluster;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import dev.lievit.kit.Panel;
import dev.lievit.kit.RecordRepository;
import dev.lievit.kit.Resource;
import dev.lievit.kit.Table;

/**
 * Specifies clusters (the Filament {@code Cluster}): child routing under a shared prefix
 * ({@code prependClusterSlug}), the in-cluster sub-navigation ({@code getSubNavigation}), the
 * cluster-level access gate ({@code canAccessClusteredComponents}), and registration on a panel.
 */
class ClusterTest {

    record Row(String id) {}

    private Resource<Row> resource(String slug, String label) {
        return new Resource<>(emptyRepo()) {
            @Override
            public String slug() {
                return slug;
            }

            @Override
            public String label() {
                return label;
            }

            @Override
            public Table<Row> table() {
                return Table.<Row>create().id(Row::id).column("Id", Row::id);
            }
        };
    }

    /**
     * @spec.given a "settings" cluster holding a users and a roles resource
     * @spec.when  child routes are computed under a panel path
     * @spec.then  each child route is prefixed with the cluster slug
     */
    @Test
    void it_prefixes_child_routes_with_the_cluster_slug() {
        Cluster cluster =
                Cluster.create("settings", "Settings")
                        .resource(resource("users", "Users"))
                        .resource(resource("roles", "Roles"));

        assertThat(cluster.prependClusterSlug("admin", "users")).isEqualTo("/admin/settings/users");
        assertThat(cluster.prependClusterSlug("admin", "roles")).isEqualTo("/admin/settings/roles");
    }

    /**
     * @spec.given a cluster with two child resources
     * @spec.when  the sub-navigation is built
     * @spec.then  it lists one item per child at its clustered route
     */
    @Test
    void it_builds_the_sub_navigation() {
        Cluster cluster =
                Cluster.create("settings", "Settings")
                        .resource(resource("users", "Users"))
                        .resource(resource("roles", "Roles"));

        assertThat(cluster.subNavigation("admin"))
                .extracting(item -> item.label() + " -> " + item.url())
                .containsExactly("Users -> /admin/settings/users", "Roles -> /admin/settings/roles");
    }

    /**
     * @spec.given a cluster with an access gate that only admits a non-null principal
     * @spec.when  the gate is checked
     * @spec.then  the gate decides cluster access before any child authorization
     */
    @Test
    void the_access_gate_guards_the_whole_cluster() {
        Cluster cluster =
                Cluster.create("settings", "Settings").accessGate(principal -> principal != null);

        assertThat(cluster.canAccessClusteredComponents("admin-user")).isTrue();
        assertThat(cluster.canAccessClusteredComponents(null)).isFalse();
    }

    /**
     * @spec.given a panel
     * @spec.when  a cluster is registered on it
     * @spec.then  the panel exposes the cluster
     */
    @Test
    void a_panel_registers_clusters() {
        Cluster cluster = Cluster.create("settings", "Settings");
        Panel panel = Panel.create("admin").cluster(cluster);

        assertThat(panel.clusters()).containsExactly(cluster);
    }

    private static RecordRepository<Row> emptyRepo() {
        return new RecordRepository<>() {
            @Override
            public Page<Row> page(Query query) {
                return Page.of(List.of(), 0);
            }

            @Override
            public Optional<Row> findById(String id) {
                return Optional.empty();
            }

            @Override
            public Row create(Row record) {
                return record;
            }

            @Override
            public Row update(String id, Row record) {
                return record;
            }

            @Override
            public void delete(String id) {}
        };
    }
}
