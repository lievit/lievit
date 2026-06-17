/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitComputed;
import io.lievit.Wire;

/**
 * Specifies the {@code @LievitComputed} integration with the {@link WireDispatcher} lifecycle
 * (ADR-0015): a computed method runs at most once per wire call, recomputes on the next call,
 * its value appears in the {@link WireCall#computed()} map (template-adapter contract), is absent
 * from the snapshot {@link WireCall#wire()} map (never serialized), and the cache is cleaned up
 * so no state leaks between calls.
 */
class ComputedCacheDispatcherInvariantTest {

    private final WireDispatcher dispatcher = new WireDispatcher();

    /**
     * A Cart component whose totalPrice is a @LievitComputed method. The invocation count lets
     * us assert the single-invocation guarantee.
     */
    @LievitComponent
    static class Cart {
        @Wire int unitPrice = 10;
        @Wire int quantity  = 3;

        final AtomicInteger computeCallCount = new AtomicInteger();

        @LievitComputed
        int totalPrice() {
            computeCallCount.incrementAndGet();
            return unitPrice * quantity;
        }

        @LievitAction
        void addOne() {
            this.quantity++;
        }
    }

    /**
     * @spec.given a Cart component with a @LievitComputed totalPrice method
     * @spec.when  the dispatcher mounts it
     * @spec.then  the computed value appears in WireCall.computed() under its method name
     * @spec.adr   ADR-0015
     */
    @Test
    void mount_exposes_computed_value_in_wire_call() {
        ComponentMetadata meta = ComponentMetadata.of(Cart.class);
        Cart cart = new Cart();

        WireCall result = dispatcher.mount(meta, cart);

        assertThat(result.computed()).containsEntry("totalPrice", 30);
    }

    /**
     * @spec.given a Cart component mounted via the dispatcher
     * @spec.when  mount runs
     * @spec.then  the totalPrice method is invoked exactly once despite the dispatcher resolving
     *     it eagerly
     * @spec.adr   ADR-0015
     */
    @Test
    void mount_invokes_computed_method_exactly_once() {
        ComponentMetadata meta = ComponentMetadata.of(Cart.class);
        Cart cart = new Cart();

        dispatcher.mount(meta, cart);

        assertThat(cart.computeCallCount.get())
                .as("computed method must be invoked exactly once per dispatcher call")
                .isEqualTo(1);
    }

    /**
     * @spec.given a Cart component with @LievitComputed totalPrice
     * @spec.when  a wire call runs the addOne action (quantity 3 -> 4)
     * @spec.then  the computed value in WireCall.computed() reflects the new state (40, not 30)
     * @spec.adr   ADR-0015
     */
    @Test
    void call_recomputes_after_state_change() {
        ComponentMetadata meta = ComponentMetadata.of(Cart.class);

        WireCall result =
                dispatcher.call(
                        meta,
                        new Cart(),
                        Map.of("unitPrice", 10, "quantity", 3),
                        Map.of(),
                        List.of("addOne"));

        assertThat(result.computed()).containsEntry("totalPrice", 40);
    }

    /**
     * @spec.given a Cart and a call that only reads totalPrice (no action mutates quantity)
     * @spec.when  the dispatcher runs the call
     * @spec.then  the computed method is invoked exactly once (not once per template reference)
     * @spec.adr   ADR-0015
     */
    @Test
    void call_invokes_computed_method_exactly_once_per_request() {
        ComponentMetadata meta = ComponentMetadata.of(Cart.class);
        Cart cart = new Cart();

        dispatcher.call(
                meta,
                cart,
                Map.of("unitPrice", 10, "quantity", 3),
                Map.of(),
                List.of());

        assertThat(cart.computeCallCount.get())
                .as("computed method must be invoked exactly once per wire call")
                .isEqualTo(1);
    }

    /**
     * @spec.given two sequential wire calls on separate Cart instances
     * @spec.when  the first call resolves totalPrice, then the second call runs
     * @spec.then  the second call's computed value is independent (fresh recomputation, no leakage)
     * @spec.adr   ADR-0015
     */
    @Test
    void computed_cache_does_not_leak_between_wire_calls() {
        ComponentMetadata meta = ComponentMetadata.of(Cart.class);

        // First call: quantity stays 3 -> totalPrice 30.
        WireCall first =
                dispatcher.call(
                        meta,
                        new Cart(),
                        Map.of("unitPrice", 10, "quantity", 3),
                        Map.of(),
                        List.of());

        // Second call: quantity is 5 -> totalPrice should be 50 on a fresh instance.
        Cart secondCart = new Cart();
        secondCart.quantity = 5;
        WireCall second =
                dispatcher.call(
                        meta,
                        secondCart,
                        Map.of("unitPrice", 10, "quantity", 5),
                        Map.of(),
                        List.of());

        assertThat(first.computed()).containsEntry("totalPrice", 30);
        assertThat(second.computed()).containsEntry("totalPrice", 50);
        assertThat(secondCart.computeCallCount.get())
                .as("second call must invoke the method once, not zero (leaked cache) or two")
                .isEqualTo(1);
    }

    /**
     * @spec.given a Cart component
     * @spec.when  the dispatcher runs a call
     * @spec.then  the computed totalPrice is NOT in WireCall.wire() — it is never serialized into
     *     the snapshot (ADR-0015: computed values are derived, not stored)
     * @spec.adr   ADR-0015
     */
    @Test
    void computed_value_is_absent_from_the_snapshot_wire_map() {
        ComponentMetadata meta = ComponentMetadata.of(Cart.class);

        WireCall result =
                dispatcher.call(
                        meta,
                        new Cart(),
                        Map.of("unitPrice", 10, "quantity", 3),
                        Map.of(),
                        List.of());

        assertThat(result.wire())
                .as("computed values must never appear in the snapshot wire map")
                .doesNotContainKey("totalPrice");
        assertThat(result.wire()).containsKey("unitPrice").containsKey("quantity");
    }

    /**
     * @spec.given a component class with a @LievitComputed method that has parameters
     * @spec.when  ComponentMetadata.of() reflects it
     * @spec.then  it throws IllegalArgumentException: a computed method must be no-arg (ADR-0015)
     * @spec.adr   ADR-0015
     */
    @Test
    void metadata_rejects_a_computed_method_with_parameters() {
        assertThatThrownBy(
                        () ->
                                ComponentMetadata.of(
                                        ComputedWithArg.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no-arg");
    }

    /**
     * @spec.given a component class with a @LievitComputed void method
     * @spec.when  ComponentMetadata.of() reflects it
     * @spec.then  it throws IllegalArgumentException: a computed method must return a value
     * @spec.adr   ADR-0015
     */
    @Test
    void metadata_rejects_a_void_computed_method() {
        assertThatThrownBy(
                        () ->
                                ComponentMetadata.of(
                                        ComputedVoid.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("void");
    }

    // --- helpers for the error-path tests ---

    @LievitComponent
    static class ComputedWithArg {
        @Wire int x;

        @LievitComputed
        int bad(int ignored) {
            return x;
        }
    }

    @LievitComponent
    static class ComputedVoid {
        @Wire int x;

        @LievitComputed
        void bad() {
            // void is not a valid return type for a computed property
        }
    }
}
