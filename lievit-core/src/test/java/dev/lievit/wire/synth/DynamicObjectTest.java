/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire.synth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Specifies the schemaless {@link DynamicObject} (the stdClass analogue, issue #137): a dotted-path
 * {@code set} creates missing nested keys, {@code get} resolves a dotted path, and the object renders
 * to and round-trips through a plain String-keyed JSON map (no typed object ever rides the wire).
 */
class DynamicObjectTest {

    /**
     * @spec.given a fresh, empty dynamic object
     * @spec.when  a plain (un-dotted) key is set and read
     * @spec.then  the value is stored and returned at that key
     * @spec.adr   ADR-0020
     */
    @Test
    void sets_and_gets_a_top_level_key() {
        DynamicObject obj = new DynamicObject();

        obj.set("name", "parma");

        assertThat(obj.get("name")).isEqualTo("parma");
        assertThat(obj.has("name")).isTrue();
        assertThat(obj.isEmpty()).isFalse();
    }

    /**
     * @spec.given an initially-empty dynamic object
     * @spec.when  a deep dotted path is set on it ({@code address.city})
     * @spec.then  the missing intermediate key is created and the leaf value is readable at the path
     * @spec.adr   ADR-0020
     */
    @Test
    void deep_set_creates_missing_intermediate_keys() {
        DynamicObject obj = new DynamicObject();

        obj.set("address.city", "Parma");

        assertThat(obj.get("address.city")).isEqualTo("Parma");
        // The intermediate key materialized as a nested dynamic object.
        assertThat(obj.get("address")).isInstanceOf(DynamicObject.class);
    }

    /**
     * @spec.given an initially-empty dynamic object
     * @spec.when  a three-level path is set ({@code a.b.c})
     * @spec.then  both intermediate levels are created and the leaf resolves
     * @spec.adr   ADR-0020
     */
    @Test
    void deep_set_creates_multiple_missing_levels() {
        DynamicObject obj = new DynamicObject();

        obj.set("a.b.c", 42);

        assertThat(obj.get("a.b.c")).isEqualTo(42);
    }

    /**
     * @spec.given a dynamic object with one nested key already set
     * @spec.when  a sibling key is set under the same intermediate object
     * @spec.then  the existing intermediate object is reused, so both leaves coexist
     * @spec.adr   ADR-0020
     */
    @Test
    void deep_set_reuses_an_existing_intermediate_object() {
        DynamicObject obj = new DynamicObject();
        obj.set("address.city", "Parma");

        obj.set("address.zip", "43121");

        assertThat(obj.get("address.city")).isEqualTo("Parma");
        assertThat(obj.get("address.zip")).isEqualTo("43121");
    }

    /**
     * @spec.given an empty dynamic object
     * @spec.when  a dotted path is read whose segments are absent
     * @spec.then  null is returned, never an exception (an open object has no required shape)
     * @spec.adr   ADR-0020
     */
    @Test
    void get_returns_null_for_an_absent_path() {
        DynamicObject obj = new DynamicObject();

        assertThat(obj.get("missing")).isNull();
        assertThat(obj.get("missing.deeper")).isNull();
    }

    /**
     * @spec.given a dynamic object with a nested key
     * @spec.when  it is rendered with toMap()
     * @spec.then  the result is a plain String-keyed JSON map with the nested level as a nested map,
     *     not a DynamicObject (the wire form is always plain JSON, ADR-0013)
     * @spec.adr   ADR-0020
     */
    @Test
    void to_map_renders_a_plain_nested_json_map() {
        DynamicObject obj = new DynamicObject();
        obj.set("address.city", "Parma");

        Map<String, Object> map = (Map<String, Object>) (Map<?, ?>) obj.toMap();

        assertThat(map.get("address")).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> nested = (Map<String, Object>) map.get("address");
        assertThat(nested).containsEntry("city", "Parma");
    }

    /**
     * @spec.given a plain String-keyed map carrying a nested map (a snapshot data payload)
     * @spec.when  a dynamic object is constructed over it and a deeper key is set
     * @spec.then  the source is adopted as nested dynamic objects so dotted operations work uniformly
     * @spec.adr   ADR-0020
     */
    @Test
    void constructs_over_a_source_map_and_adopts_nested_maps() {
        Map<String, Object> nested = new LinkedHashMap<>();
        nested.put("city", "Parma");
        Map<String, Object> source = new LinkedHashMap<>();
        source.put("address", nested);

        DynamicObject obj = new DynamicObject(source);
        obj.set("address.zip", "43121");

        assertThat(obj.get("address.city")).isEqualTo("Parma");
        assertThat(obj.get("address.zip")).isEqualTo("43121");
    }
}
