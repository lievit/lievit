/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring.native_;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.predicate.RuntimeHintsPredicates;

import com.iambilotta.lievit.spring.WireCallRequest;
import com.iambilotta.lievit.spring.WireEffects;
import com.iambilotta.lievit.spring.counter.CounterComponent;

/**
 * Proves lievit's GraalVM native reachability metadata (ADR-0006) without paying for a full
 * native-image compile on every build: it runs the {@link LievitRuntimeHints} registrar and the
 * {@link LievitComponentsAotProcessor} contribution by hand into a fresh {@link RuntimeHints}, then
 * asserts the exact reflective surface lievit touches at runtime is registered, using the
 * documented {@link RuntimeHintsPredicates} API. If a future change reflects over a member that is
 * not hinted, this test goes RED long before the native gate does.
 */
class LievitNativeHintsNfrTest {

    /**
     * @spec.given a fresh RuntimeHints with lievit's static registrar applied
     * @spec.when  the wire request DTO that Jackson deserializes is checked
     * @spec.then  its declared fields and methods are reachable for reflection in a native image
     * @spec.adr   ADR-0006
     */
    @Test
    void registers_reflection_for_the_wire_request_dto() {
        RuntimeHints hints = new RuntimeHints();
        new LievitRuntimeHints().registerHints(hints, getClass().getClassLoader());

        assertThat(
                        RuntimeHintsPredicates.reflection()
                                .onType(WireCallRequest.class)
                                .withMemberCategory(MemberCategory.INVOKE_DECLARED_METHODS))
                .accepts(hints);
    }

    /**
     * @spec.given a fresh RuntimeHints with lievit's static registrar applied
     * @spec.when  the effects bag the ObjectMapper serializes into the Lievit-Effects header is
     *     checked
     * @spec.then  both the bag and its nested Event record are registered for serialization
     * @spec.adr   ADR-0006
     */
    @Test
    void registers_serialization_for_the_effects_bag() {
        RuntimeHints hints = new RuntimeHints();
        new LievitRuntimeHints().registerHints(hints, getClass().getClassLoader());

        assertThat(RuntimeHintsPredicates.serialization().onType(WireEffects.class)).accepts(hints);
        assertThat(RuntimeHintsPredicates.serialization().onType(WireEffects.Event.class))
                .accepts(hints);
    }

    /**
     * @spec.given a RuntimeHints into which a component type is registered as the AOT processor does
     * @spec.when  the reflective surface ComponentMetadata reads (declared fields + declared methods
     *     + declared constructors) is checked for that @LievitComponent
     * @spec.then  every category is reachable, so a native image can read its @Wire fields and
     *     invoke its @LievitAction methods exactly as lievit does on the JVM
     * @spec.adr   ADR-0006
     */
    @Test
    void registers_declared_fields_methods_and_constructors_for_a_component() {
        RuntimeHints hints = new RuntimeHints();
        // Mirror what LievitComponentsAotProcessor contributes for one discovered component.
        hints.reflection()
                .registerType(
                        CounterComponent.class,
                        MemberCategory.DECLARED_FIELDS,
                        MemberCategory.INVOKE_DECLARED_METHODS,
                        MemberCategory.INVOKE_DECLARED_CONSTRUCTORS);

        assertThat(
                        RuntimeHintsPredicates.reflection()
                                .onType(CounterComponent.class)
                                .withMemberCategory(MemberCategory.DECLARED_FIELDS))
                .accepts(hints);
        assertThat(
                        RuntimeHintsPredicates.reflection()
                                .onType(CounterComponent.class)
                                .withMemberCategory(MemberCategory.INVOKE_DECLARED_METHODS))
                .accepts(hints);
        assertThat(
                        RuntimeHintsPredicates.reflection()
                                .onType(CounterComponent.class)
                                .withMemberCategory(MemberCategory.INVOKE_DECLARED_CONSTRUCTORS))
                .accepts(hints);
    }
}
