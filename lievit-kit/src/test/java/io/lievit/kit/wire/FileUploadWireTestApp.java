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
 * Minimal Spring Boot app for the file-upload wire end-to-end test (Wave 2, ADR-0012). Registers the
 * {@link FileUploadComponent} as a <strong>prototype</strong> bean (a fresh instance per stateless
 * wire call) and lets the lievit starter autoconfigure the wire service + JTE engine.
 */
@SpringBootApplication
public class FileUploadWireTestApp {

    /**
     * @return a fresh file-upload component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    FileUploadComponent fileUploadComponent() {
        return new FileUploadComponent();
    }
}
