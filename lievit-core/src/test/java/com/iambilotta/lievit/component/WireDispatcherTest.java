/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.iambilotta.lievit.LievitAction;
import com.iambilotta.lievit.LievitComponent;
import com.iambilotta.lievit.LievitMount;
import com.iambilotta.lievit.LievitProperty;
import com.iambilotta.lievit.Wire;
import com.iambilotta.lievit.wire.WireError;
import com.iambilotta.lievit.wire.WireException;

/**
 * Specifies the stateless lifecycle engine: mount seeds state, a wire call rehydrates + applies
 * updates + invokes actions, a locked field rejects client updates, and an unknown action is a
 * gone-component (ADR-0001, ADR-0002, the ADR-0001 locked amendment).
 */
class WireDispatcherTest {

    private final WireDispatcher dispatcher = new WireDispatcher();

    @LievitComponent(template = "counter")
    static class Counter {
        @Wire int count;

        @LievitMount
        void seed() {
            this.count = 0;
        }

        @LievitAction
        void increment() {
            this.count++;
        }
    }

    @LievitComponent
    static class Cart {
        @Wire @LievitProperty(locked = true) String cartId = "server-owned";
        @Wire int quantity;

        @LievitAction
        void addOne() {
            this.quantity++;
        }
    }

    /**
     * @spec.given a freshly constructed Counter component with a {@code @LievitMount} hook
     * @spec.when  the dispatcher mounts it
     * @spec.then  the mount hook runs and the initial {@code @Wire} state is read back
     * @spec.adr   ADR-0001
     */
    @Test
    void mount_runs_the_mount_hook_and_reads_initial_state() {
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        Map<String, Object> wire = dispatcher.mount(meta, new Counter());

        assertThat(wire).containsEntry("count", 0);
    }

    /**
     * @spec.given a Counter rehydrated from a snapshot whose count is 7
     * @spec.when  the dispatcher applies the increment action
     * @spec.then  the read-back state carries count 8 (state survived the stateless round trip)
     * @spec.adr   ADR-0001
     */
    @Test
    void call_rehydrates_then_invokes_the_action() {
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        WireCall result =
                dispatcher.call(
                        meta,
                        new Counter(),
                        Map.of("count", 7),
                        Map.of(),
                        List.of("increment"));

        assertThat(result.wire()).containsEntry("count", 8);
    }

    /**
     * @spec.given a Counter rehydrated at count 7 plus a client update setting count to 100
     * @spec.when  the dispatcher applies the update then increments
     * @spec.then  the update is honored (unlocked field): count becomes 101
     * @spec.adr   ADR-0001
     */
    @Test
    void call_applies_an_unlocked_client_update() {
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        WireCall result =
                dispatcher.call(
                        meta,
                        new Counter(),
                        Map.of("count", 7),
                        Map.of("count", 100),
                        List.of("increment"));

        assertThat(result.wire()).containsEntry("count", 101);
    }

    /**
     * @spec.given a Cart whose cartId is a locked @LievitProperty and a client update that tries to
     *     overwrite it
     * @spec.when  the dispatcher applies the updates
     * @spec.then  it rejects the call with LOCKED_PROPERTY (403): the snapshot signature does not
     *     stop the first POST from writing a server-owned field; the lock does
     * @spec.adr   ADR-0001
     */
    @Test
    void call_rejects_a_client_update_to_a_locked_field() {
        ComponentMetadata meta = ComponentMetadata.of(Cart.class);

        assertThatThrownBy(
                        () ->
                                dispatcher.call(
                                        meta,
                                        new Cart(),
                                        Map.of("cartId", "server-owned", "quantity", 1),
                                        Map.of("cartId", "attacker-owned"),
                                        List.of("addOne")))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.LOCKED_PROPERTY);
    }

    /**
     * @spec.given a Cart and a client update to the unlocked quantity field
     * @spec.when  the dispatcher applies it
     * @spec.then  the unlocked update is honored while the locked cartId stays server-owned
     * @spec.adr   ADR-0001
     */
    @Test
    void call_honors_unlocked_fields_while_locking_others() {
        ComponentMetadata meta = ComponentMetadata.of(Cart.class);

        WireCall result =
                dispatcher.call(
                        meta,
                        new Cart(),
                        Map.of("cartId", "server-owned", "quantity", 1),
                        Map.of("quantity", 5),
                        List.of("addOne"));

        assertThat(result.wire()).containsEntry("quantity", 6).containsEntry("cartId", "server-owned");
    }

    /**
     * @spec.given a Counter and a call naming a method that is not a @LievitAction
     * @spec.when  the dispatcher runs the call
     * @spec.then  it is an UNKNOWN_COMPONENT (410): the named action does not exist on this build
     * @spec.adr   ADR-0001
     */
    @Test
    void call_rejects_an_unknown_action() {
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        assertThatThrownBy(
                        () ->
                                dispatcher.call(
                                        meta,
                                        new Counter(),
                                        Map.of("count", 0),
                                        Map.of(),
                                        List.of("nonexistent")))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.UNKNOWN_COMPONENT);
    }

    /**
     * @spec.given a Counter class
     * @spec.when  its metadata is reflected
     * @spec.then  the @Wire count field and the increment action are discovered, template is set
     * @spec.adr   ADR-0002
     */
    @Test
    void metadata_reflects_wire_fields_actions_and_template() {
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        assertThat(meta.wireFields()).containsKey("count");
        assertThat(meta.action("increment")).isNotNull();
        assertThat(meta.template()).isEqualTo("counter");
        assertThat(meta.className()).isEqualTo(Counter.class.getName());
    }
}
