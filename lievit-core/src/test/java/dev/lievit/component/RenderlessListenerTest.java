/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitRender;
import dev.lievit.LievitRenderless;
import dev.lievit.Wire;
import dev.lievit.wire.PayloadGuard;
import dev.lievit.wire.synth.SynthesizerRegistry;

/**
 * Pins {@code @LievitRenderless} (ADR-0031): a renderless action runs but the render hook is
 * skipped, a rendering action still renders, and a pure update (no action) renders.
 */
class RenderlessListenerTest {

    @LievitComponent
    static class Views {
        @Wire int views;
        boolean rendered;

        @LievitAction
        @LievitRenderless
        void track() {
            this.views++;
        }

        @LievitAction
        void show() {
            this.views++;
        }

        @LievitRender
        void render() {
            this.rendered = true;
        }
    }

    private WireDispatcher dispatcher() {
        LifecycleBus bus = RenderlessListener.registerOn(new LifecycleBus());
        return new WireDispatcher(
                new PayloadGuard(), NoOpFieldValidator.INSTANCE, new SynthesizerRegistry(), bus);
    }

    /**
     * @spec.given a renderless action
     * @spec.when  the wire call invokes it
     * @spec.then  the action mutated state but the render hook did not run (skip-render)
     * @spec.adr   ADR-0031
     */
    @Test
    void a_renderless_action_skips_the_render() {
        ComponentMetadata meta = ComponentMetadata.of(Views.class);
        Views instance = new Views();

        WireCall result = dispatcher()
                .call(meta, instance, Map.of("views", 0), Map.of(), List.of("track"));

        assertThat(result.wire()).containsEntry("views", 1);
        assertThat(instance.rendered).isFalse();
    }

    /**
     * @spec.given a plain rendering action
     * @spec.when  the wire call invokes it
     * @spec.then  the render hook runs as normal
     * @spec.adr   ADR-0031
     */
    @Test
    void a_rendering_action_still_renders() {
        ComponentMetadata meta = ComponentMetadata.of(Views.class);
        Views instance = new Views();

        dispatcher().call(meta, instance, Map.of("views", 0), Map.of(), List.of("show"));

        assertThat(instance.rendered).isTrue();
    }

    /**
     * @spec.given a call with no action, only an update
     * @spec.when  the wire call runs
     * @spec.then  the render still runs (renderless only suppresses when a renderless action ran)
     * @spec.adr   ADR-0031
     */
    @Test
    void a_pure_update_still_renders() {
        ComponentMetadata meta = ComponentMetadata.of(Views.class);
        Views instance = new Views();

        dispatcher().call(meta, instance, Map.of("views", 0), Map.of("views", 2), List.of());

        assertThat(instance.rendered).isTrue();
    }
}
