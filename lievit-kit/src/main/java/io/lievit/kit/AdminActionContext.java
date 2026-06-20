/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.component.LievitEffects;

/**
 * Everything an {@link AdminAction} needs to run one invocation, bundled so the action signature
 * stays stable as the kit grows: the resource and its routes, the authorizer, the effects sink to
 * flash + redirect onto, and the per-invocation inputs (the edited record id and the submitted form
 * state).
 *
 * <p>The {@code effects} sink is passed in (not read from {@link LievitEffects#current()}) so an
 * action is unit-testable with a plain sink, off the wire.
 *
 * @param resource the resource the action targets
 * @param routes the resource's CRUD route URLs (redirect targets)
 * @param authorizer the authorization seam (checked before any write)
 * @param effects the per-call effects sink (flash + redirect ride this)
 * @param recordId the id of the record being edited / deleted, or {@code null} for create / list
 * @param formState the submitted form field values (for create / edit), keyed by field name; empty
 *     for delete
 * @param <T> the resource row type
 */
public record AdminActionContext<T>(
        Resource<T> resource,
        AdminRoutes routes,
        AdminAuthorizer authorizer,
        LievitEffects effects,
        @Nullable String recordId,
        Map<String, String> formState) {

    /** Compact constructor: defends the non-null collaborators and copies the state map. */
    public AdminActionContext {
        Objects.requireNonNull(resource, "resource");
        Objects.requireNonNull(routes, "routes");
        Objects.requireNonNull(authorizer, "authorizer");
        Objects.requireNonNull(effects, "effects");
        formState = Map.copyOf(formState);
    }

    /**
     * @return the resource's data port
     */
    public RecordRepository<T> repository() {
        return resource.repository();
    }

    /**
     * Halts the running action (the Filament {@code $action->halt()}): a {@code before()} hook (or
     * the action body) calls this to stop the action without writing or redirecting. It signals via
     * an internal control-flow exception that {@link AdminAction#run} catches, turning the outcome
     * into {@link AdminActionResult#halted()}. The exception never escapes {@code run}.
     */
    public void halt() {
        throw new ActionHalt();
    }

    /**
     * The internal control-flow signal {@link #halt()} raises; {@link AdminAction#run} catches it.
     * Package-private and stackless (no stack trace cost on the hot path).
     */
    static final class ActionHalt extends RuntimeException {
        ActionHalt() {
            super(null, null, false, false);
        }
    }
}
