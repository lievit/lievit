/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.page;

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
 * Full-page routing + layout wrapping (issue #63/#181): a {@code @LievitPage("/post/{slug}")}
 * component is reachable as a URL, rendered inside its {@code @LievitLayout} with its
 * {@code @LievitTitle}, and the {@code {slug}} path variable bound to the component's same-named
 * {@code @Wire} field. The page is stamped with the top-level wire markers so the client hydrates it.
 */
@SpringBootTest(classes = PageTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class FullPageRoutingIT {

    @Autowired MockMvc mvc;

    /**
     * @spec.given a full-page component mapped to /post/{slug} with a layout and a title
     * @spec.when  GET /post/hello-world is requested
     * @spec.then  the response is a full HTML document: the title is set, the slug path variable is
     *     bound and rendered, and the component root carries the wire markers for the client
     * @spec.adr   ADR-0033
     * @spec.us    US-181-full-page-route
     */
    @Test
    void a_page_component_renders_within_its_layout_with_bound_route_params() throws Exception {
        mvc.perform(get("/post/hello-world"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/html"))
                // The layout set the page title (@LievitTitle).
                .andExpect(content().string(Matchers.containsString("<title>Post</title>")))
                // The declared layout was recorded by the default layout renderer.
                .andExpect(content().string(Matchers.containsString("data-lievit-layout=\"layouts/app\"")))
                // The {slug} path variable was bound to the @Wire slug field and rendered.
                .andExpect(content().string(Matchers.containsString("hello-world")))
                // The component root is stamped so the client hydrates the page-level component.
                .andExpect(content().string(Matchers.containsString("data-lievit-snapshot")));
    }
}
