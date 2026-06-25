/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.wire;

import java.util.List;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/**
 * Minimal Spring Boot app for the accordion wire end-to-end test. Registers the
 * {@link AccordionComponent} as a <strong>prototype</strong> bean (a fresh instance per stateless
 * wire call, the runtime contract; the signed snapshot is the only state carrier) seeded with three
 * items, and lets the lievit starter autoconfigure the wire service + JTE engine. Scoped to the
 * {@code wire} package so it does not pull the hello-admin app's beans.
 */
@SpringBootApplication
public class AccordionWireTestApp {

    /**
     * @return a fresh accordion component (three items, single mode) per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    AccordionComponent accordionComponent() {
        AccordionComponent c = new AccordionComponent();
        c.itemIds = List.of("one", "two", "three");
        c.labels = List.of("First", "Second", "Third");
        return c;
    }
}
