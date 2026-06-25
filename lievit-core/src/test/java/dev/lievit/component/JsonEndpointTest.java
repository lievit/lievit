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
import dev.lievit.LievitJson;
import dev.lievit.LievitRender;
import dev.lievit.Wire;
import dev.lievit.wire.PayloadGuard;
import dev.lievit.wire.synth.SynthesizerRegistry;

/**
 * Pins {@code @LievitJson} (issue #99): a JSON RPC action returns its value via the effects channel
 * and never re-renders, while an ordinary action still renders. The skip reuses the
 * {@code @LievitRenderless} render-skip tally (both listeners registered together here).
 */
class JsonEndpointTest {

    @LievitComponent
    static class Calc {
        @Wire int base;
        boolean rendered;

        @LievitAction
        @LievitJson
        int total() {
            return this.base + 100;
        }

        @LievitAction
        void bump() {
            this.base++;
        }

        @LievitRender
        void render() {
            this.rendered = true;
        }
    }

    private WireDispatcher dispatcher() {
        // RenderlessListener tallies @LievitJson as renderless (#99), so it skips the render.
        LifecycleBus bus = RenderlessListener.registerOn(new LifecycleBus());
        return new WireDispatcher(
                new PayloadGuard(), NoOpFieldValidator.INSTANCE, new SynthesizerRegistry(), bus);
    }

    /**
     * @spec.given a @LievitJson action that returns a computed value
     * @spec.when  a wire call invokes it
     * @spec.then  the return value rides the effects channel and the render hook did NOT run (the
     *     JSON endpoint is a typed RPC with no re-render)
     * @spec.adr   ADR-0032
     * @spec.us    US-099-json-endpoint
     */
    @Test
    void a_json_action_returns_a_value_without_rendering() {
        ComponentMetadata meta = ComponentMetadata.of(Calc.class);
        Calc instance = new Calc();

        WireCall result =
                dispatcher().call(meta, instance, Map.of("base", 5), Map.of(), List.of("total"));

        assertThat(result.effects().returnValue()).isEqualTo(105);
        assertThat(result.renderSkipped()).isTrue();
        assertThat(instance.rendered).isFalse();
    }

    /**
     * @spec.given an ordinary action alongside the @LievitJson one
     * @spec.when  the ordinary action is invoked
     * @spec.then  the render hook runs as normal (only @LievitJson / @LievitRenderless skip render)
     * @spec.adr   ADR-0032
     * @spec.us    US-099-json-endpoint
     */
    @Test
    void an_ordinary_action_still_renders() {
        ComponentMetadata meta = ComponentMetadata.of(Calc.class);
        Calc instance = new Calc();

        dispatcher().call(meta, instance, Map.of("base", 0), Map.of(), List.of("bump"));

        assertThat(instance.rendered).isTrue();
    }
}
