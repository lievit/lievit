/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring.validation;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import com.iambilotta.lievit.LievitAction;
import com.iambilotta.lievit.LievitComponent;
import com.iambilotta.lievit.Wire;

/**
 * Test component for the real-time validation integration test. A registration form: the user types
 * an email and a name; the server validates live via {@code l:model.live} / {@code l:model.blur};
 * errors appear under the field before a full submit.
 */
@LievitComponent(template = "registration")
public class RegistrationComponent {

    @Wire
    @NotBlank(message = "Email is required")
    @Email(message = "Must be a valid email address")
    String email = "";

    @Wire
    @NotBlank(message = "Name is required")
    @Size(min = 2, message = "Name must be at least 2 characters")
    String name = "";

    /** Whether the form was successfully submitted (set only when validation passes). */
    @Wire boolean submitted = false;

    @LievitAction
    void submit() {
        this.submitted = true;
    }
}
