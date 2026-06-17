/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.test.dx;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.Wire;
import io.lievit.component.LievitEffects;

/**
 * A fixture admin form for the domain test-DX helpers: it validates {@code email}/{@code name},
 * submits, and flashes a {@code lievit-admin-notify} success toast on a valid save (so
 * {@code assertNotified} / {@code assertHasFormErrors} have something real to read). A second
 * field, {@code vatNumber}, is rendered only when {@code business} is true, so the form-field
 * visibility helpers have a reactive show/hide to assert.
 */
@LievitComponent(template = "dx/admin-form")
public class AdminFormComponent {

    @Wire
    @NotBlank(message = "Email is required")
    @Email(message = "Must be a valid email address")
    String email = "";

    @Wire
    @NotBlank(message = "Name is required")
    String name = "";

    @Wire boolean business = false;

    @Wire String vatNumber = "";

    @LievitAction
    void save() {
        LievitEffects.current()
                .dispatch(
                        "lievit-admin-notify",
                        java.util.Map.of("level", "success", "message", "Saved"));
    }
}
