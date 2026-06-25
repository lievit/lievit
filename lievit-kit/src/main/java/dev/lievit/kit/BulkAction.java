/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.BiConsumer;

/**
 * An action over the set of selected table rows (the Filament {@code BulkAction} +
 * {@code InteractsWithSelectedRecords}): the selection→authorize→process→report loop all bulk
 * actions share. Each selected id is resolved to a record, gated through the {@link AdminAuthorizer}
 * (denied records are skipped and counted as failures), and handed to {@link #process}; the run
 * reports success/failure counts and, by default, deselects after completion.
 *
 * <p>Reuses {@link AdminAction}'s presentation surface (icon/color/size/variant) but runs over a
 * selection rather than a single record, so it carries its own {@link #runBulk} entry point.
 *
 * @param <T> the resource row type
 */
public class BulkAction<T> extends AdminAction<T> {

    private static final int DEFAULT_CHUNK = 100;

    private final BiConsumer<List<T>, BulkActionContext<T>> body;
    private boolean deselectAfterCompletion = true;
    private int chunkSize = DEFAULT_CHUNK;

    /**
     * @param name the action name
     * @param label the button label
     * @param operation the operation the per-record authorizer gates
     * @param body processes a chunk of authorized records (with the context for effects)
     */
    protected BulkAction(
            String name,
            String label,
            AdminOperation operation,
            BiConsumer<List<T>, BulkActionContext<T>> body) {
        super(name, label, operation);
        this.body = Objects.requireNonNull(body, "body");
    }

    /**
     * Builds a custom bulk action.
     *
     * @param name the action name
     * @param label the button label
     * @param operation the operation gated per record
     * @param body processes a chunk of authorized records
     * @param <T> the row type
     * @return the bulk action
     */
    public static <T> BulkAction<T> make(
            String name,
            String label,
            AdminOperation operation,
            BiConsumer<List<T>, BulkActionContext<T>> body) {
        return new BulkAction<>(name, label, operation, body);
    }

    /**
     * Clears the selection after the action completes (the default).
     *
     * @param value whether to deselect after completion
     * @return this action
     */
    public BulkAction<T> deselectRecordsAfterCompletion(boolean value) {
        this.deselectAfterCompletion = value;
        return this;
    }

    /**
     * Sets the chunk size for iterating a large selection (default {@value #DEFAULT_CHUNK}).
     *
     * @param size the chunk size
     * @return this action
     */
    public BulkAction<T> chunkSelectedRecords(int size) {
        this.chunkSize = size < 1 ? 1 : size;
        return this;
    }

    /** @return whether the selection is cleared after completion */
    public boolean deselectsAfterCompletion() {
        return deselectAfterCompletion;
    }

    /** @return the chunk size for iterating the selection */
    public int chunkSize() {
        return chunkSize;
    }

    /**
     * Runs the action over the selection: resolve each id, gate it per record, process the
     * authorized records in chunks, and report the success/failure counts.
     *
     * @param context the bulk invocation context
     * @return the success/failure counts
     */
    public final BulkActionResult runBulk(BulkActionContext<T> context) {
        Objects.requireNonNull(context, "context");
        List<T> authorized = new ArrayList<>();
        int failed = 0;
        for (String id : context.selectedIds()) {
            T record = context.repository().findById(id).orElse(null);
            if (record == null
                    || !context.authorizer().isAllowed(operation(), context.resource(), record)) {
                failed++;
                continue;
            }
            authorized.add(record);
        }
        for (int from = 0; from < authorized.size(); from += chunkSize) {
            int to = Math.min(from + chunkSize, authorized.size());
            body.accept(new ArrayList<>(authorized.subList(from, to)), context);
        }
        return new BulkActionResult(authorized.size(), failed);
    }

    /**
     * Bulk actions do not run through the single-record {@link AdminAction#run} path; use
     * {@link #runBulk}. This guards against a misuse.
     *
     * @param context unused
     * @return never returns
     */
    @Override
    protected final AdminActionResult perform(AdminActionContext<T> context) {
        throw new UnsupportedOperationException("a BulkAction runs through runBulk(BulkActionContext)");
    }
}
