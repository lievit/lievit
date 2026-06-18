/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.example;

import static io.lievit.test.Lievit.test;

import org.junit.jupiter.api.Test;
import org.springframework.test.context.ActiveProfiles;

import io.lievit.example.auth.RegisterComponent;
import io.lievit.test.LievitTest;
import io.lievit.test.Rejections.LockedProperty;

/**
 * Component tests for {@link RegisterComponent}: validates the registration form
 * logic through the real lievit wire pipeline (ADR-0010).
 */
@LievitTest(classes = GoldenPathApp.class)
@ActiveProfiles("test")
class RegisterComponentTest {

    /**
     * @spec.given a mounted RegisterComponent
     * @spec.when the component is mounted
     * @spec.then the form is rendered with empty fields and no error message
     */
    @Test
    void mounts_with_empty_form_and_no_error() {
        test(RegisterComponent.class)
                .mount()
                .assertWire("username", "")
                .assertWire("error", "")
                .assertWire("redirectTo", "")
                .assertSee("data-lievit-component");
    }

    /**
     * @spec.given a RegisterComponent with mismatching passwords
     * @spec.when register is called
     * @spec.then the error field is set to the mismatch message and redirectTo stays empty
     */
    @Test
    void password_mismatch_sets_error_and_does_not_redirect() {
        test(RegisterComponent.class)
                .mount()
                .model("username", "alice")
                .model("password", "secret1")
                .model("passwordConfirm", "secret2")
                .call("register")
                .assertWire("error", "Passwords do not match.")
                .assertWire("redirectTo", "")
                .assertSee("Passwords do not match.");
    }

    /**
     * @spec.given a RegisterComponent with a blank username
     * @spec.when register is called
     * @spec.then the error field reports the missing username
     */
    @Test
    void blank_username_sets_error() {
        test(RegisterComponent.class)
                .mount()
                .model("username", "")
                .model("password", "secret")
                .model("passwordConfirm", "secret")
                .call("register")
                .assertWire("error", "Username is required.");
    }

    /**
     * @spec.given a RegisterComponent with a blank password
     * @spec.when register is called
     * @spec.then the error field reports the missing password
     */
    @Test
    void blank_password_sets_error() {
        test(RegisterComponent.class)
                .mount()
                .model("username", "bob")
                .model("password", "")
                .model("passwordConfirm", "")
                .call("register")
                .assertWire("error", "Password is required.");
    }

    /**
     * @spec.given a RegisterComponent and a client attempt to write the locked error field
     * @spec.when the tamper update rides with a register call
     * @spec.then the call is rejected 403 locked-property: the client cannot pre-clear the error
     */
    @Test
    void client_cannot_write_the_locked_error_field() {
        test(RegisterComponent.class)
                .mount()
                .tamperUpdate("error", "injected-by-attacker")
                .call("register")
                .assertRejected(LockedProperty.class);
    }

    /**
     * @spec.given a RegisterComponent and a client attempt to write the locked redirectTo field
     * @spec.when the tamper update rides with a register call
     * @spec.then the call is rejected 403 locked-property: open-redirect injection is blocked
     */
    @Test
    void client_cannot_write_the_locked_redirect_to_field() {
        test(RegisterComponent.class)
                .mount()
                .tamperUpdate("redirectTo", "https://evil.example.com")
                .call("register")
                .assertRejected(LockedProperty.class);
    }
}
