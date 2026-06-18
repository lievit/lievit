/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.asset;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * End-to-end pin of the asset-serving pipeline (issue #171/#129, ADR-0060/0063): the runtime bundle is
 * served at the stable {@code /lievit/lievit.js} path, and a component's scoped CSS is served over a
 * dedicated route wrapped in its {@code [data-lievit-scope]} selector and cache-busted by a content
 * hash. Drives the full autoconfiguration (the controller + manifest + compiler beans).
 */
@SpringBootTest(classes = AssetTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class AssetPipelineIT {

    @Autowired MockMvc mvc;

    /**
     * @spec.given a packaged dev runtime bundle and no Vite manifest on the classpath
     * @spec.when  GET /lievit/lievit.js is requested
     * @spec.then  the unhashed bundle is served as a JS module (the dev fallback: it works with no
     *     build step)
     * @spec.adr   ADR-0060
     * @spec.us    US-171-asset-pipeline
     */
    @Test
    void serves_the_runtime_bundle_at_the_stable_path() throws Exception {
        mvc.perform(get("/lievit/lievit.js"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/javascript"))
                .andExpect(content().string(Matchers.containsString("startLievit")));
    }

    /**
     * @spec.given a component declaring scoped CSS, served over the CSS route with a version param
     * @spec.when  GET /lievit/css/{component}?v={hash} is requested
     * @spec.then  the CSS is returned wrapped in the component's {@code [data-lievit-scope]} selector
     *     (so it cannot leak) and is immutably cacheable (the versioned request)
     * @spec.adr   ADR-0063
     * @spec.us    US-129-scoped-css
     */
    @Test
    void serves_scoped_css_wrapped_in_the_component_scope() throws Exception {
        String component = Widget.class.getName();
        mvc.perform(get("/lievit/css/" + component).param("v", "deadbeef"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/css"))
                .andExpect(
                        content()
                                .string(
                                        Matchers.containsString(
                                                "[data-lievit-scope=\""
                                                        + component.replace('.', '-')
                                                        + "\"] .widget")))
                .andExpect(header().string("Cache-Control", Matchers.containsString("max-age")));
    }

    /**
     * @spec.given a component name that does not exist
     * @spec.when  its scoped CSS is requested
     * @spec.then  the route 404s rather than serving an empty / wrong stylesheet
     * @spec.adr   ADR-0063
     */
    @Test
    void css_route_404s_an_unknown_component() throws Exception {
        mvc.perform(get("/lievit/css/does.not.Exist")).andExpect(status().isNotFound());
    }
}
