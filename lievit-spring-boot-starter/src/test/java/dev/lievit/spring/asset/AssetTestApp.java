/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.asset;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/**
 * Minimal Spring Boot app for the asset-pipeline IT (issue #171/#129): registers the {@link Widget}
 * component (colocated script module + scoped CSS + {@code @assets} head tags) so the asset controller
 * + emitter are exercised end-to-end through the autoconfiguration.
 */
@SpringBootApplication
public class AssetTestApp {

    /** @return a fresh Widget per request/wire call. */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    Widget widget() {
        return new Widget();
    }
}
