/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.ObjectMapper;

/**
 * Locale pinning across the stateless round trip (ADR-0037, issues #169 + #143): a component first
 * rendered in Italian (mount with {@code Accept-Language: it}) keeps rendering in Italian on a
 * subsequent wire update even though that update is a fresh HTTP request whose {@code Accept-Language}
 * is English. The greeting resolves through a real {@code MessageSource}, so it proves the pinned
 * locale drives message resolution, not just the raw locale tag.
 */
@SpringBootTest(classes = LocaleTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class LocalePinningIT {

    /** Pulls the signed snapshot out of the stamped page root (HTML-attribute encoded). */
    private static final Pattern SNAPSHOT =
            Pattern.compile("data-lievit-snapshot=\"([^\"]+)\"");

    /** Pulls the rendered language tag out of the {@code data-lang} span. */
    private static final Pattern LANG =
            Pattern.compile("data-lang[^>]*>([^<]+)</span>");

    /** Pulls the rendered greeting out of the {@code data-greeting} span. */
    private static final Pattern GREETING =
            Pattern.compile("data-greeting[^>]*>([^<]+)</span>");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    /**
     * @spec.given a greeting page mounted with Accept-Language: it (renders "Ciao", tag "it")
     * @spec.when  a wire update is fired with Accept-Language: en (a fresh request defaulting to en)
     * @spec.then  the re-rendered component still shows the Italian greeting "Ciao" and the tag "it":
     *     the mount locale was pinned into the snapshot memo and restored before the render, so the
     *     MessageSource resolved in the pinned locale, not the request default
     * @spec.adr   ADR-0037
     * @spec.us    US-locale-persists-across-requests
     */
    @Test
    void italian_mount_stays_italian_on_an_english_wire_update() throws Exception {
        // Mount in Italian.
        MvcResult mounted =
                mvc.perform(get("/greeting").header("Accept-Language", "it"))
                        .andExpect(status().isOk())
                        .andReturn();
        String page = mounted.getResponse().getContentAsString();

        assertThat(group(GREETING, page)).isEqualTo("Ciao");
        assertThat(group(LANG, page)).isEqualTo("it");

        String snapshot = group(SNAPSHOT, page);
        assertThat(snapshot).isNotBlank();

        // Fire a wire update from a fresh request whose Accept-Language is English.
        Map<String, Object> body =
                Map.of("_snapshot", snapshot, "_updates", Map.of(), "_calls", java.util.List.of("bump"));
        MvcResult updated =
                mvc.perform(
                                post("/lievit/{id}/call", "lievit-greeting")
                                        .header("X-Lievit", "1")
                                        .header("Accept-Language", "en")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(json.writeValueAsString(body)))
                        .andExpect(status().isOk())
                        .andReturn();
        String reRendered = updated.getResponse().getContentAsString();

        // The locale was pinned: still Italian, even though the request asked for English.
        assertThat(group(LANG, reRendered)).isEqualTo("it");
        assertThat(group(GREETING, reRendered)).isEqualTo("Ciao");
    }

    /**
     * @spec.given a greeting page mounted with Accept-Language: en (the control case)
     * @spec.when  the page is rendered
     * @spec.then  it shows the English greeting "Hello" and the tag "en", proving the pin tracks the
     *     mount locale and is not hardcoded to Italian
     * @spec.adr   ADR-0037
     */
    @Test
    void english_mount_renders_english() throws Exception {
        MvcResult mounted =
                mvc.perform(get("/greeting").header("Accept-Language", "en"))
                        .andExpect(status().isOk())
                        .andReturn();
        String page = mounted.getResponse().getContentAsString();

        assertThat(group(GREETING, page)).isEqualTo("Hello");
        assertThat(group(LANG, page)).isEqualTo("en");
    }

    private static String group(Pattern pattern, String haystack) {
        Matcher m = pattern.matcher(haystack);
        assertThat(m.find()).as("pattern %s found in output", pattern).isTrue();
        return m.group(1).trim();
    }
}
