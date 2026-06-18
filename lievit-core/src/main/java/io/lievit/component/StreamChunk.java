/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

/**
 * One streamed chunk ({@code $this.stream} / {@code l:stream}, issue #153, ADR-0035): the content an
 * action pushed to a named {@code l:stream} target mid-request, and whether it replaces the target's
 * content or appends to it. The web layer serializes each chunk as the JSON envelope
 * {@code {target, content, replace}} the client's {@code parseStreamEnvelope} reads off the SSE
 * response.
 *
 * <p>Falsy content (an empty string, {@code "0"}, {@code "false"}) streams correctly: the content is
 * a plain string and an empty string is a valid chunk (it is the {@code null} envelope, never sent,
 * that the client skips). {@code replace} defaults to false (append), matching Livewire.
 *
 * @param target the {@code l:stream} target name to write into (must be non-blank)
 * @param content the content to write (a string; an empty string is a valid chunk)
 * @param replace {@code true} to replace the target's content, {@code false} to append (the default)
 */
public record StreamChunk(String target, String content, boolean replace) {

    /**
     * @param target the target name (must be non-blank)
     * @param content the content (must be non-null; may be empty)
     * @param replace whether to replace or append
     */
    public StreamChunk {
        if (target == null || target.isBlank()) {
            throw new IllegalArgumentException("a stream chunk needs a non-blank target name");
        }
        if (content == null) {
            throw new IllegalArgumentException("a stream chunk's content must be non-null (use \"\")");
        }
    }
}
