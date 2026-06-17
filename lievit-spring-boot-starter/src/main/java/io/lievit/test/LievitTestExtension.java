/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.test;

import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * The JUnit 5 extension activated by {@link LievitTest}: before each test it pulls the live Spring
 * {@link ApplicationContext} (built by {@code @SpringBootTest}) and a {@link MockMvc} over the web
 * context, and binds them to the current thread so the static {@link Lievit#test(Class)} entry point
 * can reach them without the developer passing anything (ADR-0010, the "snapshot is invisible,
 * MockMvc is invisible" DX).
 *
 * <p>Binding is per-thread and cleared after each test, so parallel test threads do not see each
 * other's context. The extension runs after {@link SpringExtension} (which {@code @SpringBootTest}
 * registers), so the context is fully built by the time {@link #beforeEach} runs.
 */
public final class LievitTestExtension implements BeforeEachCallback, AfterEachCallback {

    @Override
    public void beforeEach(ExtensionContext context) {
        ApplicationContext appContext = SpringExtension.getApplicationContext(context);
        MockMvc mockMvc = buildMockMvc(appContext);
        LievitTestContext.bind(new LievitTestContext(appContext, mockMvc));
    }

    @Override
    public void afterEach(ExtensionContext context) {
        LievitTestContext.clear();
    }

    private static MockMvc buildMockMvc(ApplicationContext appContext) {
        if (appContext instanceof WebApplicationContext web) {
            return MockMvcBuilders.webAppContextSetup(web).build();
        }
        throw new IllegalStateException(
                "Lievit.test() requires a web application context. @LievitTest implies"
                        + " @SpringBootTest with the web environment; the wire endpoint is an HTTP"
                        + " edge and must be exercised over it.");
    }
}
