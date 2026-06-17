/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring.nested;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/**
 * Minimal Spring Boot app for the nested-components IT (ADR-0016). Registers the parent
 * {@link ListComponent} and its children ({@link RowComponent}, {@link RowInputComponent}) as
 * prototype beans, exactly as a real lievit app registers its components: a fresh instance per
 * stateless wire call, the snapshot the only carrier of state.
 */
@SpringBootApplication
public class NestedTestApp {

    /**
     * @return a fresh parent per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    ListComponent listComponent() {
        return new ListComponent();
    }

    /**
     * @return a fresh row child per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    RowComponent rowComponent() {
        return new RowComponent();
    }

    /**
     * @return a fresh modelable row-input child per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    RowInputComponent rowInputComponent() {
        return new RowInputComponent();
    }
}
