/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.finder;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/** Minimal Spring Boot app for the component Finder/Factory IT (issue #183). */
@SpringBootApplication
public class FinderTestApp {

    /** @return a fresh parent per wire call. */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    ParentBoxComponent parentBoxComponent() {
        return new ParentBoxComponent();
    }

    /** @return a fresh leaf child per wire call. */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    ChildLeafComponent childLeafComponent() {
        return new ChildLeafComponent();
    }
}
