/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.keyless;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

import dev.lievit.spring.nested.RowComponent;

/**
 * Minimal Spring Boot app for the keyless deterministic-key IT (ADR-0023, issue #175). Registers the
 * keyless parent and the reused leaf {@link RowComponent} as prototype beans: a fresh instance per
 * stateless wire call, the snapshot the only carrier of state.
 */
@SpringBootApplication
public class KeylessTestApp {

    /**
     * @return a fresh keyless parent per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    KeylessListComponent keylessListComponent() {
        return new KeylessListComponent();
    }

    /**
     * @return a fresh row child per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    RowComponent rowComponent() {
        return new RowComponent();
    }
}
