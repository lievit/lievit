/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The outcome of a {@link BulkAction} over a selection: how many records succeeded vs how many were
 * skipped (denied by the per-record authorizer or failed), and the overall status derived from the
 * counts (the Filament bulk action success/failure reporting).
 *
 * @param successful the count of records the action processed successfully
 * @param failed the count of records skipped (unauthorized) or that failed
 */
public record BulkActionResult(int successful, int failed) {

    /** Compact constructor: rejects negative counts. */
    public BulkActionResult {
        if (successful < 0 || failed < 0) {
            throw new IllegalArgumentException("counts must be >= 0");
        }
    }

    /** @return the total number of records the action attempted */
    public int total() {
        return successful + failed;
    }

    /** @return whether every attempted record succeeded */
    public boolean isFullSuccess() {
        return failed == 0 && successful > 0;
    }

    /** @return whether no record succeeded */
    public boolean isFullFailure() {
        return successful == 0 && failed > 0;
    }
}
