/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.Wire;
import io.lievit.wire.WireError;
import io.lievit.wire.WireException;
import io.lievit.wire.synth.Dehydrated;
import io.lievit.wire.synth.Wireable;

/**
 * Pins the custom-serializable-type round-trip through the full dispatcher (issue #139): a
 * {@code @Wire} field holding a user {@link Wireable} value object dehydrates to a tuple and
 * rehydrates to the exact type across a wire call, while a forged snapshot whose tuple names a
 * dangerous class is refused before any reflective construction (ADR-0021, no deserialization hole).
 */
class CustomTypeDispatcherTest {

    private final WireDispatcher dispatcher = new WireDispatcher();

    public record Money(long cents, String currency) implements Wireable {
        @Override
        public Object toWire() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("cents", cents);
            m.put("currency", currency);
            return m;
        }

        @SuppressWarnings("unchecked")
        public static Money fromWire(Object data) {
            Map<String, Object> m = (Map<String, Object>) data;
            return new Money(((Number) m.get("cents")).longValue(), (String) m.get("currency"));
        }
    }

    @LievitComponent
    static class PriceEditor {
        @Wire Money price = new Money(1000, "EUR");

        @LievitAction
        void bump() {
            this.price = new Money(price.cents() + 500, price.currency());
        }
    }

    /**
     * @spec.given a component with a @Wire field of a user Wireable type
     * @spec.when  it is mounted
     * @spec.then  the wire carries a `wireable` tuple tagged with the concrete type, not a bare map
     * @spec.adr   ADR-0020
     */
    @Test
    void mount_dehydrates_a_custom_wireable_field_to_a_typed_tuple() {
        ComponentMetadata meta = ComponentMetadata.of(PriceEditor.class);

        Map<String, Object> wire = dispatcher.mount(meta, new PriceEditor()).wire();

        @SuppressWarnings("unchecked")
        Map<String, Object> inner = (Map<String, Object>) ((Map<String, Object>) wire.get("price"))
                .get(Dehydrated.ENVELOPE);
        assertThat(inner.get(Dehydrated.SYNTH)).isEqualTo("wireable");
        assertThat(inner.get(Dehydrated.TYPE)).isEqualTo(Money.class.getName());
    }

    /**
     * @spec.given a snapshot carrying a custom Wireable field and an action that mutates it
     * @spec.when  the dispatcher runs a wire call that invokes the action
     * @spec.then  the field rehydrated to the exact Money type (the action could call price.cents()),
     *     and the new value round-trips as a Money tuple: a custom type survives a wire call (#139)
     * @spec.adr   ADR-0020
     */
    @Test
    void custom_wireable_field_round_trips_across_a_wire_call() {
        ComponentMetadata meta = ComponentMetadata.of(PriceEditor.class);
        Map<String, Object> snapshotWire = dispatcher.mount(meta, new PriceEditor()).wire();

        WireCall result =
                dispatcher.call(meta, new PriceEditor(), snapshotWire, Map.of(), List.of("bump"));

        @SuppressWarnings("unchecked")
        Map<String, Object> inner = (Map<String, Object>) ((Map<String, Object>) result.wire().get("price"))
                .get(Dehydrated.ENVELOPE);
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) inner.get(Dehydrated.DATA);
        // bump() added 500 cents: the field rehydrated to Money, not a LinkedHashMap.
        assertThat(((Number) data.get("cents")).longValue()).isEqualTo(1500L);
        assertThat(data.get("currency")).isEqualTo("EUR");
    }

    /**
     * @spec.given a forged snapshot whose price tuple names java.lang.Runtime as its concrete type
     * @spec.when  the dispatcher rehydrates it
     * @spec.then  the class-instantiation guard refuses it as FORBIDDEN_DESERIALIZATION, so a forged
     *     snapshot cannot turn the custom-type path into a gadget (#139 security, ADR-0021)
     * @spec.adr   ADR-0021
     */
    @Test
    void forged_snapshot_naming_a_dangerous_class_is_refused_on_rehydrate() {
        ComponentMetadata meta = ComponentMetadata.of(PriceEditor.class);
        Map<String, Object> inner = new LinkedHashMap<>();
        inner.put(Dehydrated.DATA, Map.of());
        inner.put(Dehydrated.SYNTH, "wireable");
        inner.put(Dehydrated.TYPE, "java.lang.Runtime");
        Map<String, Object> forgedWire = Map.of("price", Map.of(Dehydrated.ENVELOPE, inner));

        assertThatThrownBy(
                        () -> dispatcher.call(meta, new PriceEditor(), forgedWire, Map.of(), List.of()))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.FORBIDDEN_DESERIALIZATION);
    }
}
