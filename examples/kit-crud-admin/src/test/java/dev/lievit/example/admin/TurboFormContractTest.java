/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.example.admin;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

import dev.lievit.test.LievitTest;

/**
 * The Turbo Drive backend contract for this example's standard {@code <form method=post>} navigations
 * (ADR-0085, {@code docs/guide/turbo-backend-contract.md}). Turbo intercepts a real form submit, so
 * the controller MUST: redirect with {@code 303 See Other} on success (not Spring's default 302, and
 * never a 200 — Turbo discards a 200 carrying HTML on a POST), and re-render the form with {@code 422
 * Unprocessable Content} on a validation error (a 200 there would be silently dropped and the user
 * would never see the errors).
 *
 * <p>These tests guard the {@link dev.lievit.example.admin.web.ProductAdminController} write paths
 * (create / edit / delete). The lievit WIRE endpoint ({@code /lievit/*}) is deliberately NOT covered
 * here: Turbo does not intercept the runtime's programmatic fetch, so the wire keeps returning 200 and
 * carries its redirect over the effects channel.
 *
 * <p>{@link LievitTest} boots the web context; this example packages a Spring Boot fat-jar, so its
 * context tests run in the surefire ({@code *Test}) loop like {@code AdminAppSmokeTest}, not failsafe.
 * MockMvc is built from the {@link WebApplicationContext} with Spring Security applied (the example's
 * test scope does not pull the MockMvc auto-configuration). create/delete mutate the shared in-memory
 * repository, so a fresh context per method isolates them.
 */
@LievitTest(classes = AdminApp.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class TurboFormContractTest {

    @Autowired WebApplicationContext context;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = webAppContextSetup(context).apply(springSecurity()).build();
    }

    /**
     * @spec.given an authenticated admin submitting the create form with a valid product
     * @spec.when  POST /admin/products/create succeeds
     * @spec.then  Turbo's success contract holds: 303 See Other (Post/Redirect/Get) to the list, not
     *     Spring's default 302 and not a 200 (Turbo would discard a 200 on a POST)
     * @spec.adr   ADR-0085
     */
    @Test
    void successful_create_redirects_with_303_see_other() throws Exception {
        mvc.perform(
                        post("/admin/products/create")
                                .with(user("admin").roles("ADMIN"))
                                .with(csrf())
                                .param("name", "Cold Brew Kit")
                                .param("sku", "CBK-007")
                                .param("status", "active")
                                .param("price", "39.00"))
                .andExpect(status().isSeeOther()) // 303, the Turbo success contract
                .andExpect(header().string("Location", "/admin/products"));
    }

    /**
     * @spec.given an authenticated admin submitting the create form with an invalid product (blank
     *     name, non-numeric price)
     * @spec.when  POST /admin/products/create fails validation
     * @spec.then  Turbo's validation contract holds: the form re-renders with 422 Unprocessable
     *     Content (not a 200, which Turbo would discard, hiding the errors)
     * @spec.adr   ADR-0085
     */
    @Test
    void invalid_create_re_renders_the_form_with_422() throws Exception {
        mvc.perform(
                        post("/admin/products/create")
                                .with(user("admin").roles("ADMIN"))
                                .with(csrf())
                                .param("name", "")
                                .param("sku", "X-1")
                                .param("status", "draft")
                                .param("price", "free"))
                .andExpect(status().isUnprocessableEntity()); // 422, so Turbo renders the errors
    }

    /**
     * @spec.given an authenticated admin deleting a seeded product
     * @spec.when  POST /admin/products/{id}/delete succeeds
     * @spec.then  Turbo's success contract holds: 303 See Other back to the list
     * @spec.adr   ADR-0085
     */
    @Test
    void delete_redirects_with_303_see_other() throws Exception {
        mvc.perform(
                        post("/admin/products/1/delete")
                                .with(user("admin").roles("ADMIN"))
                                .with(csrf()))
                .andExpect(status().isSeeOther())
                .andExpect(header().string("Location", "/admin/products"));
    }
}
