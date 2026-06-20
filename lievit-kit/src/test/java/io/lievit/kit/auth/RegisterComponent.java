/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.auth;

import java.util.LinkedHashMap;
import java.util.Map;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitProperty;
import io.lievit.Wire;
import io.lievit.component.LievitEffects;

/** The register auth page wired through the runtime for the render IT. */
@LievitComponent(template = "auth/auth-form")
public class RegisterComponent extends AuthPageComponent {

    @Wire Map<String, String> state = new LinkedHashMap<>();
    @Wire @LievitProperty(serialize = false) AuthFormView view;

    /**
     * @param page the register page, injected by Spring
     */
    public RegisterComponent(RegisterPage page) {
        super(page);
        this.view = initialView();
    }

    /** Validates + delegates the submit; redirects + flashes on success, re-renders on failure. */
    @LievitAction
    void submit() {
        this.view = doSubmit(state, LievitEffects.current());
    }

    @Override
    public AuthFormView view() {
        return view;
    }
}
