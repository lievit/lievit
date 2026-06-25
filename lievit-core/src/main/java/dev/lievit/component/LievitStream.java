/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

import org.jspecify.annotations.Nullable;

/**
 * The per-call streaming sink ({@code $this.stream} / {@code l:stream}, issue #153, ADR-0035): the
 * request-scoped handle an {@code @LievitAction} uses to push content chunks to the browser
 * mid-request, into a named {@code l:stream} target. Each {@link #stream} call resolves a target and
 * writes a {@link StreamChunk}; {@code replace=true} swaps the target's content, the default appends.
 *
 * <p>Two modes, both behind one API (the component author writes the same {@code stream(...)} call):
 *
 * <ul>
 *   <li><b>live</b> — bound by the SSE streaming endpoint to a flush sink that writes each chunk to
 *       the open Server-Sent-Events response immediately (the progressive-output path: an AI token
 *       stream, a long job). The web layer sets the SSE headers and flushes per chunk.
 *   <li><b>capturing</b> — an unbound, in-memory sink ({@link #capturing()}) that just records the
 *       chunks, so server-side code and tests can drive a streaming action and assert over
 *       {@link #chunks()} without an open connection.
 * </ul>
 *
 * <p>Like {@link LievitEffects}, the active sink is bound to the current thread via a
 * {@link ThreadLocal} and reset per call; reading {@link #current()} outside a streaming call is a
 * programming error. A non-streaming wire call binds no stream sink, so {@code current()} fails fast
 * rather than silently dropping chunks.
 */
public final class LievitStream {

    private static final ThreadLocal<LievitStream> CURRENT = new ThreadLocal<>();

    /** The chunk consumer: a flush-to-SSE writer (live) or an in-memory recorder (capturing). */
    private final Consumer<StreamChunk> sink;
    private final List<StreamChunk> recorded = new ArrayList<>();

    private LievitStream(Consumer<StreamChunk> sink) {
        this.sink = sink;
    }

    /**
     * Creates a live streaming sink that forwards each chunk to {@code writer} (the SSE flush). The
     * web layer constructs one per streaming request and binds it via {@link #bind}.
     *
     * @param writer the per-chunk sink (writes + flushes the SSE envelope)
     * @return a live streaming sink
     */
    public static LievitStream live(Consumer<StreamChunk> writer) {
        return new LievitStream(writer);
    }

    /**
     * Creates a capturing streaming sink that records every chunk in memory (off the wire), so a test
     * or server-side helper can drive a streaming action and read back {@link #chunks()}.
     *
     * @return a capturing streaming sink
     */
    public static LievitStream capturing() {
        return new LievitStream(c -> {});
    }

    /**
     * Returns the stream sink bound for the current streaming call.
     *
     * @return the bound sink
     * @throws IllegalStateException if called outside a streaming call (no sink is bound)
     */
    public static LievitStream current() {
        LievitStream stream = CURRENT.get();
        if (stream == null) {
            throw new IllegalStateException(
                    "LievitStream.current() called outside a streaming call: no stream sink is bound");
        }
        return stream;
    }

    /** Binds {@code stream} as the sink for the current thread (called by the web layer). */
    public static void bind(LievitStream stream) {
        CURRENT.set(stream);
    }

    /** Clears the bound sink for the current thread (called by the web layer in a finally). */
    public static void clear() {
        CURRENT.remove();
    }

    /**
     * Streams a chunk to a named {@code l:stream} target, appending to it.
     *
     * @param target the {@code l:stream} target name (must be non-blank)
     * @param content the content to append (an empty string is a valid chunk)
     */
    public void stream(String target, String content) {
        stream(target, content, false);
    }

    /**
     * Streams a chunk to a named {@code l:stream} target.
     *
     * @param target the {@code l:stream} target name (must be non-blank)
     * @param content the content to write (an empty string is a valid chunk)
     * @param replace {@code true} to replace the target's content, {@code false} to append
     */
    public void stream(String target, @Nullable String content, boolean replace) {
        StreamChunk chunk = new StreamChunk(target, content == null ? "" : content, replace);
        recorded.add(chunk);
        sink.accept(chunk);
    }

    /**
     * @return the chunks streamed on this sink, in order (the recorder view, for capturing sinks /
     *     assertions; a live sink also records them so a streaming action stays testable)
     */
    public List<StreamChunk> chunks() {
        return List.copyOf(recorded);
    }
}
