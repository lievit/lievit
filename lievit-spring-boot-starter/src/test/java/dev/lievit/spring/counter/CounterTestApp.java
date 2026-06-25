/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.counter;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/**
 * Minimal Spring Boot app for the walking-skeleton end-to-end test. Registers the {@link
 * CounterComponent} as a <strong>prototype</strong> bean so each stateless wire call gets a fresh
 * instance (no state survives between calls; the snapshot is the only carrier).
 */
@SpringBootApplication
public class CounterTestApp {

    /**
     * @return a fresh counter per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    CounterComponent counterComponent() {
        return new CounterComponent();
    }

    /**
     * @return a fresh effectful component per wire call (exercises the effects channel, ADR-0012)
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    EffectfulComponent effectfulComponent() {
        return new EffectfulComponent();
    }

    /**
     * @return a fresh streaming component per wire call (exercises the SSE stream endpoint, #153)
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    StreamingComponent streamingComponent() {
        return new StreamingComponent();
    }

    /**
     * @return a fresh lazy component per wire call (exercises lazy loading, #147)
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    LazyChartComponent lazyChartComponent() {
        return new LazyChartComponent();
    }
}
