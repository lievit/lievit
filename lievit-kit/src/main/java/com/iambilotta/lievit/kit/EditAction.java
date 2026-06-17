/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

/**
 * The built-in edit action: validates and persists changes to an existing record through the
 * resource's {@link Form}, then flashes a success notification and redirects to the list page (the
 * Filament {@code EditRecord} {@code getRedirectUrl() -> index} behaviour).
 *
 * <p>The targeted record id rides {@link AdminActionContext#recordId()}. On a validation failure it
 * persists nothing and returns {@link AdminActionResult#invalid} so the edit page re-renders the
 * form with the field errors.
 */
public final class EditAction<T> extends AdminAction<T> {

    private final Form<T> form;

    /**
     * @param form the resource's form (must carry a {@link FormBinder})
     */
    public EditAction(Form<T> form) {
        super("save", "Save", AdminOperation.UPDATE);
        this.form = java.util.Objects.requireNonNull(form, "form");
    }

    @Override
    protected AdminActionResult perform(AdminActionContext<T> context) {
        String id = context.recordId();
        if (id == null) {
            throw new IllegalStateException("EditAction requires a recordId in the context");
        }
        SaveResult<T> result = form.save(context.repository(), id, context.formState());
        if (!result.ok()) {
            return AdminActionResult.invalid(result.errors());
        }
        AdminNotification.success("Saved.").flashOnto(context.effects());
        String to = context.routes().list();
        context.effects().redirect(to);
        return AdminActionResult.completed(to);
    }
}
