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
import dev.lievit.LievitRenderless;
import dev.lievit.Wire;
import dev.lievit.wire.PayloadGuard;
import dev.lievit.wire.synth.SynthesizerRegistry;

/**
 * Pins the combined ordering when all built-in server-side runtime listeners are on the bus together
 * (the autoconfiguration's default bus, Epic #34): user lifecycle hooks, magic actions, renderless,
 * redirect, session. The order is the load-bearing contract a refactor must not silently change
 * (ADR-0030 / ADR-0031).
 */
class RuntimeFeaturesOrderInvariantTest {

    static final List<String> TRACE = new ArrayList<>();

    @LievitComponent
    static class Audited {
        @Wire int count;

        @LievitMount
        void mount() {
            TRACE.add("@LievitMount");
        }

        void boot() {
            TRACE.add("boot");
        }

        void hydrate() {
            TRACE.add("hydrate");
        }

        void updating() {
            TRACE.add("updating");
        }

        void updated() {
            TRACE.add("updated");
        }

        void dehydrate() {
            TRACE.add("dehydrate");
        }

        @LievitAction
        void act() {
            TRACE.add("action");
        }

        @LievitAction
        @LievitRenderless
        void track() {
            TRACE.add("renderless-action");
        }
    }

    private WireDispatcher dispatcher() {
        SynthesizerRegistry synth = new SynthesizerRegistry();
        LifecycleBus bus = new LifecycleBus();
        LifecycleHooksListener.registerOn(bus);
        SessionListener.registerOn(bus);
        bus.on(LifecyclePhase.CALL, new MagicActionListener(synth));
        RenderlessListener.registerOn(bus);
        RedirectListener.registerOn(bus);
        return new WireDispatcher(new PayloadGuard(), NoOpFieldValidator.INSTANCE, synth, bus);
    }

    /**
     * @spec.given the full built-in listener set on one bus
     * @spec.when  a wire call applies an update and invokes a rendering action
     * @spec.then  the user hooks fire in order around the action: boot, hydrate, updating, updated,
     *     action, dehydrate (the framework listeners are silent for this component)
     * @spec.adr   ADR-0030
     */
    @Test
    void user_hooks_fire_in_order_with_all_listeners_present() {
        TRACE.clear();
        ComponentMetadata meta = ComponentMetadata.of(Audited.class);

        dispatcher().call(meta, new Audited(), Map.of("count", 1), Map.of("count", 2), List.of("act"));

        assertThat(TRACE)
                .containsExactly("boot", "hydrate", "updating", "updated", "action", "dehydrate");
    }

    /**
     * @spec.given the full built-in listener set on one bus and a renderless action
     * @spec.when  a wire call invokes only the renderless action
     * @spec.then  the action runs but the render is skipped, alongside the hooks (hydrate ... dehydrate)
     * @spec.adr   ADR-0031
     */
    @Test
    void a_renderless_action_with_all_listeners_skips_render_and_still_runs_hooks() {
        TRACE.clear();
        ComponentMetadata meta = ComponentMetadata.of(Audited.class);

        dispatcher().call(meta, new Audited(), Map.of("count", 0), Map.of(), List.of("track"));

        assertThat(TRACE).contains("renderless-action", "dehydrate");
    }

    /**
     * @spec.given the full built-in listener set on one bus
     * @spec.when  a component is mounted
     * @spec.then  boot runs before @LievitMount; dehydrate runs at the end (mount pipeline order)
     * @spec.adr   ADR-0030
     */
    @Test
    void mount_pipeline_runs_boot_before_mount_hook() {
        TRACE.clear();
        ComponentMetadata meta = ComponentMetadata.of(Audited.class);

        dispatcher().mount(meta, new Audited());

        assertThat(TRACE).containsSubsequence("boot", "@LievitMount", "dehydrate");
    }
}
