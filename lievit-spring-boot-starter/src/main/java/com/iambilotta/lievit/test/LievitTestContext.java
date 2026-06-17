/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.test;

import org.springframework.context.ApplicationContext;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The per-thread binding the {@link LievitTestExtension} sets up so the static {@link
 * Lievit#test(Class)} can reach the live Spring context and a {@link MockMvc} without the developer
 * threading them through (ADR-0010).
 *
 * <p>Held in a {@link ThreadLocal} keyed by test thread: parallel JUnit threads each see their own
 * context. {@link Lievit} reads it; the extension binds and clears it around every test.
 *
 * @param applicationContext the live application context built by {@code @SpringBootTest}
 * @param mockMvc a MockMvc over the web context, the in-process HTTP edge the harness drives
 */
public record LievitTestContext(ApplicationContext applicationContext, MockMvc mockMvc) {

    private static final ThreadLocal<LievitTestContext> CURRENT = new ThreadLocal<>();

    static void bind(LievitTestContext context) {
        CURRENT.set(context);
    }

    static void clear() {
        CURRENT.remove();
    }

    /**
     * @return the context bound for the current test thread
     * @throws IllegalStateException if no {@code @LievitTest} extension has bound one (the test
     *     class is missing {@code @LievitTest})
     */
    static LievitTestContext current() {
        LievitTestContext context = CURRENT.get();
        if (context == null) {
            throw new IllegalStateException(
                    "no lievit test context is bound. Annotate the test class with @LievitTest so"
                            + " the harness can reach the live Spring context and the wire endpoint.");
        }
        return context;
    }
}
