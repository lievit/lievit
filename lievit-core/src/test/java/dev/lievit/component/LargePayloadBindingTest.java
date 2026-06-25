/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Base64;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.LievitComponent;
import dev.lievit.Wire;

/**
 * Pins the server half of large-payload encoding (issue #135): the client base64-encodes a binary
 * {@code @Wire byte[]} update as a {@code {__lievit_b64: "<base64>"}} envelope (chunked client-side
 * so a 300KB+ array never overflows the call stack); the dispatcher decodes it back to the field's
 * {@code byte[]} so the action receives the full argument intact, byte-for-byte.
 */
class LargePayloadBindingTest {

    @LievitComponent
    static class Upload {
        @Wire byte[] blob = new byte[0];
    }

    /**
     * @spec.given a large byte[] sent as a {@code {__lievit_b64}} envelope in {@code _updates}
     * @spec.when  the wire call applies the update
     * @spec.then  the field holds the decoded bytes, full and byte-for-byte intact
     * @spec.adr   ADR-0034
     */
    @Test
    void decodes_a_base64_byte_array_update_full_and_intact() {
        byte[] original = new byte[300 * 1024];
        for (int i = 0; i < original.length; i++) {
            original[i] = (byte) (i % 256);
        }
        String base64 = Base64.getEncoder().encodeToString(original);

        ComponentMetadata meta = ComponentMetadata.of(Upload.class);
        Upload instance = new Upload();

        // The snapshot carries an empty byte[] as its dehydrated tuple ({"@w":{"d":"","s":"bytes"}}).
        Map<String, Object> snapshotWire =
                Map.of("blob", Map.of("@w", Map.of("d", "", "s", "bytes")));

        WireCall result =
                new WireDispatcher()
                        .call(
                                meta,
                                instance,
                                snapshotWire,
                                Map.of("blob", Map.of("__lievit_b64", base64)),
                                List.of());

        // The action received the full argument, byte-for-byte.
        assertThat(instance.blob).hasSize(original.length).isEqualTo(original);
        // And it dehydrates back into the snapshot as a base64 tuple (the round trip is closed).
        @SuppressWarnings("unchecked")
        Map<String, Object> tuple = (Map<String, Object>) result.wire().get("blob");
        @SuppressWarnings("unchecked")
        Map<String, Object> w = (Map<String, Object>) tuple.get("@w");
        assertThat(w).containsEntry("s", "bytes");
        assertThat(w.get("d")).isEqualTo(java.util.Base64.getEncoder().encodeToString(original));
    }
}
