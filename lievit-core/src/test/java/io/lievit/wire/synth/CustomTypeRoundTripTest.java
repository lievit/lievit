/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire.synth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.wire.WireError;
import io.lievit.wire.WireException;

/**
 * Specifies custom serializable property types (issue #139) and the schemaless dynamic object
 * (issue #137) at the registry level: a {@link Wireable} type controls its own round-trip, a
 * Wireable nesting another Wireable round-trips every level, the hydrate path type-checks the stored
 * class and refuses a forged / dangerous {@code t}, and a {@link DynamicObject} round-trips as plain
 * JSON. Built on the ADR-0020 registry + the ADR-0021 instantiation guard (no deserialization hole).
 */
@SuppressWarnings("unchecked")
class CustomTypeRoundTripTest {

    private final SynthesizerRegistry registry = new SynthesizerRegistry();

    // A user value object that opts into round-trip by implementing Wireable.
    public record Money(long cents, String currency) implements Wireable {
        @Override
        public Object toWire() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("cents", cents);
            m.put("currency", currency);
            return m;
        }

        public static Money fromWire(Object data) {
            Map<String, Object> m = (Map<String, Object>) data;
            return new Money(((Number) m.get("cents")).longValue(), (String) m.get("currency"));
        }
    }

    // A Wireable that nests another Wireable: proves recursion through the custom-type path.
    public record Invoice(String number, Money total) implements Wireable {
        @Override
        public Object toWire() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("number", number);
            m.put("total", total); // a nested Wireable, dehydrated recursively by the registry
            return m;
        }

        public static Invoice fromWire(Object data) {
            Map<String, Object> m = (Map<String, Object>) data;
            return new Invoice((String) m.get("number"), (Money) m.get("total"));
        }
    }

    /**
     * @spec.given a user value object implementing Wireable
     * @spec.when  it is dehydrated then hydrated through the registry
     * @spec.then  the exact type and value are reconstructed (a custom type round-trips, issue #139)
     * @spec.adr   ADR-0020
     */
    @Test
    void custom_wireable_type_round_trips_exactly() {
        Money money = new Money(1995, "EUR");

        Object wire = registry.dehydrate(money);
        Object back = registry.hydrate(wire);

        assertThat(back).isInstanceOf(Money.class).isEqualTo(money);
    }

    /**
     * @spec.given a Wireable whose wire form nests another Wireable
     * @spec.when  it is dehydrated then hydrated
     * @spec.then  every level reconstructs to its exact type: nested custom types round-trip (#139)
     * @spec.adr   ADR-0020
     */
    @Test
    void nested_wireable_round_trips_every_level() {
        Invoice invoice = new Invoice("INV-1", new Money(5000, "EUR"));

        Object wire = registry.dehydrate(invoice);
        Object back = registry.hydrate(wire);

        assertThat(back).isInstanceOf(Invoice.class).isEqualTo(invoice);
        assertThat(((Invoice) back).total()).isInstanceOf(Money.class);
    }

    /**
     * @spec.given a forged wireable tuple naming a denied class in its concrete-type tag
     * @spec.when  the registry hydrates it
     * @spec.then  the class-instantiation guard refuses it as FORBIDDEN_DESERIALIZATION before any
     *     reflection, so the custom-type path is not a class-instantiation gadget (#139, ADR-0021)
     * @spec.adr   ADR-0021
     */
    @Test
    void hydrate_refuses_a_tuple_naming_a_denied_class() {
        Map<String, Object> inner = new LinkedHashMap<>();
        inner.put(Dehydrated.DATA, Map.of());
        inner.put(Dehydrated.SYNTH, "wireable");
        inner.put(Dehydrated.TYPE, "java.lang.Runtime");
        Map<String, Object> forged = Map.of(Dehydrated.ENVELOPE, inner);

        assertThatThrownBy(() -> registry.hydrate(forged))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.FORBIDDEN_DESERIALIZATION);
    }

    /**
     * @spec.given a forged tuple naming an application class that does NOT implement Wireable but
     *     claims the "wireable" synth
     * @spec.when  the registry hydrates it
     * @spec.then  the synth type-checks the stored class and refuses it: the hydrate validates the
     *     stored type implements the interface (#139 acceptance), never builds a wrong type
     * @spec.adr   ADR-0020
     */
    @Test
    void hydrate_refuses_a_wireable_tuple_whose_class_is_not_wireable() {
        Map<String, Object> inner = new LinkedHashMap<>();
        inner.put(Dehydrated.DATA, Map.of());
        inner.put(Dehydrated.SYNTH, "wireable");
        inner.put(Dehydrated.TYPE, NotWireable.class.getName());
        Map<String, Object> forged = Map.of(Dehydrated.ENVELOPE, inner);

        assertThatThrownBy(() -> registry.hydrate(forged))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.FORBIDDEN_DESERIALIZATION);
    }

    /**
     * @spec.given a dynamic object holding nested keys
     * @spec.when  it is dehydrated then hydrated through the registry
     * @spec.then  it round-trips as a DynamicObject with the same paths resolvable (#137)
     * @spec.adr   ADR-0020
     */
    @Test
    void dynamic_object_round_trips_through_the_registry() {
        DynamicObject obj = new DynamicObject();
        obj.set("address.city", "Parma");
        obj.set("name", "Mario");

        Object wire = registry.dehydrate(obj);
        Object back = registry.hydrate(wire);

        assertThat(back).isInstanceOf(DynamicObject.class);
        DynamicObject result = (DynamicObject) back;
        assertThat(result.get("address.city")).isEqualTo("Parma");
        assertThat(result.get("name")).isEqualTo("Mario");
    }

    /**
     * @spec.given a dynamic object's dehydrated form
     * @spec.when  it is inspected
     * @spec.then  the data is a plain JSON map under a `dyn` tuple with no concrete-type tag: a
     *     dynamic object reconstructs by key alone, so it triggers no reflective instantiation (#137)
     * @spec.adr   ADR-0020
     */
    @Test
    void dynamic_object_dehydrates_to_a_typeless_tuple() {
        DynamicObject obj = new DynamicObject();
        obj.set("k", "v");

        Map<String, Object> wire = (Map<String, Object>) registry.dehydrate(obj);
        Map<String, Object> inner = (Map<String, Object>) wire.get(Dehydrated.ENVELOPE);

        assertThat(inner.get(Dehydrated.SYNTH)).isEqualTo("dyn");
        assertThat(inner).doesNotContainKey(Dehydrated.TYPE);
        assertThat(inner.get(Dehydrated.DATA)).isInstanceOf(Map.class);
    }

    // A plain class that is not Wireable, used to prove the hydrate type-check rejects it.
    public static final class NotWireable {
        public NotWireable() {}
    }
}
