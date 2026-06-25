/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitMount;
import dev.lievit.LievitRender;
import dev.lievit.Wire;
import dev.lievit.wire.PayloadGuard;
import dev.lievit.wire.synth.SynthesizerRegistry;

/**
 * Pins the request-lifecycle interceptor bus: the dispatcher triggers the fixed, observable phases
 * in order; a listener's finish callback runs after the phase; UPDATED finishers run after ALL
 * updates; a CALL listener can early-return to skip the method; a RENDER listener can skip the
 * render; a DEHYDRATE listener can write a memo that survives the round trip (the locales pattern).
 * This is the extension architecture (ADR-0022, issue #167).
 */
class LifecycleBusInvariantTest {

    @LievitComponent
    static class Counter {
        @Wire int count;
        boolean rendered;

        @LievitMount
        void seed() {
            this.count = 0;
        }

        @LievitAction
        void increment() {
            this.count++;
        }

        @LievitRender
        void render() {
            this.rendered = true;
        }
    }

    private WireDispatcher dispatcherWith(LifecycleBus bus) {
        return new WireDispatcher(
                new PayloadGuard(), NoOpFieldValidator.INSTANCE, new SynthesizerRegistry(), bus);
    }

    /**
     * @spec.given a bus recording every phase it is triggered with on an update call
     * @spec.when  a wire call with one update and one action runs
     * @spec.then  the phases fire in the documented order: HYDRATE, UPDATE, UPDATED, CALL, RENDER,
     *     DEHYDRATE, DESTROY (the update pipeline ordering invariant)
     * @spec.adr   ADR-0022
     */
    @Test
    void update_pipeline_fires_phases_in_order() {
        List<LifecyclePhase> order = new ArrayList<>();
        LifecycleBus bus = new LifecycleBus();
        for (LifecyclePhase phase : LifecyclePhase.values()) {
            bus.on(phase, ctx -> {
                order.add(ctx.phase());
                return null;
            });
        }
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        dispatcherWith(bus)
                .call(meta, new Counter(), Map.of("count", 1), Map.of("count", 5), List.of("increment"));

        assertThat(order)
                .containsExactly(
                        LifecyclePhase.HYDRATE,
                        LifecyclePhase.UPDATE,
                        LifecyclePhase.UPDATED,
                        LifecyclePhase.CALL,
                        LifecyclePhase.RENDER,
                        LifecyclePhase.DEHYDRATE,
                        LifecyclePhase.DESTROY);
    }

    /**
     * @spec.given a bus recording the phases on a mount
     * @spec.when  a component is mounted
     * @spec.then  the mount pipeline fires MOUNT, RENDER, DEHYDRATE, DESTROY (no HYDRATE/UPDATE/CALL)
     * @spec.adr   ADR-0022
     */
    @Test
    void mount_pipeline_fires_its_own_phase_order() {
        List<LifecyclePhase> order = new ArrayList<>();
        LifecycleBus bus = new LifecycleBus();
        for (LifecyclePhase phase : LifecyclePhase.values()) {
            bus.on(phase, ctx -> {
                order.add(ctx.phase());
                return null;
            });
        }
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        dispatcherWith(bus).mount(meta, new Counter());

        assertThat(order)
                .containsExactly(
                        LifecyclePhase.MOUNT,
                        LifecyclePhase.RENDER,
                        LifecyclePhase.DEHYDRATE,
                        LifecyclePhase.DESTROY);
    }

    /**
     * @spec.given a CALL listener that requests an early return
     * @spec.when  a wire call invokes increment
     * @spec.then  the action is not dispatched (count stays the rehydrated value): the magic-action
     *     short-circuit seam
     * @spec.adr   ADR-0022
     */
    @Test
    void a_call_listener_can_early_return_to_skip_the_method() {
        LifecycleBus bus = new LifecycleBus();
        bus.on(LifecyclePhase.CALL, ctx -> {
            ctx.requestEarlyReturn();
            return null;
        });
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        WireCall result =
                dispatcherWith(bus)
                        .call(meta, new Counter(), Map.of("count", 7), Map.of(), List.of("increment"));

        // increment did NOT run (would be 8); early-return skipped it.
        assertThat(result.wire()).containsEntry("count", 7);
    }

    /**
     * @spec.given a RENDER listener that requests skip-render
     * @spec.when  a wire call runs
     * @spec.then  the render hook does not run (the renderless seam)
     * @spec.adr   ADR-0022
     */
    @Test
    void a_render_listener_can_skip_the_render() {
        LifecycleBus bus = new LifecycleBus();
        bus.on(LifecyclePhase.RENDER, ctx -> {
            ctx.requestSkipRender();
            return null;
        });
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);
        Counter instance = new Counter();

        dispatcherWith(bus).call(meta, instance, Map.of("count", 0), Map.of(), List.of("increment"));

        assertThat(instance.rendered).isFalse();
    }

    /**
     * @spec.given a listener that writes a memo on DEHYDRATE and reads it on HYDRATE
     * @spec.when  a first call dehydrates (writing "locale"=it), then a second call hydrates from the
     *     first call's wire
     * @spec.then  the second call's HYDRATE listener sees "it": the memo survived the stateless round
     *     trip in the snapshot wire (the locales / persistent-middleware pattern)
     * @spec.adr   ADR-0022
     */
    @Test
    void a_dehydrate_memo_survives_the_round_trip_to_hydrate() {
        List<String> seenOnHydrate = new ArrayList<>();
        LifecycleBus bus = new LifecycleBus();
        bus.on(LifecyclePhase.DEHYDRATE, ctx -> {
            ctx.memo().put("locale", "it");
            return null;
        });
        bus.on(LifecyclePhase.HYDRATE, ctx -> {
            Object locale = ctx.memo().get("locale");
            if (locale != null) {
                seenOnHydrate.add(locale.toString());
            }
            return null;
        });
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);
        WireDispatcher dispatcher = dispatcherWith(bus);

        WireCall first =
                dispatcher.call(meta, new Counter(), Map.of("count", 0), Map.of(), List.of());
        // The memo rode the wire under the reserved key.
        assertThat(first.wire()).containsKey(WireDispatcher.MEMO_KEY);

        dispatcher.call(meta, new Counter(), first.wire(), Map.of(), List.of());

        assertThat(seenOnHydrate).containsExactly("it");
    }

    /**
     * @spec.given an UPDATED finisher that overrides a field after all updates are applied
     * @spec.when  a call applies count=5 and the UPDATED listener forces count=99
     * @spec.then  the final state is 99: UPDATED runs after ALL updates, so it can override one
     * @spec.adr   ADR-0022
     */
    @Test
    void updated_runs_after_all_updates_so_it_can_override() {
        LifecycleBus bus = new LifecycleBus();
        bus.on(LifecyclePhase.UPDATED, ctx -> {
            ((Counter) ctx.instance()).count = 99;
            return null;
        });
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        WireCall result =
                dispatcherWith(bus)
                        .call(meta, new Counter(), Map.of("count", 0), Map.of("count", 5), List.of());

        assertThat(result.wire()).containsEntry("count", 99);
    }

    /**
     * @spec.given a listener whose before() returns a finish callback
     * @spec.when  the phase is triggered
     * @spec.then  the finish callback runs after the phase (the finish-callback semantics)
     * @spec.adr   ADR-0022
     */
    @Test
    void a_listener_finish_callback_runs_after_the_phase() {
        List<String> trace = new ArrayList<>();
        LifecycleBus bus = new LifecycleBus();
        bus.on(LifecyclePhase.RENDER, ctx -> {
            trace.add("before-render");
            return () -> trace.add("finish-render");
        });
        // Mark when the render hook itself runs by ordering: the Counter sets rendered in render().
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        dispatcherWith(bus).call(meta, new Counter(), Map.of("count", 0), Map.of(), List.of());

        assertThat(trace).containsExactly("before-render", "finish-render");
    }
}
