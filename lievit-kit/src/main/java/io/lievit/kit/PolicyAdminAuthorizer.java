/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * An {@link AdminAuthorizer} backed by a <strong>per-verb policy map</strong> (the Laravel
 * {@code Policy} / Filament {@code HasAuthorization} analog): one decision rule per
 * {@link AdminOperation}, so a deployment can grant {@code view} + {@code update} while denying
 * {@code delete}, {@code restore}, and {@code forceDelete} independently, instead of collapsing the
 * whole write boundary onto one coarse {@code isAllowed} closure.
 *
 * <p>This is the completion of the audit's "per-verb policy map (AdminOperation is coarse)" gap: a
 * policy is no longer a single seam that must re-branch on the operation by hand; it is a map whose
 * keys are the eight policy abilities ({@code viewAny/view/create/update/delete/restore/forceDelete/
 * reorder}, with {@code view} reusing {@link AdminOperation#VIEW_LIST}). Each rule is a
 * {@link Rule}: a {@code (principal, resource, record) -> boolean} predicate, so it can do both
 * resource-level ("may this user create on this resource?") and record-level ("is this the agent's
 * own listing?") checks.
 *
 * <p><strong>Default-deny</strong>: any verb without a rule is denied (the secure default, matching
 * Filament's deny-unless-granted policy posture). The current principal is read from the host: by
 * default {@link #current()} reads Spring Security's
 * {@code SecurityContextHolder}, but a custom principal supplier can be injected so the authorizer is
 * unit-testable without a security context.
 *
 * <pre>
 *   AdminAuthorizer authz = PolicyAdminAuthorizer.builder()
 *       .allow(AdminOperation.VIEW_LIST)                       // anyone authenticated may read
 *       .rule(AdminOperation.UPDATE, (user, res, rec) -> owns(user, rec))
 *       .rule(AdminOperation.DELETE, (user, res, rec) -> isAdmin(user))
 *       // RESTORE / FORCE_DELETE / REORDER / CREATE left unmapped -> denied
 *       .build();
 * </pre>
 */
public final class PolicyAdminAuthorizer implements AdminAuthorizer {

    /**
     * A single policy rule: decides one ability against the current principal, the targeted
     * resource, and (for a record-scoped verb) the specific record.
     */
    @FunctionalInterface
    public interface Rule {

        /**
         * @param principal the authenticated principal, or {@code null} if anonymous
         * @param resource the resource the operation targets
         * @param record the specific record for a row-scoped verb, or {@code null} for a
         *     resource-scoped one (view list / create)
         * @return {@code true} to allow the ability, {@code false} to deny it
         */
        boolean test(@Nullable Object principal, Resource<?> resource, @Nullable Object record);
    }

    private final Map<AdminOperation, Rule> rules;
    private final java.util.function.Supplier<@Nullable Object> principalSupplier;

    private PolicyAdminAuthorizer(
            Map<AdminOperation, Rule> rules,
            java.util.function.Supplier<@Nullable Object> principalSupplier) {
        this.rules = new EnumMap<>(rules);
        this.principalSupplier = Objects.requireNonNull(principalSupplier, "principalSupplier");
    }

    /**
     * @return a new builder over an empty (default-deny) policy map, reading the principal from
     *     Spring Security
     */
    public static Builder builder() {
        return new Builder();
    }

    @Override
    public boolean isAllowed(AdminOperation operation, Resource<?> resource, @Nullable Object record) {
        Objects.requireNonNull(operation, "operation");
        Objects.requireNonNull(resource, "resource");
        Rule rule = rules.get(operation);
        if (rule == null) {
            // Default-deny: an unmapped verb is forbidden (the secure policy posture).
            return false;
        }
        return rule.test(principalSupplier.get(), resource, record);
    }

    /** @return whether a rule is mapped for the given verb (an unmapped verb is denied) */
    public boolean hasRule(AdminOperation operation) {
        return rules.containsKey(Objects.requireNonNull(operation, "operation"));
    }

    /**
     * Reads the current principal from Spring Security's context, returning {@code null} when there
     * is no authenticated principal. Kept package-default-overridable through the builder's
     * {@code principalSupplier} so a unit test can supply a constant.
     *
     * @return the authenticated principal, or {@code null}
     */
    static @Nullable Object current() {
        var authentication =
                org.springframework.security.core.context.SecurityContextHolder.getContext()
                        .getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        return authentication.getPrincipal();
    }

    /** Fluent builder for a per-verb policy map. */
    public static final class Builder {

        private final Map<AdminOperation, Rule> rules = new EnumMap<>(AdminOperation.class);
        private java.util.function.Supplier<@Nullable Object> principalSupplier =
                PolicyAdminAuthorizer::current;

        private Builder() {}

        /**
         * Maps a decision rule to a verb.
         *
         * @param operation the policy verb
         * @param rule the decision rule
         * @return this builder
         */
        public Builder rule(AdminOperation operation, Rule rule) {
            rules.put(
                    Objects.requireNonNull(operation, "operation"),
                    Objects.requireNonNull(rule, "rule"));
            return this;
        }

        /**
         * Unconditionally allows a verb for any principal (the "permitted ability" shorthand).
         *
         * @param operation the policy verb to allow
         * @return this builder
         */
        public Builder allow(AdminOperation operation) {
            return rule(operation, (principal, resource, record) -> true);
        }

        /**
         * Allows a verb only for an authenticated (non-null) principal.
         *
         * @param operation the policy verb
         * @return this builder
         */
        public Builder allowAuthenticated(AdminOperation operation) {
            return rule(operation, (principal, resource, record) -> principal != null);
        }

        /**
         * Overrides how the current principal is read (the unit-test seam; production reads Spring
         * Security).
         *
         * @param principalSupplier supplies the current principal (or {@code null})
         * @return this builder
         */
        public Builder principalSupplier(
                java.util.function.Supplier<@Nullable Object> principalSupplier) {
            this.principalSupplier = Objects.requireNonNull(principalSupplier, "principalSupplier");
            return this;
        }

        /**
         * @return the built authorizer (a snapshot of the map; later builder mutation does not leak)
         */
        public PolicyAdminAuthorizer build() {
            return new PolicyAdminAuthorizer(rules, principalSupplier);
        }
    }
}
