/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire.synth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import io.lievit.wire.WireError;
import io.lievit.wire.WireException;

/**
 * Specifies the typed-state synthesizer registry: a non-primitive value dehydrates to a tuple and
 * hydrates back to the exact Java type, recursively, while primitives and plain JSON pass through
 * unchanged. This is the fix for the confirmed kit-CRUD round-trip blocker (ADR-0020, issue #163).
 */
@SuppressWarnings("unchecked")
class SynthesizerRegistryTest {

    private final SynthesizerRegistry registry = new SynthesizerRegistry();

    enum Status {
        DRAFT,
        ACTIVE,
        ARCHIVED
    }

    record Money(long cents, String currency) {}

    record Listing(String title, BigDecimal price, Status status, List<Status> history) {}

    record WithDate(LocalDate when) {}

    public record Distance(int meters) implements Wireable {
        @Override
        public Object toWire() {
            return meters;
        }

        public static Distance fromWire(Object data) {
            return new Distance(((Number) data).intValue());
        }
    }

    /**
     * @spec.given an int and a String
     * @spec.when  they are dehydrated
     * @spec.then  they pass through unchanged (no tuple): the Counter snapshot stays byte-identical
     * @spec.adr   ADR-0020
     */
    @Test
    void primitives_pass_through_unwrapped() {
        assertThat(registry.dehydrate(7)).isEqualTo(7);
        assertThat(registry.dehydrate("parma")).isEqualTo("parma");
        assertThat(registry.dehydrate(true)).isEqualTo(true);
        assertThat(registry.dehydrate(null)).isNull();
    }

    /**
     * @spec.given a plain String-keyed map of scalars (a parent's nested prop map, ADR-0016)
     * @spec.when  it is dehydrated
     * @spec.then  it stays a plain JSON object, no tuple wrapper (the wire shape is unchanged)
     * @spec.adr   ADR-0020
     */
    @Test
    void plain_string_keyed_map_passes_through_as_json() {
        Object out = registry.dehydrate(Map.of("id", 7, "name", "parma"));

        assertThat(out).isInstanceOf(Map.class);
        assertThat(Dehydrated.isEnvelope(out)).isFalse();
        assertThat(((Map<?, ?>) out).get("name")).isEqualTo("parma");
    }

    /**
     * @spec.given an enum value
     * @spec.when  it is dehydrated then hydrated
     * @spec.then  it round-trips to the exact enum constant, not a String (the EnumSynth)
     * @spec.adr   ADR-0020
     */
    @Test
    void enum_round_trips_to_the_exact_constant() {
        Object tuple = registry.dehydrate(Status.ACTIVE);

        assertThat(Dehydrated.isEnvelope(tuple)).isTrue();
        assertThat(registry.hydrate(tuple)).isEqualTo(Status.ACTIVE);
    }

    /**
     * @spec.given a LocalDate
     * @spec.when  it is dehydrated then hydrated
     * @spec.then  it round-trips to a LocalDate of the same value (the CarbonSynth analogue)
     * @spec.adr   ADR-0020
     */
    @Test
    void temporal_round_trips_to_the_exact_type() {
        LocalDate d = LocalDate.of(2026, 6, 18);

        assertThat(registry.hydrate(registry.dehydrate(d))).isEqualTo(d);
    }

    /**
     * @spec.given a BigDecimal with scale
     * @spec.when  it is dehydrated then hydrated
     * @spec.then  it round-trips preserving scale (a money VO survives, unlike a double)
     * @spec.adr   ADR-0020
     */
    @Test
    void big_decimal_round_trips_preserving_scale() {
        BigDecimal price = new BigDecimal("1299.00");

        Object hydrated = registry.hydrate(registry.dehydrate(price));
        assertThat(hydrated).isEqualTo(price);
        assertThat(((BigDecimal) hydrated).scale()).isEqualTo(2);
    }

    /**
     * @spec.given a record holding a BigDecimal, an enum, and a List of enums (nested typed state)
     * @spec.when  it is dehydrated then hydrated
     * @spec.then  every level reconstructs by type: the record, its money, its status, and each
     *     element of the history list (the recursive StdClassSynth analogue, the kit-CRUD VO)
     * @spec.adr   ADR-0020
     */
    @Test
    void nested_record_round_trips_every_level_by_type() {
        Listing original =
                new Listing(
                        "Villa",
                        new BigDecimal("450000.00"),
                        Status.ACTIVE,
                        List.of(Status.DRAFT, Status.ACTIVE));

        Object dehydrated = registry.dehydrate(original);
        Object hydrated = registry.hydrate(dehydrated);

        assertThat(hydrated).isInstanceOf(Listing.class);
        Listing back = (Listing) hydrated;
        assertThat(back).isEqualTo(original);
        assertThat(back.status()).isInstanceOf(Status.class);
        assertThat(back.history()).containsExactly(Status.DRAFT, Status.ACTIVE);
    }

    /**
     * @spec.given a Set of enums
     * @spec.when  it is dehydrated then hydrated
     * @spec.then  it round-trips as a Set (a JSON array has no Set form; the CollectionSynth marks it)
     * @spec.adr   ADR-0020
     */
    @Test
    void set_round_trips_as_a_set() {
        Set<Status> original = Set.of(Status.DRAFT, Status.ARCHIVED);

        Object hydrated = registry.hydrate(registry.dehydrate(original));

        assertThat(hydrated).isInstanceOf(Set.class);
        assertThat((Set<Object>) hydrated)
                .containsExactlyInAnyOrder(Status.DRAFT, Status.ARCHIVED);
    }

    /**
     * @spec.given a Wireable value object
     * @spec.when  it is dehydrated then hydrated
     * @spec.then  the toWire/fromWire pair round-trips it (preferred over reflection, native-safe)
     * @spec.adr   ADR-0020
     */
    @Test
    void wireable_round_trips_via_to_and_from_wire() {
        Distance original = new Distance(1500);

        assertThat(registry.hydrate(registry.dehydrate(original))).isEqualTo(original);
    }

    /**
     * @spec.given a record whose value is a Money VO (a plain record nested in a record)
     * @spec.when  it round-trips
     * @spec.then  the nested record reconstructs by type
     * @spec.adr   ADR-0020
     */
    @Test
    void record_with_nested_record_round_trips() {
        record Order(String id, Money total) {}
        Order original = new Order("o-1", new Money(1299, "EUR"));

        Object hydrated = registry.hydrate(registry.dehydrate(original));

        assertThat(((Order) hydrated).total()).isEqualTo(new Money(1299, "EUR"));
    }

    /**
     * @spec.given a LocalDate field declared type and a raw ISO date string (an input type=date)
     * @spec.when  the typed-update path coerces the raw value
     * @spec.then  it becomes a LocalDate, not a String (the wire:model typed-update path)
     * @spec.adr   ADR-0020
     */
    @Test
    void typed_update_coerces_a_raw_date_string_to_local_date() {
        Object coerced = registry.hydrateForUpdate(LocalDate.class, "2026-06-18");

        assertThat(coerced).isEqualTo(LocalDate.of(2026, 6, 18));
    }

    /**
     * @spec.given an enum field declared type and a raw enum-name string (a select)
     * @spec.when  the typed-update path coerces the raw value
     * @spec.then  it becomes the enum constant via valueOf (the canonical EnumSynth update path)
     * @spec.adr   ADR-0020
     */
    @Test
    void typed_update_coerces_a_raw_select_string_to_the_enum() {
        Object coerced = registry.hydrateForUpdate(Status.class, "ARCHIVED");

        assertThat(coerced).isEqualTo(Status.ARCHIVED);
    }

    /**
     * @spec.given a tuple whose synth key is not registered
     * @spec.when  it is hydrated
     * @spec.then  it is refused FORBIDDEN_DESERIALIZATION, never reconstructing an unknown shape
     * @spec.adr   ADR-0020
     */
    @Test
    void hydrate_refuses_an_unknown_synth_key() {
        Object tuple = new Dehydrated("x", "no-such-synth", null).toEnvelope();

        assertThatThrownBy(() -> registry.hydrate(tuple))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.FORBIDDEN_DESERIALIZATION);
    }

    /**
     * @spec.given an opaque non-scalar Java object with no matching synth
     * @spec.when  it is dehydrated
     * @spec.then  it is refused FORBIDDEN_DESERIALIZATION (no opaque object rides the wire)
     * @spec.adr   ADR-0020
     */
    @Test
    void dehydrate_refuses_an_unmatched_opaque_object() {
        assertThatThrownBy(() -> registry.dehydrate(new Object()))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.FORBIDDEN_DESERIALIZATION);
    }

    /**
     * @spec.given a user map whose key is literally the reserved envelope key {@code @w} mapping to a
     *     map (the exact shape a structural detector mistakes for a typed-state tuple)
     * @spec.when  it is dehydrated then hydrated
     * @spec.then  it round-trips as plain DATA, never reconstructed as a smuggled typed tuple: the
     *     reserved key is escaped on the wire and restored on the way back, so the WIRE-11/WIRE-14
     *     invariant "a plain map can never smuggle a typed object" is literally true
     * @spec.adr   ADR-0020
     */
    @Test
    void user_map_keyed_literally_w_round_trips_as_data_not_a_smuggled_tuple() {
        Map<String, Object> hostile = new java.util.LinkedHashMap<>();
        hostile.put(Dehydrated.ENVELOPE, Map.of("s", "no-such-synth", "d", "owned"));

        Object dehydrated = registry.dehydrate(hostile);

        // On the wire the reserved key is escaped, so it is not an envelope and cannot be hydrated
        // as a tuple: the user's @w is now @@w.
        assertThat(Dehydrated.isEnvelope(dehydrated)).isFalse();
        Map<String, Object> onWire = (Map<String, Object>) dehydrated;
        assertThat(onWire).containsKey("@@w");
        assertThat(onWire).doesNotContainKey(Dehydrated.ENVELOPE);

        // Hydrate restores the user's literal key and value as plain data, no synth lookup attempted.
        Object hydrated = registry.hydrate(dehydrated);
        assertThat(hydrated).isEqualTo(hostile);
    }

    /**
     * @spec.given a user map carrying both reserved sigil keys ({@code @w} and {@code @memo}) and a
     *     plain key alongside them
     * @spec.when  it round-trips
     * @spec.then  both reserved keys survive as data and the plain key is untouched (the escape is
     *     scoped to the reserved sigil namespace, not arbitrary keys)
     * @spec.adr   ADR-0020
     */
    @Test
    void user_map_with_reserved_sigil_keys_round_trips_intact() {
        Map<String, Object> hostile = new java.util.LinkedHashMap<>();
        hostile.put("@w", "a");
        hostile.put("@memo", "b");
        hostile.put("name", "parma");

        Object hydrated = registry.hydrate(registry.dehydrate(hostile));

        assertThat(hydrated).isEqualTo(hostile);
    }

    /**
     * @spec.given a DynamicObject (the schemaless stdClass analogue) holding a key literally named
     *     {@code @w}
     * @spec.when  it is dehydrated then hydrated
     * @spec.then  the dynamic object round-trips with its literal {@code @w} key as plain data, the
     *     invariant "a DynamicObject can never smuggle a typed object" holds for hostile keys too
     * @spec.adr   ADR-0020
     */
    @Test
    void dynamic_object_keyed_literally_w_round_trips_as_data() {
        DynamicObject obj = new DynamicObject();
        obj.set(Dehydrated.ENVELOPE, "owned");

        Object dehydrated = registry.dehydrate(obj);
        assertThat(Dehydrated.isEnvelope(dehydrated)).isTrue(); // the dyn tuple itself IS an envelope

        Object hydrated = registry.hydrate(dehydrated);
        assertThat(hydrated).isInstanceOf(DynamicObject.class);
        assertThat(((DynamicObject) hydrated).get(Dehydrated.ENVELOPE)).isEqualTo("owned");
    }
}
