/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.LievitComponent;
import dev.lievit.LievitOn;
import dev.lievit.Wire;
import dev.lievit.wire.PayloadGuard;
import dev.lievit.wire.synth.SynthesizerRegistry;

/**
 * Pins the receiving half of the event system (ADR-0030, #43): {@code @LievitOn} listeners are
 * reflected, an inbound event invokes the matching handler with its payload, a dynamic-placeholder
 * name resolves against component state, a class-level listener is a bare {@code $refresh}, and a
 * listener method is not a frontend action.
 */
class EventListenerTest {

    @LievitComponent
    static class Inbox {
        @Wire int lastSavedId = -1;
        @Wire String note = "";

        @LievitOn("saved")
        void onSaved(int id) {
            this.lastSavedId = id;
        }

        @LievitOn("note-set")
        void onNote(String note) {
            this.note = note;
        }
    }

    @LievitComponent
    static class ScopedInbox {
        @Wire int postId = 7;
        @Wire boolean touched;

        @LievitOn("post.{postId}.saved")
        void onSaved() {
            this.touched = true;
        }
    }

    @LievitComponent
    @LievitOn("refresh-list")
    static class ClassLevel {
        @Wire int n;
    }

    @LievitComponent
    static class TwoListeners {
        @Wire String log = "";

        @LievitOn("saved")
        void auditSaved() {
            this.log += "audit;";
        }

        @LievitOn("saved")
        void notifySaved() {
            this.log += "notify;";
        }
    }

    @LievitComponent
    static class MultiName {
        @Wire int n;

        @LievitOn({"saved", "stored"})
        void onEither() {
            this.n++;
        }
    }

    private WireDispatcher dispatcher() {
        return new WireDispatcher(
                new PayloadGuard(), NoOpFieldValidator.INSTANCE, new SynthesizerRegistry(),
                new LifecycleBus());
    }

    /**
     * @spec.given an Inbox listening for "saved" with an int handler
     * @spec.when  a wire call carries an inbound "saved" event with detail {id: 42}
     * @spec.then  the handler runs and sets lastSavedId to 42
     * @spec.adr   ADR-0030
     */
    @Test
    void an_inbound_event_invokes_the_matching_handler_with_payload() {
        ComponentMetadata meta = ComponentMetadata.of(Inbox.class);
        WireCall result = dispatcher().call(
                meta, new Inbox(), Map.of("lastSavedId", -1, "note", ""), Map.of(), List.of(),
                List.of(new InboundEvent("saved", Map.of("id", 42))));
        assertThat(result.wire()).containsEntry("lastSavedId", 42);
    }

    /**
     * @spec.given an Inbox listening for "note-set" with a single String handler
     * @spec.when  a wire call carries the event with a single-value detail
     * @spec.then  the value is bound to the single parameter
     * @spec.adr   ADR-0030
     */
    @Test
    void a_single_value_detail_binds_to_a_single_parameter() {
        ComponentMetadata meta = ComponentMetadata.of(Inbox.class);
        WireCall result = dispatcher().call(
                meta, new Inbox(), Map.of("lastSavedId", -1, "note", ""), Map.of(), List.of(),
                List.of(new InboundEvent("note-set", Map.of("note", "hi"))));
        assertThat(result.wire()).containsEntry("note", "hi");
    }

    /**
     * @spec.given a component listening on the dynamic name "post.{postId}.saved" with postId=7
     * @spec.when  a wire call carries an event named "post.7.saved"
     * @spec.then  the placeholder resolved to 7, the listener matched, and the handler ran
     * @spec.adr   ADR-0030
     */
    @Test
    void a_dynamic_placeholder_name_resolves_against_state() {
        ComponentMetadata meta = ComponentMetadata.of(ScopedInbox.class);
        WireCall result = dispatcher().call(
                meta, new ScopedInbox(),
                Map.of("postId", 7, "touched", false), Map.of(), List.of(),
                List.of(new InboundEvent("post.7.saved", null)));
        assertThat(result.wire()).containsEntry("touched", true);
    }

    /**
     * @spec.given a class-level @LievitOn("refresh-list") listener (no handler method)
     * @spec.when  the event metadata resolves the listener
     * @spec.then  the listener is present with a null handler (a bare $refresh)
     * @spec.adr   ADR-0030
     */
    @Test
    void a_class_level_listener_is_a_bare_refresh() {
        EventListenerMetadata meta = EventListenerMetadata.of(ClassLevel.class);
        List<EventListenerMetadata.ResolvedListener> resolved = meta.resolve(new ClassLevel());
        assertThat(resolved).singleElement()
                .satisfies(listener -> {
                    assertThat(listener.name()).isEqualTo("refresh-list");
                    assertThat(listener.handler()).isNull();
                });
    }

    /**
     * @spec.given a component with TWO @LievitOn("saved") handlers (audit and notify)
     * @spec.when  a wire call carries one inbound "saved" event
     * @spec.then  BOTH handlers fire (not just the last-declared one the old map collapsed onto)
     * @spec.adr   ADR-0030
     */
    @Test
    void two_handlers_for_one_event_both_fire() {
        ComponentMetadata meta = ComponentMetadata.of(TwoListeners.class);
        WireCall result = dispatcher().call(
                meta, new TwoListeners(), Map.of("log", ""), Map.of(), List.of(),
                List.of(new InboundEvent("saved", null)));
        // Both ran: the bug dropped one (a Map<name, handler> kept only the last). Method order
        // across distinct methods is not a JVM guarantee (getDeclaredMethods is unordered), so we
        // assert both fired, not their relative order.
        assertThat(result.wire().get("log").toString())
                .contains("audit;")
                .contains("notify;");
    }

    /**
     * @spec.given a single @LievitOn({"saved","stored"}) method (two names, one handler)
     * @spec.when  the listeners are resolved against an instance
     * @spec.then  both names appear, in the array's declaration order (a stable, source-ordered case)
     * @spec.adr   ADR-0030
     */
    @Test
    void multiple_names_on_one_listener_resolve_in_array_order() {
        EventListenerMetadata meta = EventListenerMetadata.of(MultiName.class);
        List<EventListenerMetadata.ResolvedListener> resolved = meta.resolve(new MultiName());
        assertThat(resolved).extracting(EventListenerMetadata.ResolvedListener::name)
                .containsExactly("saved", "stored");
    }

    /**
     * @spec.given a component with an @LievitOn handler method
     * @spec.when  the component metadata is reflected
     * @spec.then  the handler is NOT exposed as an @LievitAction (cannot be called directly)
     * @spec.adr   ADR-0030
     */
    @Test
    void an_event_handler_is_not_a_frontend_action() {
        ComponentMetadata meta = ComponentMetadata.of(Inbox.class);
        assertThat(meta.action("onSaved")).isNull();
    }
}
