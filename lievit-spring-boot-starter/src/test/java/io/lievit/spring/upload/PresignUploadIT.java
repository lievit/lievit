/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.lievit.spring.counter.CounterTestApp;
import io.lievit.upload.DirectUpload;
import io.lievit.upload.DirectUploadProvider;

/**
 * The direct-to-object-storage presign endpoint end-to-end (issue #191): with a
 * {@link DirectUploadProvider} bean wired, {@code POST /lievit/upload/presign} returns one presigned
 * descriptor per requested file (the bytes will go straight to storage, never proxying through the
 * app); with no provider bean, the endpoint is {@code 404} (direct upload is opt-in). Pins the
 * per-file contract (the multiple+direct constraint): N files in, N descriptors out, one PUT each.
 */
class PresignUploadIT {

    private static final String KEY = "lievit.signing-key=test-signing-key-0123456789abcdef-0123456789";
    private final ObjectMapper json = new ObjectMapper();

    @Nested
    @SpringBootTest(classes = {CounterTestApp.class, WithProvider.Config.class})
    @AutoConfigureMockMvc
    @TestPropertySource(properties = {KEY})
    class WithProvider {

        @Autowired private MockMvc mockMvc;

        @TestConfiguration
        static class Config {
            @Bean
            DirectUploadProvider stubProvider() {
                return (name, contentType) ->
                        DirectUpload.put("https://bucket.example/" + name + "?sig=abc", "uploads/" + name);
            }
        }

        /**
         * @spec.given a wired direct-upload provider and two files to presign
         * @spec.when  POST /lievit/upload/presign carries both
         * @spec.then  two presigned descriptors come back (one PUT per file, the multiple+direct
         *             constraint), each naming its presigned URL and recorded key
         */
        @Test
        void returns_one_presigned_descriptor_per_file() throws Exception {
            String reqBody =
                    "{\"files\":[{\"name\":\"a.png\",\"contentType\":\"image/png\"},"
                            + "{\"name\":\"b.jpg\",\"contentType\":\"image/jpeg\"}]}";

            MvcResult result =
                    mockMvc.perform(
                                    post("/lievit/upload/presign")
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content(reqBody))
                            .andExpect(status().isOk())
                            .andReturn();

            JsonNode uploads = json.readTree(result.getResponse().getContentAsString()).get("uploads");
            assertThat(uploads).hasSize(2);
            assertThat(uploads.get(0).get("url").asText()).isEqualTo("https://bucket.example/a.png?sig=abc");
            assertThat(uploads.get(0).get("key").asText()).isEqualTo("uploads/a.png");
            assertThat(uploads.get(0).get("method").asText()).isEqualTo("PUT");
            assertThat(uploads.get(1).get("key").asText()).isEqualTo("uploads/b.jpg");
        }
    }

    @Nested
    @SpringBootTest(classes = CounterTestApp.class)
    @AutoConfigureMockMvc
    @TestPropertySource(properties = {KEY})
    class WithoutProvider {

        @Autowired private MockMvc mockMvc;

        /**
         * @spec.given no direct-upload provider bean is wired (direct upload is opt-in)
         * @spec.when  POST /lievit/upload/presign is called
         * @spec.then  the endpoint is 404: uploads proxy through /lievit/upload instead
         */
        @Test
        void is_404_when_direct_upload_is_not_configured() throws Exception {
            mockMvc.perform(
                            post("/lievit/upload/presign")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{\"files\":[{\"name\":\"a.png\",\"contentType\":\"image/png\"}]}"))
                    .andExpect(status().isNotFound());
        }
    }
}
