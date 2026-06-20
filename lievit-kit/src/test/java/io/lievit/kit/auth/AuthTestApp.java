/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.auth;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/**
 * Minimal Spring Boot app for the auth-page render IT: wires the four {@link AuthPage} models with
 * test {@link AuthHandler} stubs (login accepts only a known credential pair; register rejects a
 * taken email; password-reset always confirms; email-verification accepts a known code) and the four
 * wire components as prototype beans (a fresh instance per stateless wire call, the runtime contract).
 */
@SpringBootApplication
public class AuthTestApp {

    /** @return the login page; the stub accepts only agent@example.com / secret-password */
    @Bean
    LoginPage loginPage() {
        return LoginPage.withLinks(
                credentials -> {
                    if ("agent@example.com".equals(credentials.get("email"))
                            && "secret-password".equals(credentials.get("password"))) {
                        return AuthOutcome.redirect("/admin");
                    }
                    return AuthOutcome.failed("These credentials do not match our records.");
                },
                List.of(
                        new AuthFormView.Link("Forgot your password?", "/admin/password-reset"),
                        new AuthFormView.Link("Create an account", "/admin/register")));
    }

    /** @return the register page; the stub rejects taken@example.com as an already-taken email */
    @Bean
    RegisterPage registerPage() {
        return RegisterPage.withLinks(
                credentials -> {
                    if ("taken@example.com".equals(credentials.get("email"))) {
                        return AuthOutcome.fieldErrors(Map.of("email", "This email is already taken."));
                    }
                    return AuthOutcome.redirect("/admin");
                },
                List.of(new AuthFormView.Link("Already registered? Sign in", "/admin/login")));
    }

    /** @return the password-reset page; the stub always confirms (does not reveal address existence) */
    @Bean
    PasswordResetPage passwordResetPage() {
        return PasswordResetPage.withLinks(
                credentials -> AuthOutcome.confirmed("We have emailed you a password reset link."),
                List.of(new AuthFormView.Link("Back to sign in", "/admin/login")));
    }

    /** @return the email-verification page; the stub accepts the code 123456 */
    @Bean
    EmailVerificationPage emailVerificationPage() {
        return new EmailVerificationPage(
                credentials -> {
                    if ("123456".equals(credentials.get("code"))) {
                        return AuthOutcome.confirmed("Your email address has been verified.");
                    }
                    return AuthOutcome.failed("That code is invalid or has expired.");
                });
    }

    /**
     * @param page the login page
     * @return a fresh login component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    LoginComponent loginComponent(LoginPage page) {
        return new LoginComponent(page);
    }

    /**
     * @param page the register page
     * @return a fresh register component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    RegisterComponent registerComponent(RegisterPage page) {
        return new RegisterComponent(page);
    }

    /**
     * @param page the password-reset page
     * @return a fresh password-reset component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    PasswordResetComponent passwordResetComponent(PasswordResetPage page) {
        return new PasswordResetComponent(page);
    }

    /**
     * @param page the email-verification page
     * @return a fresh email-verification component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    EmailVerificationComponent emailVerificationComponent(EmailVerificationPage page) {
        return new EmailVerificationComponent(page);
    }
}
