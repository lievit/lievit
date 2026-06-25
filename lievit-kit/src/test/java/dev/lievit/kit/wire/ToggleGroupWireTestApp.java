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
 * Minimal Spring Boot app for the toggle-group wire end-to-end test. Registers the
 * {@link ToggleGroupComponent} as a <strong>prototype</strong> bean (a fresh instance per stateless
 * wire call; the signed snapshot is the only state carrier) seeded with three values in
 * single-selection mode, and lets the lievit starter autoconfigure the wire service + JTE engine.
 * Scoped to the {@code wire} package so it does not pull the hello-admin app's beans.
 */
@SpringBootApplication
public class ToggleGroupWireTestApp {

    /**
     * @return a fresh toggle-group component (three values, single mode) per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    ToggleGroupComponent toggleGroupComponent() {
        ToggleGroupComponent c = new ToggleGroupComponent();
        c.values = List.of("bold", "italic", "underline");
        c.labels = List.of("Bold", "Italic", "Underline");
        return c;
    }
}
