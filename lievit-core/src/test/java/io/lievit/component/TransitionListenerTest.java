/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitTransition;
import io.lievit.Wire;
import io.lievit.wire.PayloadGuard;
import io.lievit.wire.synth.SynthesizerRegistry;

/**
 * Pins the {@code @LievitTransition} server effect (ADR-0034, #113): an action carrying the
 * annotation seeds the {@code transition} control onto the effects sink; an imperative
 * {@code transition()} call inside the action body overrides the annotation; a plain action emits no
 * transition (the static {@code l:transition} markup then decides).
 */
class TransitionListenerTest {

    @LievitComponent
    static class Box {
        @Wire boolean open;

        @LievitAction
        @LievitTransition(duration = 300, name = "fade")
        void toggle() {
            this.open = !this.open;
        }

        @LievitAction
        @LievitTransition
        void show() {
            this.open = true;
        }

        @LievitAction
        @LievitTransition(duration = 300)
        void tickQuietly() {
            // The annotation seeds a duration; the body decides at runtime to skip the animation.
            LievitEffects.current().skipTransition();
        }

        @LievitAction
        void plain() {
            this.open = !this.open;
        }
    }

    private WireDispatcher dispatcher() {
        LifecycleBus bus = TransitionListener.registerOn(new LifecycleBus());
        return new WireDispatcher(
                new PayloadGuard(), NoOpFieldValidator.INSTANCE, new SynthesizerRegistry(), bus);
    }

    /**
     * @spec.given an action annotated {@code @LievitTransition(duration, name)}
     * @spec.when  the wire call invokes it
     * @spec.then  the effects sink carries the transition control (duration + name, not skipped)
     * @spec.adr   ADR-0034
     */
    @Test
    void an_annotated_action_emits_the_transition_control() {
        ComponentMetadata meta = ComponentMetadata.of(Box.class);

        WireCall result =
                dispatcher().call(meta, new Box(), Map.of("open", false), Map.of(), List.of("toggle"));

        TransitionEffect transition = result.effects().transition();
        assertThat(transition).isNotNull();
        assertThat(transition.skip()).isFalse();
        assertThat(transition.duration()).isEqualTo(300);
        assertThat(transition.name()).isEqualTo("fade");
    }

    /**
     * @spec.given an action annotated with a bare {@code @LievitTransition} (no attributes)
     * @spec.when  the wire call invokes it
     * @spec.then  a transition control is emitted with no duration / name override and no skip
     * @spec.adr   ADR-0034
     */
    @Test
    void a_bare_annotation_emits_a_default_control() {
        ComponentMetadata meta = ComponentMetadata.of(Box.class);

        WireCall result =
                dispatcher().call(meta, new Box(), Map.of("open", false), Map.of(), List.of("show"));

        TransitionEffect transition = result.effects().transition();
        assertThat(transition).isNotNull();
        assertThat(transition.skip()).isFalse();
        assertThat(transition.duration()).isNull();
        assertThat(transition.name()).isNull();
    }

    /**
     * @spec.given an annotated action whose body imperatively calls {@code skipTransition()}
     * @spec.when  the wire call invokes it (CALL phase seeds the annotation, then the body runs)
     * @spec.then  the imperative skip wins over the annotation's seeded duration
     * @spec.adr   ADR-0034
     */
    @Test
    void the_imperative_call_overrides_the_annotation() {
        ComponentMetadata meta = ComponentMetadata.of(Box.class);

        WireCall result =
                dispatcher()
                        .call(meta, new Box(), Map.of("open", false), Map.of(), List.of("tickQuietly"));

        TransitionEffect transition = result.effects().transition();
        assertThat(transition).isNotNull();
        assertThat(transition.skip()).isTrue();
    }

    /**
     * @spec.given a plain action with no {@code @LievitTransition}
     * @spec.when  the wire call invokes it
     * @spec.then  no transition control is emitted (the client falls back to the static markup)
     * @spec.adr   ADR-0034
     */
    @Test
    void a_plain_action_emits_no_transition() {
        ComponentMetadata meta = ComponentMetadata.of(Box.class);

        WireCall result =
                dispatcher().call(meta, new Box(), Map.of("open", false), Map.of(), List.of("plain"));

        assertThat(result.effects().transition()).isNull();
        assertThat(result.effects().isEmpty()).isTrue();
    }
}
