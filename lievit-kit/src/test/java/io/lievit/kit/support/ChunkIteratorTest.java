/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Specifies {@link ChunkIterator}: batched iteration over a source, the building block bulk and
 * export paths use to process N rows without holding a giant intermediate list per step.
 */
class ChunkIteratorTest {

    /**
     * @spec.given a list of seven items chunked by three
     * @spec.when  the chunks are collected
     * @spec.then  three chunks come out, sized 3, 3, 1, preserving order
     */
    @Test
    void slices_a_source_into_fixed_size_chunks() {
        List<Integer> source = List.of(1, 2, 3, 4, 5, 6, 7);

        List<List<Integer>> chunks = new ArrayList<>();
        ChunkIterator.of(source, 3).forEach(chunks::add);

        assertThat(chunks).containsExactly(
                List.of(1, 2, 3), List.of(4, 5, 6), List.of(7));
    }

    /**
     * @spec.given an empty source
     * @spec.when  it is chunked
     * @spec.then  no chunk is produced
     */
    @Test
    void produces_no_chunk_for_an_empty_source() {
        List<List<String>> chunks = new ArrayList<>();
        ChunkIterator.of(List.<String>of(), 5).forEach(chunks::add);

        assertThat(chunks).isEmpty();
    }

    /**
     * @spec.given a source smaller than the chunk size
     * @spec.when  it is chunked
     * @spec.then  exactly one chunk holds every item
     */
    @Test
    void yields_a_single_chunk_when_source_is_smaller_than_chunk() {
        List<List<Integer>> chunks = new ArrayList<>();
        ChunkIterator.of(List.of(1, 2), 10).forEach(chunks::add);

        assertThat(chunks).containsExactly(List.of(1, 2));
    }

    /**
     * @spec.given a non-positive chunk size
     * @spec.when  a ChunkIterator is built
     * @spec.then  it is rejected (a chunk must hold at least one item)
     */
    @Test
    void rejects_a_non_positive_chunk_size() {
        assertThatThrownBy(() -> ChunkIterator.of(List.of(1), 0))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
