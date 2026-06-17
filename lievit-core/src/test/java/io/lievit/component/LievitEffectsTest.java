/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.Wire;

/**
 * Specifies the effects channel at the dispatcher level (ADR-0012): an action queues a redirect, a
 * dispatch, or returns a value, and the {@link WireCall} carries those effects out; a plain action
 * produces an empty sink, and the per-call sink is reset between calls (the ADR-0001 statelessness
 * invariant). Plus the sink-binding contract: {@link LievitEffects#current()} outside a call fails.
 */
class LievitEffectsTest {

    private final WireDispatcher dispatcher = new WireDispatcher();

    @LievitComponent
    static class Effectful {
        @Wire int count;

        @LievitAction
        void plain() {
            this.count++;
        }

        @LievitAction
        void save() {
            LievitEffects.current().dispatch("saved", Map.of("id", 7));
        }

        @LievitAction
        void leave() {
            LievitEffects.current().redirect("/done");
        }

        @LievitAction
        int total() {
            this.count += 10;
            return this.count;
        }
    }

    /**
     * @spec.given an Effectful component whose action only mutates @Wire state
     * @spec.when  the dispatcher runs the plain action
     * @spec.then  the call's effects sink is empty (a no-effects action omits the header downstream)
     * @spec.adr   ADR-0012
     */
    @Test
    void a_plain_action_produces_no_effects() {
        ComponentMetadata meta = ComponentMetadata.of(Effectful.class);

        WireCall call =
                dispatcher.call(meta, new Effectful(), Map.of("count", 0), Map.of(), List.of("plain"));

        assertThat(call.effects().isEmpty()).isTrue();
        assertThat(call.wire()).containsEntry("count", 1);
    }

    /**
     * @spec.given an action that calls redirect() on the current effects sink
     * @spec.when  the dispatcher runs it
     * @spec.then  the call carries the redirect effect
     * @spec.adr   ADR-0012
     */
    @Test
    void an_action_can_request_a_redirect() {
        ComponentMetadata meta = ComponentMetadata.of(Effectful.class);

        WireCall call =
                dispatcher.call(meta, new Effectful(), Map.of("count", 0), Map.of(), List.of("leave"));

        assertThat(call.effects().redirect()).isEqualTo("/done");
        assertThat(call.effects().isEmpty()).isFalse();
    }

    /**
     * @spec.given an action that dispatches a named event with a detail payload
     * @spec.when  the dispatcher runs it
     * @spec.then  the call carries the dispatched event in order, name and detail intact
     * @spec.adr   ADR-0012
     */
    @Test
    void an_action_can_dispatch_an_event() {
        ComponentMetadata meta = ComponentMetadata.of(Effectful.class);

        WireCall call =
                dispatcher.call(meta, new Effectful(), Map.of("count", 0), Map.of(), List.of("save"));

        assertThat(call.effects().dispatched())
                .singleElement()
                .isEqualTo(new DispatchedEvent("saved", Map.of("id", 7)));
    }

    /**
     * @spec.given an action with a non-void return value
     * @spec.when  the dispatcher runs it
     * @spec.then  the return value is captured as the returns effect
     * @spec.adr   ADR-0012
     */
    @Test
    void a_non_void_action_return_is_captured() {
        ComponentMetadata meta = ComponentMetadata.of(Effectful.class);

        WireCall call =
                dispatcher.call(meta, new Effectful(), Map.of("count", 5), Map.of(), List.of("total"));

        assertThat(call.effects().returnValue()).isEqualTo(15);
    }

    /**
     * @spec.given two sequential wire calls on fresh instances, the first producing a redirect
     * @spec.when  the second runs a plain action
     * @spec.then  the second call's sink is empty: effects do not leak across calls (statelessness)
     * @spec.adr   ADR-0012
     */
    @Test
    void the_effects_sink_is_reset_between_calls() {
        ComponentMetadata meta = ComponentMetadata.of(Effectful.class);

        WireCall first =
                dispatcher.call(meta, new Effectful(), Map.of("count", 0), Map.of(), List.of("leave"));
        WireCall second =
                dispatcher.call(meta, new Effectful(), Map.of("count", 0), Map.of(), List.of("plain"));

        assertThat(first.effects().redirect()).isEqualTo("/done");
        assertThat(second.effects().isEmpty()).isTrue();
    }

    /**
     * @spec.given no wire call in progress (no sink bound to the thread)
     * @spec.when  LievitEffects.current() is called
     * @spec.then  it fails fast: reading the sink outside a call is a programming error
     * @spec.adr   ADR-0012
     */
    @Test
    void current_outside_a_call_fails_fast() {
        assertThatThrownBy(LievitEffects::current).isInstanceOf(IllegalStateException.class);
    }
}
