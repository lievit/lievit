/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.validation;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.Wire;
import io.lievit.component.LievitEffects;

/**
 * Test component for the validation-depth integration test (ADR-0038, #185 / #187). It pairs
 * annotation-declared Bean Validation rules (the canonical per-field rule surface) with an
 * imperative cross-field error the action adds via {@link LievitEffects#addError} (the
 * {@code addError} parity), and proves real-time per-field validation: a live update to one field
 * surfaces only that field's error, not the still-empty neighbours'.
 */
@LievitComponent(template = "registration")
public class SignupComponent {

    @Wire
    @NotBlank(message = "Email is required")
    @Email(message = "Must be a valid email address")
    String email = "";

    @Wire
    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    String password = "";

    @Wire String confirm = "";

    @Wire boolean submitted = false;

    /**
     * Submits the form. Bean Validation has already run (and would have skipped this action on a
     * field-level violation); here we add the cross-field rule Bean Validation cannot express:
     * password and confirmation must match. When it fails we add a custom error and stop.
     */
    @LievitAction
    void submit() {
        if (!password.equals(confirm)) {
            LievitEffects.current().addError("confirm", "Password and confirmation must match");
            return;
        }
        this.submitted = true;
    }
}
