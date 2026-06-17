/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The built-in delete action: deletes a record through the repository, then flashes a success
 * notification and redirects to the list page (the Filament {@code DeleteAction}, available as a row
 * action on the list and as a header action on the edit page).
 *
 * <p>It is destructive and {@link #requiresConfirmation() requires confirmation}. In v0.1 that is a
 * simple server-confirmed action: the page renders a confirm affordance and only invokes the action
 * once the user confirms (a Lit modal confirmation is deferred to the nested-component wave). The
 * targeted record id rides {@link AdminActionContext#recordId()}.
 */
public final class DeleteAction<T> extends AdminAction<T> {

    /** Builds the delete action (no form; it operates on the record id alone). */
    public DeleteAction() {
        super("delete", "Delete", AdminOperation.DELETE);
    }

    @Override
    public boolean requiresConfirmation() {
        return true;
    }

    @Override
    public boolean isDestructive() {
        return true;
    }

    @Override
    protected AdminActionResult perform(AdminActionContext<T> context) {
        String id = context.recordId();
        if (id == null) {
            throw new IllegalStateException("DeleteAction requires a recordId in the context");
        }
        context.repository().delete(id);
        AdminNotification.success("Deleted.").flashOnto(context.effects());
        String to = context.routes().list();
        context.effects().redirect(to);
        return AdminActionResult.completed(to);
    }
}
