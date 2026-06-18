/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.page;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Disabling the browser back-forward cache for a sensitive page (issue #123, Livewire
 * {@code SupportDisablingBackButtonCache} parity): a component that calls
 * {@code LievitResponse.disableBackButtonCache()} in its mount gets a page response stamped with
 * {@code Cache-Control: no-cache, no-store, must-revalidate}; a plain page that does not opt out keeps
 * a bfcache-eligible response (the flag resets per request).
 */
@SpringBootTest(classes = PageTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class BackButtonCacheIT {

    @Autowired MockMvc mvc;

    /**
     * @spec.given a full-page component that calls disableBackButtonCache() in its @LievitMount
     * @spec.when  the page is requested over HTTP
     * @spec.then  the response carries no-store cache directives so a back-navigation re-fetches it
     * @spec.adr   ADR-0012
     * @spec.us    US-123-disable-back-button-cache
     */
    @Test
    void a_component_opting_out_gets_the_no_store_headers() throws Exception {
        mvc.perform(get("/account"))
                .andExpect(status().isOk())
                .andExpect(
                        header().string(
                                HttpHeaders.CACHE_CONTROL,
                                Matchers.containsString("no-store")))
                .andExpect(
                        header().string(
                                HttpHeaders.CACHE_CONTROL,
                                Matchers.containsString("must-revalidate")))
                .andExpect(header().string(HttpHeaders.PRAGMA, "no-cache"));
    }

    /**
     * @spec.given a following plain page request where no component opts out of bfcache
     * @spec.when  the page is requested over HTTP
     * @spec.then  no no-store directive is added: the flag reset per request, so a bfcache-eligible
     *     page stays eligible
     * @spec.adr   ADR-0012
     * @spec.us    US-123-disable-back-button-cache
     */
    @Test
    void a_plain_page_without_opt_out_is_not_marked_no_store() throws Exception {
        String cacheControl =
                mvc.perform(get("/post/hello-world"))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getHeader(HttpHeaders.CACHE_CONTROL);

        org.assertj.core.api.Assertions.assertThat(cacheControl)
                .satisfiesAnyOf(
                        value -> org.assertj.core.api.Assertions.assertThat(value).isNull(),
                        value ->
                                org.assertj.core.api.Assertions.assertThat(value)
                                        .doesNotContain("no-store"));
    }
}
