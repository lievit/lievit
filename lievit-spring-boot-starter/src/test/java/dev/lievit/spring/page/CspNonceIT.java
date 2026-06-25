/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.page;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The server half of CSP-safe mode (issue #127, ADR-0062): with {@code lievit.csp.*} at its default
 * (enabled), a per-request CSP nonce exposed under the configured request attribute is stamped on the
 * auto-injected runtime {@code <script>}, so a strict {@code script-src 'nonce-...'} policy authorises
 * the external module load with no {@code unsafe-inline}. lievit reads the host-supplied nonce off the
 * request, it never writes the CSP header itself.
 */
@SpringBootTest(classes = PageTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class CspNonceIT {

    @Autowired MockMvc mvc;

    /**
     * @spec.given a full-page request carrying a CSP nonce under the configured request attribute
     *     ({@code lievit.csp-nonce})
     * @spec.when  the page is rendered with auto-injection at its default
     * @spec.then  the injected runtime {@code <script>} carries that nonce, so the external module
     *     load is authorised under a nonce-based CSP
     * @spec.adr   ADR-0062
     * @spec.us    US-127-csp-safe
     */
    @Test
    void stamps_the_request_csp_nonce_on_the_injected_runtime_script() throws Exception {
        mvc.perform(get("/post/hello-world").requestAttr("lievit.csp-nonce", "r4nd0mN0nce"))
                .andExpect(status().isOk())
                .andExpect(
                        content()
                                .string(
                                        Matchers.matchesPattern(
                                                "(?s).*<script[^>]*nonce=\"r4nd0mN0nce\"[^>]*>.*")));
    }
}
