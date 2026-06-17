/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The built-in view action (the Filament {@code ViewAction}): opens a read-only modal showing a
 * record, authorizing a {@code VIEW} read first. It performs no write; {@link #perform} simply
 * authorizes (the gate runs in {@link AdminAction#run}) and completes, the host opening the modal.
 *
 * <p>It is a {@link #opensModal() modal action} by construction: the host renders the record in a
 * modal rather than navigating. Defaults to a "gray" colour and an eye icon.
 *
 * @param <T> the resource row type
 */
public final class ViewAction<T> extends AdminAction<T> {

    /** Builds the view action. */
    public ViewAction() {
        super("view", "View", AdminOperation.VIEW_LIST);
        icon("heroicon-o-eye");
    }

    /** @return {@code true}: a view action always opens a modal */
    public boolean opensModal() {
        return true;
    }

    @Override
    protected @org.jspecify.annotations.Nullable String defaultColor() {
        return "gray";
    }

    @Override
    protected AdminActionResult perform(AdminActionContext<T> context) {
        // Read-only: the authorization gate already ran in run(); nothing to write.
        return AdminActionResult.completed(null);
    }
}
