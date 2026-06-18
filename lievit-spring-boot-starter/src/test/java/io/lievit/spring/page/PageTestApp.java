/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.page;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/** Minimal Spring Boot app for the full-page routing test (issue #63/#181). */
@SpringBootApplication
public class PageTestApp {

    /** @return a fresh post-page component per request/wire call. */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    PostPageComponent postPageComponent() {
        return new PostPageComponent();
    }
}
