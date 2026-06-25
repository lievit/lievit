/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Specifies the streaming sink ({@code $this.stream} / {@code l:stream}, issue #153, ADR-0035): an
 * action streams chunks to named targets (append by default, replace on demand, falsy content
 * streamed); a live sink forwards each chunk to its writer immediately; {@code current()} outside a
 * streaming call fails fast.
 */
class LievitStreamTest {

    /**
     * @spec.given a live stream sink bound to a recording writer
     * @spec.when  an action streams an append chunk, a replace chunk, and an empty (falsy) chunk
     * @spec.then  each chunk is forwarded to the writer in order, with the right replace flag
     * @spec.adr   ADR-0035
     */
    @Test
    void a_live_sink_forwards_each_chunk_immediately() {
        List<StreamChunk> flushed = new ArrayList<>();
        LievitStream stream = LievitStream.live(flushed::add);

        stream.stream("out", "Hello ");
        stream.stream("out", "world", false);
        stream.stream("status", "done", true);
        stream.stream("out", ""); // falsy content is a valid chunk

        assertThat(flushed).hasSize(4);
        assertThat(flushed.get(0)).isEqualTo(new StreamChunk("out", "Hello ", false));
        assertThat(flushed.get(2)).isEqualTo(new StreamChunk("status", "done", true));
        assertThat(flushed.get(3).content()).isEmpty();
        assertThat(stream.chunks()).hasSize(4);
    }

    /**
     * @spec.given a capturing stream sink (off the wire)
     * @spec.when  an action streams chunks
     * @spec.then  the chunks are recorded for assertion without an open connection
     * @spec.adr   ADR-0035
     */
    @Test
    void a_capturing_sink_records_chunks_for_assertions() {
        LievitStream stream = LievitStream.capturing();

        stream.stream("out", "a");
        stream.stream("out", "b");

        assertThat(stream.chunks())
                .containsExactly(new StreamChunk("out", "a", false), new StreamChunk("out", "b", false));
    }

    /**
     * @spec.given no stream sink bound to the current thread
     * @spec.when  current() is read
     * @spec.then  it fails fast (a non-streaming call must not silently drop chunks)
     * @spec.adr   ADR-0035
     */
    @Test
    void current_outside_a_streaming_call_fails_fast() {
        assertThatThrownBy(LievitStream::current).isInstanceOf(IllegalStateException.class);
    }

    /**
     * @spec.given the streaming sink bound then cleared (the web-layer lifecycle)
     * @spec.when  current() is read after clear
     * @spec.then  it fails again: nothing leaks across calls (ADR-0001 statelessness)
     * @spec.adr   ADR-0035
     */
    @Test
    void bind_then_clear_resets_the_thread_local() {
        LievitStream.bind(LievitStream.capturing());
        assertThat(LievitStream.current()).isNotNull();
        LievitStream.clear();
        assertThatThrownBy(LievitStream::current).isInstanceOf(IllegalStateException.class);
    }
}
