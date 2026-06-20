/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

/**
 * Specifies {@link PolicyAdminAuthorizer}: the per-verb policy map that completes the audit's coarse
 * authorizer gap. Each {@link AdminOperation} (the Laravel-Policy ability set) carries its own rule;
 * an unmapped verb is denied (default-deny); restore and force-delete are independent of update and
 * delete, so a policy can grant one ability without leaking another.
 */
class PolicyAdminAuthorizerTest {

    static final class StringRepo implements RecordRepository<String> {
        @Override
        public Page<String> page(Query query) {
            return Page.of(List.of(), 0);
        }

        @Override
        public Optional<String> findById(String id) {
            return Optional.empty();
        }

        @Override
        public String create(String record) {
            return record;
        }

        @Override
        public String update(String id, String record) {
            return record;
        }

        @Override
        public void delete(String id) {}
    }

    static Resource<String> resource() {
        return new Resource<>(new StringRepo()) {
            @Override
            public String slug() {
                return "strings";
            }

            @Override
            public String label() {
                return "Strings";
            }

            @Override
            public Table<String> table() {
                return Table.<String>create().column("Value", s -> s);
            }
        };
    }

    private static PolicyAdminAuthorizer.Builder builderWithPrincipal(Object principal) {
        return PolicyAdminAuthorizer.builder().principalSupplier(() -> principal);
    }

    /**
     * @spec.given a policy map that maps no rule for any verb
     * @spec.when  every CRUD verb is checked
     * @spec.then  all are denied (default-deny: an unmapped ability is forbidden, the secure posture)
     */
    @Test
    void an_unmapped_verb_is_denied_by_default() {
        PolicyAdminAuthorizer authorizer = builderWithPrincipal("alice").build();

        for (AdminOperation op : AdminOperation.values()) {
            assertThat(authorizer.isAllowed(op, resource(), "1")).as(op.name()).isFalse();
            assertThat(authorizer.hasRule(op)).as(op.name()).isFalse();
        }
    }

    /**
     * @spec.given a policy that allows VIEW_LIST + UPDATE but maps nothing for DELETE/RESTORE/
     *     FORCE_DELETE/REORDER/CREATE
     * @spec.when  each verb is checked
     * @spec.then  view + update are allowed while the others are denied, proving the map grants each
     *     ability independently (not one coarse seam)
     */
    @Test
    void grants_each_verb_independently() {
        PolicyAdminAuthorizer authorizer =
                builderWithPrincipal("alice")
                        .allow(AdminOperation.VIEW_LIST)
                        .allow(AdminOperation.UPDATE)
                        .build();

        assertThat(authorizer.isAllowed(AdminOperation.VIEW_LIST, resource(), null)).isTrue();
        assertThat(authorizer.isAllowed(AdminOperation.UPDATE, resource(), "1")).isTrue();
        assertThat(authorizer.isAllowed(AdminOperation.CREATE, resource(), null)).isFalse();
        assertThat(authorizer.isAllowed(AdminOperation.DELETE, resource(), "1")).isFalse();
        assertThat(authorizer.isAllowed(AdminOperation.RESTORE, resource(), "1")).isFalse();
        assertThat(authorizer.isAllowed(AdminOperation.FORCE_DELETE, resource(), "1")).isFalse();
        assertThat(authorizer.isAllowed(AdminOperation.REORDER, resource(), null)).isFalse();
    }

    /**
     * @spec.given a policy granting DELETE but NOT FORCE_DELETE, and RESTORE but NOT UPDATE
     * @spec.when  the four soft-delete-family verbs are checked
     * @spec.then  delete + restore pass while force-delete + update are denied: restore is not update
     *     and force-delete is not delete (the precise verb split this work introduced)
     */
    @Test
    void restore_and_force_delete_are_distinct_from_update_and_delete() {
        PolicyAdminAuthorizer authorizer =
                builderWithPrincipal("alice")
                        .allow(AdminOperation.DELETE)
                        .allow(AdminOperation.RESTORE)
                        .build();

        assertThat(authorizer.isAllowed(AdminOperation.DELETE, resource(), "1")).isTrue();
        assertThat(authorizer.isAllowed(AdminOperation.RESTORE, resource(), "1")).isTrue();
        assertThat(authorizer.isAllowed(AdminOperation.FORCE_DELETE, resource(), "1")).isFalse();
        assertThat(authorizer.isAllowed(AdminOperation.UPDATE, resource(), "1")).isFalse();
    }

    /**
     * @spec.given a record-scoped UPDATE rule that allows only the record whose value the principal
     *     owns
     * @spec.when  the rule is checked against an owned record and a foreign one
     * @spec.then  the owned record passes and the foreign one is denied, proving the rule receives the
     *     concrete (principal, resource, record) triple for row-level checks
     */
    @Test
    void a_rule_can_make_a_record_level_decision() {
        PolicyAdminAuthorizer authorizer =
                builderWithPrincipal("alice")
                        .rule(
                                AdminOperation.UPDATE,
                                (principal, res, record) -> ("owned-by-" + principal).equals(record))
                        .build();

        assertThat(authorizer.isAllowed(AdminOperation.UPDATE, resource(), "owned-by-alice")).isTrue();
        assertThat(authorizer.isAllowed(AdminOperation.UPDATE, resource(), "owned-by-bob")).isFalse();
    }

    /**
     * @spec.given an {@code allowAuthenticated} rule and a null (anonymous) principal
     * @spec.when  the verb is checked anonymously then as a logged-in principal
     * @spec.then  the anonymous check is denied and the authenticated one is allowed
     */
    @Test
    void allow_authenticated_denies_an_anonymous_principal() {
        PolicyAdminAuthorizer anon =
                builderWithPrincipal(null).allowAuthenticated(AdminOperation.VIEW_LIST).build();
        PolicyAdminAuthorizer loggedIn =
                builderWithPrincipal("alice").allowAuthenticated(AdminOperation.VIEW_LIST).build();

        assertThat(anon.isAllowed(AdminOperation.VIEW_LIST, resource(), null)).isFalse();
        assertThat(loggedIn.isAllowed(AdminOperation.VIEW_LIST, resource(), null)).isTrue();
    }

    /**
     * @spec.given a built authorizer and a builder mutated AFTER the build
     * @spec.when  the later-added rule's verb is checked on the already-built authorizer
     * @spec.then  it stays denied, proving build() snapshots the map (no leak)
     */
    @Test
    void build_snapshots_the_map() {
        PolicyAdminAuthorizer.Builder builder =
                builderWithPrincipal("alice").allow(AdminOperation.VIEW_LIST);
        PolicyAdminAuthorizer authorizer = builder.build();

        builder.allow(AdminOperation.DELETE);

        assertThat(authorizer.isAllowed(AdminOperation.DELETE, resource(), "1")).isFalse();
    }
}
