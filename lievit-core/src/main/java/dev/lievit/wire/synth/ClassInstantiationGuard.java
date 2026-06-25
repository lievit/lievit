/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire.synth;

import java.util.List;
import java.util.Set;

import dev.lievit.wire.WireError;
import dev.lievit.wire.WireException;

/**
 * Gates reflective class instantiation on the synthesizer hydrate path (ADR-0021, issue #165).
 * Before any synthesizer constructs the class named in a tuple's {@code t} field, the registry asks
 * this guard; a denied class is a {@link WireError#FORBIDDEN_DESERIALIZATION} (422, ADR-0013/0014),
 * never reaching the reflective constructor and never a 500.
 *
 * <p>The defense is default-deny-by-root layered under the ADR-0013 JSON-shape allowlist: the
 * tuple's {@code d} data is already proven plain JSON (no open polymorphic typing), and this guard
 * additionally refuses the obvious JVM gadget roots ({@code java.lang.Runtime},
 * {@code ProcessBuilder}, the IO / net / naming / scripting / templating roots) before a record or
 * POJO synth instantiates the concrete type. It does not claim to enumerate every gadget (ADR-0013
 * argued that is a losing race); it closes the dangerous roots and lets the registry's own
 * known-safe JDK set plus the application's own packages through.
 *
 * <p>Pure Java, zero Spring (ADR-0007). Immutable and thread-safe.
 */
public final class ClassInstantiationGuard {

    /**
     * Gadget-prone package / class roots refused outright. A class whose name starts with any of
     * these (or equals a denied class) is never instantiated from a tuple.
     */
    private static final List<String> DENIED_ROOTS =
            List.of(
                    "java.lang.Runtime",
                    "java.lang.ProcessBuilder",
                    "java.lang.Process",
                    "java.lang.reflect.",
                    "java.lang.invoke.",
                    "java.lang.ClassLoader",
                    "java.io.",
                    "java.net.",
                    "java.nio.file.",
                    "java.sql.",
                    "javax.naming.",
                    "javax.script.",
                    "javax.management.",
                    "javax.sql.",
                    "jakarta.",
                    "org.springframework.",
                    "com.sun.",
                    "sun.",
                    "jdk.",
                    "javassist.",
                    "org.apache.commons.collections.functors.",
                    "org.apache.commons.collections4.functors.",
                    "groovy.",
                    "org.codehaus.groovy.",
                    "bsh.",
                    "org.yaml.snakeyaml.");

    /**
     * JDK types the built-in synths legitimately reconstruct. A {@code java.*} type not in this set
     * is denied: a new JDK type is opt-in (a built-in synth, a {@link Wireable}, or registration),
     * never opt-out (ADR-0021).
     */
    private static final Set<String> ALLOWED_JDK_TYPES =
            Set.of(
                    "java.time.LocalDate",
                    "java.time.LocalDateTime",
                    "java.time.LocalTime",
                    "java.time.Instant",
                    "java.math.BigDecimal",
                    "java.math.BigInteger",
                    "java.util.UUID");

    /** Constructs the protocol-default guard. */
    public ClassInstantiationGuard() {}

    /**
     * Verifies that a class named in a tuple may be reflectively instantiated.
     *
     * @param type the concrete class a synthesizer is about to construct
     * @throws WireException {@link WireError#FORBIDDEN_DESERIALIZATION} if the class is denied
     */
    public void check(Class<?> type) {
        check(type.getName());
        if (type.isInterface()
                || java.lang.reflect.Modifier.isAbstract(type.getModifiers())
                || Class.class.isAssignableFrom(type)
                || ClassLoader.class.isAssignableFrom(type)
                || Thread.class.isAssignableFrom(type)) {
            throw deny(type.getName());
        }
    }

    /**
     * Verifies a class name (the tuple's {@code t}) is not a denied root before the class is even
     * loaded. The registry calls this, then {@link #check(Class)} once the class is resolved.
     *
     * @param className the fully-qualified class name from the tuple
     * @throws WireException {@link WireError#FORBIDDEN_DESERIALIZATION} if the name is denied
     */
    public void check(String className) {
        for (String denied : DENIED_ROOTS) {
            if (className.startsWith(denied)) {
                throw deny(className);
            }
        }
        if ((className.startsWith("java.")
                        || className.startsWith("javax.")
                        || className.startsWith("jakarta."))
                && !ALLOWED_JDK_TYPES.contains(className)) {
            throw deny(className);
        }
    }

    private static WireException deny(String className) {
        // The class name is logged in the message server-side (ADR-0014 keeps it out of the
        // client response); the client only ever sees the 422 + Lievit-Reason header.
        return new WireException(
                WireError.FORBIDDEN_DESERIALIZATION,
                "refused reflective instantiation of a denied class on the synth path: "
                        + className);
    }
}
