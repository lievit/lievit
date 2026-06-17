/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The built-in create action: validates and persists a new record through the resource's
 * {@link Form}, then flashes a success notification and redirects to the list page (the Filament
 * {@code CreateRecord} redirect-to-index behaviour).
 *
 * <p>On a validation failure it persists nothing and returns {@link AdminActionResult#invalid} so the
 * create page re-renders the form with the field errors.
 */
public final class CreateAction<T> extends AdminAction<T> {

    private final Form<T> form;

    /**
     * @param form the resource's form (must carry a {@link FormBinder}; a read-only form cannot
     *     create)
     */
    public CreateAction(Form<T> form) {
        super("create", "Create", AdminOperation.CREATE);
        this.form = java.util.Objects.requireNonNull(form, "form");
    }

    @Override
    protected AdminActionResult perform(AdminActionContext<T> context) {
        SaveResult<T> result = form.save(context.repository(), null, context.formState());
        if (!result.ok()) {
            return AdminActionResult.invalid(result.errors());
        }
        AdminNotification.success("Created.").flashOnto(context.effects());
        String to = context.routes().list();
        context.effects().redirect(to);
        return AdminActionResult.completed(to);
    }
}
