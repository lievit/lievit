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

/** The login auth page wired through the runtime for the render IT. */
@LievitComponent(template = "auth/auth-form")
public class LoginComponent extends AuthPageComponent {

    @Wire Map<String, String> state = new LinkedHashMap<>();
    // Server-derived view-model: NOT serialized (the AuthFormView record cannot round-trip the codec).
    @Wire @LievitProperty(serialize = false) AuthFormView view;

    /**
     * @param page the login page, injected by Spring
     */
    public LoginComponent(LoginPage page) {
        super(page);
        this.view = initialView();
    }

    /** Validates + delegates the submit; redirects + flashes on success, re-renders on failure. */
    @LievitAction
    void submit() {
        this.view = doSubmit(state, LievitEffects.current());
    }

    /** @return the current auth-form view-model the template paints */
    public AuthFormView view() {
        return view;
    }
}
