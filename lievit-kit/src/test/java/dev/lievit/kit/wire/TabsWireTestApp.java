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
 * Minimal Spring Boot app for the tabs wire end-to-end test. Registers the {@link TabsComponent} as
 * a <strong>prototype</strong> bean (a fresh instance per stateless wire call; the signed snapshot
 * is the only state carrier) seeded with three tabs, the third disabled, and lets the lievit starter
 * autoconfigure the wire service + JTE engine. Scoped to the {@code wire} package so it does not pull
 * the hello-admin app's beans.
 */
@SpringBootApplication
public class TabsWireTestApp {

    /**
     * @return a fresh tabs component (three tabs, the third disabled) per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    TabsComponent tabsComponent() {
        TabsComponent c = new TabsComponent();
        c.tabIds = List.of("alpha", "beta", "gamma");
        c.labels = List.of("Alpha", "Beta", "Gamma");
        c.disabledIds = List.of("gamma");
        return c;
    }
}
