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
import dev.lievit.Wire;
import dev.lievit.wire.PayloadGuard;
import dev.lievit.wire.synth.SynthesizerRegistry;

/**
 * Pins server-driven redirects (ADR-0031, #51): an action's {@code redirect()} queues the redirect
 * effect AND skips the re-render by default; a plain action still renders.
 */
class RedirectListenerTest {

    @LievitComponent
    static class Form {
        @Wire String name = "";
        boolean rendered;

        @LievitAction
        void save() {
            LievitEffects.current().redirect("/thanks");
        }

        @LievitAction
        void touch() {
            this.name = "x";
        }

        @LievitRender
        void render() {
            this.rendered = true;
        }
    }

    private WireDispatcher dispatcher() {
        LifecycleBus bus = RedirectListener.registerOn(new LifecycleBus());
        return new WireDispatcher(
                new PayloadGuard(), NoOpFieldValidator.INSTANCE, new SynthesizerRegistry(), bus);
    }

    /**
     * @spec.given an action that calls redirect("/thanks")
     * @spec.when  the wire call runs
     * @spec.then  the redirect effect is queued and the render is skipped (render_on_redirect=false)
     * @spec.adr   ADR-0031
     */
    @Test
    void a_redirect_queues_the_effect_and_skips_render() {
        ComponentMetadata meta = ComponentMetadata.of(Form.class);
        Form instance = new Form();

        WireCall result = dispatcher()
                .call(meta, instance, Map.of("name", ""), Map.of(), List.of("save"));

        assertThat(result.effects().redirect()).isEqualTo("/thanks");
        assertThat(instance.rendered).isFalse();
    }

    /**
     * @spec.given a plain action that queues no redirect
     * @spec.when  the wire call runs
     * @spec.then  no redirect effect and the render runs normally
     * @spec.adr   ADR-0031
     */
    @Test
    void a_plain_action_renders_and_has_no_redirect() {
        ComponentMetadata meta = ComponentMetadata.of(Form.class);
        Form instance = new Form();

        WireCall result = dispatcher()
                .call(meta, instance, Map.of("name", ""), Map.of(), List.of("touch"));

        assertThat(result.effects().redirect()).isNull();
        assertThat(instance.rendered).isTrue();
    }
}
