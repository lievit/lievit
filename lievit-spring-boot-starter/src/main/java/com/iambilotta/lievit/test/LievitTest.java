/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.test;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;

/**
 * The single annotation that wires a lievit component test (ADR-0010): a meta-annotation bundling
 * the {@link SpringBootTest} slice, a dev signing key, {@link AutoConfigureMockMvc}, and the {@link
 * LievitTestExtension} that hands {@link Lievit#test(Class)} the live application context.
 *
 * <p>It replaces the four-annotation header on a hand-rolled {@code *RoundtripIT}
 * ({@code @SpringBootTest} + {@code @AutoConfigureMockMvc} + {@code @TestPropertySource} + the manual
 * {@code MockMvc}/{@code LievitWireService} autowiring). The developer writes:
 *
 * <pre>{@code
 * @LievitTest
 * class CounterComponentTest {
 *     @Test void increments() {
 *         test(CounterComponent.class).mount().assertWire("count", 0)
 *             .call("increment").assertWire("count", 1).assertSee(">1<");
 *     }
 * }
 * }</pre>
 *
 * <p><strong>This is a test-scope annotation</strong> and does <em>not</em> count against the
 * seven-annotation public runtime cap (ADR-0002): the cap governs the authoring API, not the
 * test-fixtures surface. The dev signing key here is the codec floor (&ge; 32 bytes); a real
 * deployment supplies its own {@code lievit.signing-key}.
 *
 * <p>The host test must contribute a {@code @SpringBootApplication} (or {@code @SpringBootTest}
 * {@code classes=...}) that registers the components under test as beans, exactly as a normal
 * {@code @SpringBootTest} does. Point at a configuration explicitly when the test class is not under
 * a package scanned to one:
 *
 * <pre>{@code
 * @LievitTest(classes = CounterTestApp.class)
 * class CounterComponentTest { ... }
 * }</pre>
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {
            // A >= 32-byte dev signing key (the codec floor). The host may override it with its own
            // @TestPropertySource; this is only the convenient default so a component test needs no
            // configuration to drive the real signed wire.
            "lievit.signing-key=lievit-test-harness-dev-signing-key-0123456789abcdef"
        })
@ExtendWith(LievitTestExtension.class)
public @interface LievitTest {

    /**
     * The {@code @Configuration}/{@code @SpringBootApplication} classes to load, forwarded to
     * {@link SpringBootTest#classes()}. Leave empty to use Spring Boot's default config detection
     * (the nearest {@code @SpringBootConfiguration}).
     *
     * @return the configuration classes for the test slice
     */
    @org.springframework.core.annotation.AliasFor(annotation = SpringBootTest.class, attribute = "classes")
    Class<?>[] classes() default {};
}
