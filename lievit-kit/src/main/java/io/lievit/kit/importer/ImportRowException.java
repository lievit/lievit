/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.importer;

/**
 * Thrown by {@link ImportColumn#resolve} (or an {@link Importer}'s persist step) to reject a single
 * import row with a human reason. Caught by the import job's allow-failures loop and recorded as a
 * {@link io.lievit.kit.job.JobProgress.FailedRow}; it never aborts the whole import.
 */
public final class ImportRowException extends RuntimeException {

    /**
     * @param reason the human-readable rejection reason, surfaced in the failed-rows report
     */
    public ImportRowException(String reason) {
        super(reason);
    }
}
