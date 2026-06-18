/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.lievit.spring.counter.CounterTestApp;

/**
 * The file-upload server hook end-to-end (issue #159): a multipart upload to {@code /lievit/upload}
 * stores the file and returns a signed temp-path reference; the signed preview route serves the
 * bytes; and a forged/garbage token is rejected with a {@code 404} (fail-closed, never confirming a
 * path). Proves the additive controller + the {@code TempFileSigner}/{@code TempFileStorage} beans
 * the autoconfiguration registers, wired through the real HTTP edge.
 */
@SpringBootTest(classes = CounterTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class LievitUploadControllerIT {

    @Autowired private MockMvc mockMvc;
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void uploads_a_file_and_serves_its_signed_preview() throws Exception {
        MockMultipartFile file =
                new MockMultipartFile("files", "photo.png", "image/png", "PNGBYTES".getBytes());

        MvcResult result =
                mockMvc.perform(multipart("/lievit/upload").file(file))
                        .andExpect(status().isOk())
                        .andReturn();

        JsonNode body = json.readTree(result.getResponse().getContentAsString());
        JsonNode ref = body.get("files").get(0);
        assertThat(ref.get("name").asText()).isEqualTo("photo.png");
        assertThat(ref.get("size").asLong()).isEqualTo("PNGBYTES".length());
        String token = ref.get("path").asText();

        // The signed token serves the stored bytes through the preview route.
        mockMvc.perform(get("/lievit/upload/preview").param("t", token)).andExpect(status().isOk());
    }

    @Test
    void rejects_a_forged_preview_token_with_404() throws Exception {
        mockMvc.perform(get("/lievit/upload/preview").param("t", "Zm9yZ2Vk.9999999999.AAAA"))
                .andExpect(status().isNotFound());
    }
}
