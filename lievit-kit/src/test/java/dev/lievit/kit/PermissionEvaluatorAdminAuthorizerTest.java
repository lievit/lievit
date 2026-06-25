/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.Serializable;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Specifies {@link PermissionEvaluatorAdminAuthorizer}: the kit's per-resource / per-record policy
 * check via Spring Security's {@link PermissionEvaluator} SPI (ADR-0053, issue #57). It maps each
 * {@link AdminOperation} to a permission name, routes a record-scoped op to the object form and a
 * resource-scoped op to the id/type form, and denies when no principal is authenticated.
 */
class PermissionEvaluatorAdminAuthorizerTest {

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
                return "immobili";
            }

            @Override
            public String label() {
                return "Immobili";
            }

            @Override
            public Table<String> table() {
                return Table.<String>create().column("Value", s -> s);
            }
        };
    }

    /** Records the arguments the evaluator was called with, returns a fixed verdict. */
    static final class RecordingEvaluator implements PermissionEvaluator {
        private final boolean verdict;
        Object objectTarget;
        Serializable idTarget;
        String type;
        Object permission;

        RecordingEvaluator(boolean verdict) {
            this.verdict = verdict;
        }

        @Override
        public boolean hasPermission(
                Authentication authentication, Object targetDomainObject, Object permission) {
            this.objectTarget = targetDomainObject;
            this.permission = permission;
            return verdict;
        }

        @Override
        public boolean hasPermission(
                Authentication authentication,
                Serializable targetId,
                String targetType,
                Object permission) {
            this.idTarget = targetId;
            this.type = targetType;
            this.permission = permission;
            return verdict;
        }
    }

    private void authenticate() {
        Authentication auth =
                new UsernamePasswordAuthenticationToken(
                        "agent", "x", AuthorityUtils.createAuthorityList("ROLE_USER"));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    /**
     * @spec.given an authenticated user and an evaluator that grants
     * @spec.when  a record-scoped UPDATE is checked against a concrete record
     * @spec.then  the object form of the SPI runs with the record and the "update" permission, allow
     * @spec.us    US-057-action-authorization
     */
    @Test
    void record_scoped_update_uses_the_object_form() {
        authenticate();
        RecordingEvaluator evaluator = new RecordingEvaluator(true);
        PermissionEvaluatorAdminAuthorizer authorizer =
                new PermissionEvaluatorAdminAuthorizer(evaluator);
        boolean allowed = authorizer.isAllowed(AdminOperation.UPDATE, resource(), "record-1");
        assertThat(allowed).isTrue();
        assertThat(evaluator.objectTarget).isEqualTo("record-1");
        assertThat(evaluator.permission).isEqualTo("update");
    }

    /**
     * @spec.given an authenticated user and an evaluator that grants
     * @spec.when  a resource-scoped CREATE is checked (no record)
     * @spec.then  the id/type form runs with the resource slug and the "create" permission, allow
     * @spec.us    US-057-action-authorization
     */
    @Test
    void resource_scoped_create_uses_the_id_type_form() {
        authenticate();
        RecordingEvaluator evaluator = new RecordingEvaluator(true);
        PermissionEvaluatorAdminAuthorizer authorizer =
                new PermissionEvaluatorAdminAuthorizer(evaluator);
        boolean allowed = authorizer.isAllowed(AdminOperation.CREATE, resource(), null);
        assertThat(allowed).isTrue();
        assertThat(evaluator.idTarget).isEqualTo("immobili");
        assertThat(evaluator.type).isEqualTo("immobili");
        assertThat(evaluator.permission).isEqualTo("create");
    }

    /**
     * @spec.given an evaluator that denies
     * @spec.when  any operation is checked for an authenticated user
     * @spec.then  the authorizer denies (deny-by-default once the policy is wired)
     * @spec.us    US-057-action-authorization
     */
    @Test
    void denies_when_the_evaluator_denies() {
        authenticate();
        PermissionEvaluatorAdminAuthorizer authorizer =
                new PermissionEvaluatorAdminAuthorizer(new RecordingEvaluator(false));
        assertThat(authorizer.isAllowed(AdminOperation.DELETE, resource(), "record-1")).isFalse();
    }

    /**
     * @spec.given no authenticated principal in the security context
     * @spec.when  an operation is checked
     * @spec.then  the authorizer denies without consulting the evaluator (the write boundary is closed)
     * @spec.us    US-057-action-authorization
     */
    @Test
    void denies_when_unauthenticated() {
        RecordingEvaluator evaluator = new RecordingEvaluator(true);
        PermissionEvaluatorAdminAuthorizer authorizer =
                new PermissionEvaluatorAdminAuthorizer(evaluator);
        assertThat(authorizer.isAllowed(AdminOperation.VIEW_LIST, resource(), null)).isFalse();
        // The evaluator was never consulted.
        assertThat(evaluator.permission).isNull();
    }
}
