/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.Wire;
import io.lievit.wire.PayloadGuard;
import io.lievit.wire.synth.SynthesizerRegistry;

/**
 * Pins the convention-named lifecycle hooks dispatched through the bus (ADR-0030): the call order on
 * a wire call, that {@code updating} sees the old value and {@code updated} the new, that
 * per-property {@code updatedFoo} fires for the {@code foo} field, and that a hook is not a frontend
 * action.
 */
class LifecycleHooksTest {

    static final List<String> TRACE = new ArrayList<>();

    @LievitComponent
    static class Hooked {
        @Wire int count;
        int oldSeenByUpdating = -1;
        int newSeenByUpdatedCount = -1;

        void boot() {
            TRACE.add("boot");
        }

        void booted() {
            TRACE.add("booted");
        }

        void hydrate() {
            TRACE.add("hydrate");
        }

        void dehydrate() {
            TRACE.add("dehydrate");
        }

        void updating() {
            TRACE.add("updating");
            this.oldSeenByUpdating = this.count;
        }

        void updated() {
            TRACE.add("updated");
        }

        void updatedCount(Object value) {
            TRACE.add("updatedCount");
            this.newSeenByUpdatedCount = this.count;
        }

        void rendering() {
            TRACE.add("rendering");
        }

        void rendered() {
            TRACE.add("rendered");
        }

        @LievitAction
        void increment() {
            this.count++;
        }
    }

    private WireDispatcher dispatcher() {
        LifecycleBus bus = LifecycleHooksListener.registerOn(new LifecycleBus());
        return new WireDispatcher(
                new PayloadGuard(), NoOpFieldValidator.INSTANCE, new SynthesizerRegistry(), bus);
    }

    /**
     * @spec.given a component declaring the full hook set
     * @spec.when  a wire call applies an update and invokes an action
     * @spec.then  the hooks fire in the documented order: boot then hydrate then booted (the HYDRATE
     *     finish), then updating then updated + updatedCount (after the write), then rendering then
     *     rendered, then dehydrate
     * @spec.adr   ADR-0030
     */
    @Test
    void hooks_fire_in_lifecycle_order_on_an_update_call() {
        TRACE.clear();
        ComponentMetadata meta = ComponentMetadata.of(Hooked.class);

        dispatcher().call(meta, new Hooked(), Map.of("count", 1), Map.of("count", 5),
                List.of("increment"));

        assertThat(TRACE)
                .containsExactly(
                        "boot", "hydrate", "booted", "updating", "updated", "updatedCount",
                        "rendering", "rendered", "dehydrate");
    }

    /**
     * @spec.given an updating hook that records the count, applied with an update count=5 onto a
     *     rehydrated count=1
     * @spec.when  the call runs
     * @spec.then  updating saw the old value (1) and updatedCount saw the new value (5)
     * @spec.adr   ADR-0030
     */
    @Test
    void updating_sees_the_old_value_and_updated_the_new() {
        TRACE.clear();
        ComponentMetadata meta = ComponentMetadata.of(Hooked.class);
        Hooked instance = new Hooked();

        dispatcher().call(meta, instance, Map.of("count", 1), Map.of("count", 5), List.of());

        assertThat(instance.oldSeenByUpdating).isEqualTo(1);
        assertThat(instance.newSeenByUpdatedCount).isEqualTo(5);
    }

    /**
     * @spec.given a component whose lifecycle hook names match no @LievitAction
     * @spec.when  the LifecycleHooks are reflected
     * @spec.then  the hooks are present but none are exposed as actions (frontend cannot call them)
     * @spec.adr   ADR-0030
     */
    @Test
    void lifecycle_hooks_are_not_frontend_actions() {
        ComponentMetadata meta = ComponentMetadata.of(Hooked.class);
        assertThat(meta.action("updating")).isNull();
        assertThat(meta.action("hydrate")).isNull();
        assertThat(meta.action("boot")).isNull();
        // The real action is exposed.
        assertThat(meta.action("increment")).isNotNull();
    }
}
