/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.example.admin;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.web.SecurityFilterChain;

import dev.lievit.example.admin.product.ProductSearchComponent;
import dev.lievit.spring.ComponentRegistry;
import dev.lievit.spring.LievitWireService;
import dev.lievit.spring.WireCallResult;
import dev.lievit.test.LievitTest;

/**
 * Boot smoke test: the app context loads, the lievit runtime is wired (the search component is
 * registered and mounts over the real pipeline), and Spring Security is present.
 */
@LievitTest(classes = AdminApp.class)
class AdminAppSmokeTest {

    @Autowired
    LievitWireService wireService;

    @Autowired
    ComponentRegistry componentRegistry;

    @Autowired
    SecurityFilterChain securityFilterChain;

    /**
     * @spec.given the running app
     * @spec.when  the component registry is inspected
     * @spec.then  the reactive search component is registered
     */
    @Test
    void search_component_is_registered() {
        componentRegistry.metadata(ProductSearchComponent.class.getName());
    }

    /**
     * @spec.given the lievit wire service
     * @spec.when  the search component is mounted
     * @spec.then  it renders non-blank HTML carrying the seeded products and a signed snapshot
     */
    @Test
    void wire_service_mounts_the_search_component() {
        WireCallResult mounted = wireService.mount(ProductSearchComponent.class.getName());

        assertThat(mounted.html()).isNotBlank();
        assertThat(mounted.html()).contains("Espresso Machine"); // a seeded product
        assertThat(mounted.snapshot()).isNotBlank();
    }
}
