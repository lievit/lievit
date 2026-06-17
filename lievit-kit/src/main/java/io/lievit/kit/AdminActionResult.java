/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.List;

import org.jspecify.annotations.Nullable;

/**
 * The outcome of running an {@link AdminAction}. Three shapes:
 *
 * <ul>
 *   <li><strong>completed</strong>: the action ran (and emitted its flash + redirect effects); the
 *       page component need do nothing more.
 *   <li><strong>invalid</strong>: a save was blocked by submit-time validation; the page re-renders
 *       the form with {@link #errors()} (no redirect).
 *   <li><strong>forbidden</strong>: the {@link AdminAuthorizer} denied the operation; the page shows
 *       a forbidden notice (no write happened).
 * </ul>
 *
 * @param status which of the three shapes this is
 * @param errors the validation errors when {@code status == INVALID}; empty otherwise
 * @param redirect the redirect URL the action emitted (informational; the effect is already queued),
 *     or {@code null}
 */
public record AdminActionResult(Status status, List<FieldError> errors, @Nullable String redirect) {

    /** The three outcome shapes. */
    public enum Status {
        /** The action ran to completion (effects emitted). */
        COMPLETED,
        /** A save was blocked by validation (re-render the form with the errors). */
        INVALID,
        /** The authorizer denied the operation. */
        FORBIDDEN
    }

    /** Compact constructor: defends the error list. */
    public AdminActionResult {
        errors = List.copyOf(errors);
    }

    /**
     * @param redirect the redirect URL emitted on completion
     * @return a completed result
     */
    public static AdminActionResult completed(@Nullable String redirect) {
        return new AdminActionResult(Status.COMPLETED, List.of(), redirect);
    }

    /**
     * @param errors the validation errors that blocked the save (non-empty)
     * @return an invalid result
     */
    public static AdminActionResult invalid(List<FieldError> errors) {
        if (errors.isEmpty()) {
            throw new IllegalArgumentException("an INVALID result must carry at least one error");
        }
        return new AdminActionResult(Status.INVALID, errors, null);
    }

    /**
     * @return a forbidden result
     */
    public static AdminActionResult forbidden() {
        return new AdminActionResult(Status.FORBIDDEN, List.of(), null);
    }

    /** @return whether the action ran to completion */
    public boolean isCompleted() {
        return status == Status.COMPLETED;
    }
}
