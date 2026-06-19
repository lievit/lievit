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
 * Minimal Spring Boot app for the collapsible wire end-to-end test. Registers the
 * {@link CollapsibleComponent} as a <strong>prototype</strong> bean (a fresh instance per stateless
 * wire call, the runtime contract; the signed snapshot is the only state carrier) and lets the
 * lievit starter autoconfigure the wire service + JTE engine. Scoped to the {@code wire} package so
 * it does not pull the hello-admin app's beans.
 */
@SpringBootApplication
public class CollapsibleWireTestApp {

    /**
     * @return a fresh collapsible component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    CollapsibleComponent collapsibleComponent() {
        return new CollapsibleComponent();
    }
}
