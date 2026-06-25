/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

/**
 * Specifies the {@code download} effect ({@code $this.download}, issue #161): an action returns a
 * file to the browser as a download; the bytes ride the effects header base64-encoded with the file
 * name + content type. The component still re-renders (the effect is additive, not a redirect). The
 * reserved {@code download} key of wire-protocol.md §5b is realized here.
 */
class DownloadEffectTest {

    /**
     * @spec.given raw bytes, a file name, and a content type
     * @spec.when  a download effect is built from them and decoded back
     * @spec.then  the decoded bytes equal the originals (base64 round-trip, no raw binary on the wire)
     */
    @Test
    void round_trips_bytes_through_base64() {
        byte[] bytes = "report,data\n1,2\n".getBytes(StandardCharsets.UTF_8);
        DownloadEffect effect = DownloadEffect.of("report.csv", bytes, "text/csv");

        assertThat(effect.name()).isEqualTo("report.csv");
        assertThat(effect.contentType()).isEqualTo("text/csv");
        assertThat(effect.decodedBytes()).isEqualTo(bytes);
    }

    /**
     * @spec.given a UTF-8 file name (RFC 5987 territory) and text content
     * @spec.when  a text download effect is built
     * @spec.then  the name is preserved verbatim and the text decodes back as UTF-8
     */
    @Test
    void preserves_a_utf8_file_name_and_text() {
        DownloadEffect effect = DownloadEffect.ofText("relazione-€.txt", "città", "text/plain");

        assertThat(effect.name()).isEqualTo("relazione-€.txt");
        assertThat(new String(effect.decodedBytes(), StandardCharsets.UTF_8)).isEqualTo("città");
    }

    /**
     * @spec.given a fresh effects sink
     * @spec.when  an action queues a download on it
     * @spec.then  the sink is no longer empty and exposes the queued download
     */
    @Test
    void queues_a_download_on_the_effects_sink() {
        LievitEffects effects = LievitEffects.capturing();
        assertThat(effects.isEmpty()).isTrue();

        effects.download("a.bin", new byte[] {1, 2, 3}, "application/octet-stream");

        assertThat(effects.isEmpty()).isFalse();
        assertThat(effects.download()).isNotNull();
        assertThat(effects.download().name()).isEqualTo("a.bin");
        assertThat(effects.download().decodedBytes()).containsExactly(1, 2, 3);
    }

    /**
     * @spec.given an effects sink with a download already queued
     * @spec.when  a second download is queued
     * @spec.then  the last one wins (a single download per call, Livewire parity)
     */
    @Test
    void the_last_queued_download_wins() {
        LievitEffects effects = LievitEffects.capturing();
        effects.download("first.txt", "1".getBytes(StandardCharsets.UTF_8), "text/plain");
        effects.download("second.txt", "2".getBytes(StandardCharsets.UTF_8), "text/plain");

        assertThat(effects.download().name()).isEqualTo("second.txt");
    }

    /**
     * @spec.given a download with a blank file name
     * @spec.when  it is constructed
     * @spec.then  it throws (a download must name the file the browser saves)
     */
    @Test
    void rejects_a_blank_file_name() {
        assertThatThrownBy(() -> new DownloadEffect("  ", "", "text/plain"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
