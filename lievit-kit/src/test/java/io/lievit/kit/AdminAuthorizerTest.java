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
 * Specifies {@link AdminAuthorizer}: the write-boundary seam. The default {@link
 * AdminAuthorizer#permitAll()} allows everything (so the skeleton runs); a host supplies a bean that
 * denies what its policy forbids, and because every action funnels through here, the denial is one
 * bean away, not a scatter-edit.
 */
class AdminAuthorizerTest {

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

    /**
     * @spec.given the default permit-all authorizer
     * @spec.when  any operation is checked
     * @spec.then  it is allowed (the v0.1 default that lets the skeleton run)
     * @spec.adr   ADR-0008
     */
    @Test
    void permit_all_allows_every_operation() {
        AdminAuthorizer authorizer = AdminAuthorizer.permitAll();

        assertThat(authorizer.isAllowed(AdminOperation.DELETE, resource(), "1")).isTrue();
        assertThat(authorizer.isAllowed(AdminOperation.CREATE, resource(), null)).isTrue();
    }

    /**
     * @spec.given a host authorizer that denies DELETE
     * @spec.when  a delete is checked
     * @spec.then  it is denied while other operations stay allowed (the per-operation gate)
     * @spec.adr   ADR-0008
     */
    @Test
    void a_host_authorizer_can_deny_a_specific_operation() {
        AdminAuthorizer authorizer =
                (operation, resource, record) -> operation != AdminOperation.DELETE;

        assertThat(authorizer.isAllowed(AdminOperation.DELETE, resource(), "1")).isFalse();
        assertThat(authorizer.isAllowed(AdminOperation.UPDATE, resource(), "1")).isTrue();
    }

    /**
     * @spec.given an authorizer that denies deleting records whose value starts with "x" and a mixed
     *     selection
     * @spec.when  the selection is filtered for a bulk DELETE
     * @spec.then  only the authorized records survive and the denied ones are counted (issue #327)
     */
    @Test
    void bulk_filter_keeps_authorized_records_and_counts_denials() {
        AdminAuthorizer authorizer =
                (operation, resource, record) -> !String.valueOf(record).startsWith("x");

        AdminAuthorizer.BulkAuthorization<String> result =
                authorizer.filterAuthorized(
                        AdminOperation.DELETE, resource(), List.of("a", "x1", "b", "x2"));

        assertThat(result.authorized()).containsExactly("a", "b");
        assertThat(result.deniedCount()).isEqualTo(2);
        assertThat(result.allAuthorized()).isFalse();
    }

    /**
     * @spec.given the permit-all authorizer and a selection
     * @spec.when  the selection is filtered for a bulk operation
     * @spec.then  every record survives and the denied count is zero
     */
    @Test
    void bulk_filter_under_permit_all_authorizes_the_whole_selection() {
        AdminAuthorizer.BulkAuthorization<String> result =
                AdminAuthorizer.permitAll()
                        .filterAuthorized(AdminOperation.DELETE, resource(), List.of("a", "b", "c"));

        assertThat(result.authorized()).containsExactly("a", "b", "c");
        assertThat(result.allAuthorized()).isTrue();
    }
}
