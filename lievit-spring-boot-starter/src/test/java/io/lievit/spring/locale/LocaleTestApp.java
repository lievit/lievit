/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.locale;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;
import org.springframework.context.support.ResourceBundleMessageSource;

/**
 * Minimal Spring Boot app for the locale-pinning end-to-end test (ADR-0037, issues #169 / #143).
 * Registers a {@link MessageSource} backed by {@code locale-messages[_it].properties} on the test
 * classpath and the {@link GreetingPageComponent} that resolves a greeting in the active locale.
 */
@SpringBootApplication
public class LocaleTestApp {

    /**
     * @return a {@link MessageSource} reading {@code locale-messages.properties} (en default) and
     *     {@code locale-messages_it.properties} (Italian) from the test classpath
     */
    @Bean
    MessageSource messageSource() {
        ResourceBundleMessageSource source = new ResourceBundleMessageSource();
        source.setBasename("locale-messages");
        source.setDefaultEncoding("UTF-8");
        return source;
    }

    /** @return a fresh greeting page component per request / wire call. */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    GreetingPageComponent greetingPageComponent(MessageSource messageSource) {
        return new GreetingPageComponent(messageSource);
    }
}
