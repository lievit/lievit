/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire.synth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import io.lievit.wire.WireError;
import io.lievit.wire.WireException;

/**
 * Specifies the class-instantiation guard on the synthesizer hydrate path: a denied gadget-prone
 * class named in a tuple's concrete-type tag refuses to instantiate, before any synth reflects on
 * it. The existing HMAC / PayloadGuard / limiter paths are untouched (ADR-0021, issue #165).
 */
class ClassInstantiationGuardTest {

    private final ClassInstantiationGuard guard = new ClassInstantiationGuard();

    enum Ok {
        A
    }

    record AppValue(int x) {}

    /**
     * @spec.given the name of a JVM gadget-prone class (java.lang.Runtime)
     * @spec.when  the guard checks it
     * @spec.then  it is refused FORBIDDEN_DESERIALIZATION before any reflective instantiation
     * @spec.adr   ADR-0021
     */
    @Test
    void denies_a_known_gadget_root() {
        assertThatThrownBy(() -> guard.check("java.lang.Runtime"))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.FORBIDDEN_DESERIALIZATION);
    }

    /**
     * @spec.given the name of a ProcessBuilder / scripting / naming gadget class
     * @spec.when  the guard checks each
     * @spec.then  all are refused (the dangerous roots are closed)
     * @spec.adr   ADR-0021
     */
    @Test
    void denies_the_dangerous_roots() {
        for (String denied :
                new String[] {
                    "java.lang.ProcessBuilder",
                    "javax.naming.InitialContext",
                    "javax.script.ScriptEngineManager",
                    "java.io.File",
                    "java.net.URL",
                    "org.springframework.context.support.ClassPathXmlApplicationContext"
                }) {
            assertThatThrownBy(() -> guard.check(denied))
                    .as(denied)
                    .isInstanceOf(WireException.class)
                    .extracting(e -> ((WireException) e).error())
                    .isEqualTo(WireError.FORBIDDEN_DESERIALIZATION);
        }
    }

    /**
     * @spec.given a JDK type not on the built-in synth known-safe set (java.util.Random)
     * @spec.when  the guard checks it
     * @spec.then  it is refused: a new JDK type is opt-in, never opt-out (default-deny by root)
     * @spec.adr   ADR-0021
     */
    @Test
    void denies_an_unlisted_jdk_type() {
        assertThatThrownBy(() -> guard.check("java.util.Random"))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.FORBIDDEN_DESERIALIZATION);
    }

    /**
     * @spec.given the application's own value object and enum, and an allowed JDK type
     * @spec.when  the guard checks them
     * @spec.then  they pass: a user type in the application package round-trips normally
     * @spec.adr   ADR-0021
     */
    @Test
    void allows_application_types_and_the_known_jdk_set() {
        assertThatCode(() -> guard.check(AppValue.class.getName())).doesNotThrowAnyException();
        assertThatCode(() -> guard.check(Ok.class.getName())).doesNotThrowAnyException();
        assertThatCode(() -> guard.check("java.time.LocalDate")).doesNotThrowAnyException();
        assertThatCode(() -> guard.check("java.math.BigDecimal")).doesNotThrowAnyException();
    }

    /**
     * @spec.given a tuple naming a denied concrete class in its type tag, hydrated via the registry
     * @spec.when  the registry resolves the class before a synth instantiates it
     * @spec.then  it refuses FORBIDDEN_DESERIALIZATION (the synth path is gated by the guard)
     * @spec.adr   ADR-0021
     */
    @Test
    void registry_refuses_a_tuple_naming_a_denied_class() {
        SynthesizerRegistry registry = new SynthesizerRegistry();
        // A record tuple whose concrete type is forged to a denied class.
        Object tuple = new Dehydrated(java.util.Map.of(), "rec", "java.lang.Runtime").toEnvelope();

        assertThatThrownBy(() -> registry.hydrate(tuple))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.FORBIDDEN_DESERIALIZATION);
    }

    /**
     * @spec.given an interface or abstract class name (not concrete)
     * @spec.when  the guard checks the resolved Class
     * @spec.then  it is refused: only a concrete non-Class/ClassLoader/Thread type is instantiable
     * @spec.adr   ADR-0021
     */
    @Test
    void denies_a_non_concrete_class_object() {
        assertThatThrownBy(() -> guard.check(Runnable.class))
                .isInstanceOf(WireException.class);
        assertThat(true).isTrue();
    }
}
