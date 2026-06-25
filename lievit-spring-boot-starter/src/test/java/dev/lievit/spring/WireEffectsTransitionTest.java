/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

import dev.lievit.component.LievitEffects;
import dev.lievit.component.TransitionEffect;

/**
 * Pins the {@code transition} key of the {@code Lievit-Effects} header (ADR-0034, #113): the core
 * {@link TransitionEffect} projects into the wire {@link WireEffects.Transition} shape the client
 * parses ({@code {skip?, duration?, name?}}), and a no-transition sink omits the key entirely.
 */
class WireEffectsTransitionTest {

    private final ObjectMapper json = new ObjectMapper();

    /**
     * @spec.given an effects sink carrying a transition control with duration + name
     * @spec.when  it is projected and serialized to the {@code Lievit-Effects} JSON
     * @spec.then  the {@code transition} key carries {@code duration} and {@code name}, no {@code skip}
     * @spec.adr   ADR-0034
     */
    @Test
    void serializes_a_duration_and_name_transition() throws Exception {
        LievitEffects sink = LievitEffects.capturing();
        sink.transition(new TransitionEffect(false, 300, "fade"));

        String body = json.writeValueAsString(WireEffects.from(sink));

        assertThat(body).contains("\"transition\":{");
        assertThat(body).contains("\"duration\":300");
        assertThat(body).contains("\"name\":\"fade\"");
        assertThat(body).doesNotContain("\"skip\"");
    }

    /**
     * @spec.given an effects sink whose action requested a skip
     * @spec.when  it is projected and serialized
     * @spec.then  the {@code transition} key carries {@code skip:true}
     * @spec.adr   ADR-0034
     */
    @Test
    void serializes_a_skip_transition() throws Exception {
        LievitEffects sink = LievitEffects.capturing();
        sink.skipTransition();

        String body = json.writeValueAsString(WireEffects.from(sink));

        assertThat(body).contains("\"transition\":{\"skip\":true}");
    }

    /**
     * @spec.given an effects sink with only a redirect (no transition)
     * @spec.when  it is projected and serialized
     * @spec.then  the {@code transition} key is omitted entirely (NON_NULL)
     * @spec.adr   ADR-0034
     */
    @Test
    void omits_the_transition_key_when_unused() throws Exception {
        LievitEffects sink = LievitEffects.capturing();
        sink.redirect("/home");

        String body = json.writeValueAsString(WireEffects.from(sink));

        assertThat(body).doesNotContain("transition");
    }
}
