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
 * Minimal Spring Boot app for the Wave 2 overlay wire end-to-end tests (dialog / drawer / sheet,
 * ADR-0012). Registers each overlay component as a <strong>prototype</strong> bean (a fresh
 * instance per stateless wire call, the runtime contract; the signed snapshot is the only state
 * carrier) and lets the lievit starter autoconfigure the wire service + JTE engine.
 *
 * <p>Scoped to the {@code wire} package so it does not pull the hello-admin app's beans. The three
 * overlays share one app because they share the same open-state-server model (open / close
 * actions, body in the template); each IT pins its component through the REAL runtime.
 */
@SpringBootApplication
public class OverlayWireTestApp {

    /**
     * @return a fresh dialog component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    DialogComponent dialogComponent() {
        return new DialogComponent();
    }

    /**
     * @return a fresh drawer component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    DrawerComponent drawerComponent() {
        return new DrawerComponent();
    }

    /**
     * @return a fresh sheet component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    SheetComponent sheetComponent() {
        return new SheetComponent();
    }
}
