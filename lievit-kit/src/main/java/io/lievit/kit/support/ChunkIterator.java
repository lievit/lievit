/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.support;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;

/**
 * Batched iteration over a source list (the filament-support {@code ChunkIterator} carried over):
 * yields fixed-size sub-lists so a bulk or export path processes N rows a chunk at a time, never
 * materializing one giant intermediate per step.
 *
 * <p>It is a plain {@link Iterable} of chunks: {@code for (List<T> chunk : ChunkIterator.of(rows,
 * 500))}. The last chunk holds the remainder and may be smaller than the chunk size; an empty source
 * yields no chunk. Each chunk is an immutable snapshot. This is the lower-level primitive the
 * {@link io.lievit.kit.job.ChunkedJob} batches over; expose it standalone so a caller can chunk
 * without the job machinery.
 *
 * @param <T> the element type
 */
public final class ChunkIterator<T> implements Iterable<List<T>> {

    private final List<T> source;
    private final int chunkSize;

    private ChunkIterator(List<T> source, int chunkSize) {
        this.source = List.copyOf(source);
        if (chunkSize < 1) {
            throw new IllegalArgumentException("chunkSize must be >= 1, got: " + chunkSize);
        }
        this.chunkSize = chunkSize;
    }

    /**
     * @param source the items to chunk (defensively copied)
     * @param chunkSize the maximum number of items per chunk (must be {@code >= 1})
     * @param <T> the element type
     * @return a chunk iterator over the source
     * @throws IllegalArgumentException if {@code chunkSize < 1}
     */
    public static <T> ChunkIterator<T> of(List<T> source, int chunkSize) {
        Objects.requireNonNull(source, "source");
        return new ChunkIterator<>(source, chunkSize);
    }

    @Override
    public Iterator<List<T>> iterator() {
        return new Iterator<>() {
            private int from = 0;

            @Override
            public boolean hasNext() {
                return from < source.size();
            }

            @Override
            public List<T> next() {
                if (!hasNext()) {
                    throw new NoSuchElementException();
                }
                int to = Math.min(from + chunkSize, source.size());
                List<T> chunk = List.copyOf(new ArrayList<>(source.subList(from, to)));
                from = to;
                return chunk;
            }
        };
    }
}
