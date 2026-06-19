/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/**
 * Minimal Spring Boot app for the calendar wire end-to-end test (R1 RESOLVED, ADR-0012). Registers
 * the {@link CalendarComponent} as a <strong>prototype</strong> bean (a fresh instance per stateless
 * wire call, the runtime contract; the signed snapshot is the only state carrier) and lets the
 * lievit starter autoconfigure the wire service + JTE engine.
 */
@SpringBootApplication
public class CalendarWireTestApp {

    /**
     * @return a fresh calendar component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    CalendarComponent calendarComponent() {
        return new CalendarComponent();
    }
}
