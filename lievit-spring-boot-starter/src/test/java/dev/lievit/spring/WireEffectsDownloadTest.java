/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import dev.lievit.component.LievitEffects;

/**
 * Specifies the wire serialization of the {@code download} effect (issue #161): a queued download
 * serializes into the {@code Lievit-Effects} header as {@code {download:{name,content,type}}} with
 * base64 content, and a plain action (no download) omits the key entirely (backward compatible).
 */
class WireEffectsDownloadTest {

    private final ObjectMapper json = new ObjectMapper();

    /**
     * @spec.given an effects sink with a queued file download
     * @spec.when  it is projected to the wire form and serialized
     * @spec.then  the download key carries the name, base64 content, and content type
     */
    @Test
    void serializes_a_queued_download() throws Exception {
        LievitEffects sink = LievitEffects.capturing();
        byte[] bytes = "id,name\n1,a\n".getBytes(StandardCharsets.UTF_8);
        sink.download("export.csv", bytes, "text/csv");

        JsonNode node = json.readTree(json.writeValueAsString(WireEffects.from(sink)));

        assertThat(node.get("download").get("name").asText()).isEqualTo("export.csv");
        assertThat(node.get("download").get("type").asText()).isEqualTo("text/csv");
        byte[] decoded = Base64.getDecoder().decode(node.get("download").get("content").asText());
        assertThat(decoded).isEqualTo(bytes);
    }

    /**
     * @spec.given an action that produced no effects
     * @spec.when  the sink is projected
     * @spec.then  the wire form is null (the header is omitted; a plain action stays byte-for-byte)
     */
    @Test
    void omits_the_download_key_when_no_download_was_queued() {
        LievitEffects sink = LievitEffects.capturing();
        assertThat(WireEffects.from(sink)).isNull();
    }
}
