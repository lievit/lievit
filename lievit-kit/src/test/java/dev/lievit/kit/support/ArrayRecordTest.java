/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Specifies {@link ArrayRecord}: a plain map treated as a "record" so a form or table can run over
 * transient, non-entity data (settings pages, wizard state) without a persistent entity behind it.
 */
class ArrayRecordTest {

    /**
     * @spec.given an ArrayRecord built from a map
     * @spec.when  a key is read
     * @spec.then  the stored value is returned, and a missing key is empty
     */
    @Test
    void reads_a_value_by_key() {
        ArrayRecord record = ArrayRecord.of(Map.of("name", "Ada", "age", 36));

        assertThat(record.get("name")).contains("Ada");
        assertThat(record.get("age")).contains(36);
        assertThat(record.get("absent")).isEmpty();
    }

    /**
     * @spec.given an ArrayRecord
     * @spec.when  a value is set
     * @spec.then  a new ArrayRecord carries it and the original is unchanged (immutable updates)
     */
    @Test
    void sets_a_value_without_mutating_the_original() {
        ArrayRecord original = ArrayRecord.of(Map.of("name", "Ada"));

        ArrayRecord updated = original.with("name", "Grace");

        assertThat(updated.get("name")).contains("Grace");
        assertThat(original.get("name")).contains("Ada");
    }

    /**
     * @spec.given an ArrayRecord built from an ordered map
     * @spec.when  it is exposed as a map
     * @spec.then  it is an unmodifiable snapshot preserving insertion order
     */
    @Test
    void exposes_an_unmodifiable_ordered_snapshot() {
        Map<String, Object> source = new LinkedHashMap<>();
        source.put("first", 1);
        source.put("second", 2);
        ArrayRecord record = ArrayRecord.of(source);

        Map<String, Object> snapshot = record.asMap();

        assertThat(snapshot).containsExactly(
                Map.entry("first", 1), Map.entry("second", 2));
    }

    /**
     * @spec.given an empty ArrayRecord
     * @spec.when  a value is read
     * @spec.then  it reports empty without throwing (the transient-state default)
     */
    @Test
    void supports_an_empty_record() {
        assertThat(ArrayRecord.empty().get("anything")).isEmpty();
    }
}
