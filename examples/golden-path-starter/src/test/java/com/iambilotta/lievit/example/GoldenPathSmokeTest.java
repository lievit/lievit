/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.example;

import static org.assertj.core.api.Assertions.assertThat;

import com.iambilotta.lievit.example.auth.RegisterComponent;
import com.iambilotta.lievit.example.notes.NoteListComponent;
import com.iambilotta.lievit.spring.ComponentRegistry;
import com.iambilotta.lievit.spring.LievitWireService;
import com.iambilotta.lievit.spring.WireCallResult;
import com.iambilotta.lievit.test.LievitTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.ActiveProfiles;

/**
 * Smoke tests: the app boots, the lievit runtime is wired correctly, and the expected beans are
 * present. Runs in the surefire loop (*Test naming) using {@link LievitTest} which boots the full
 * Spring context; component-level wire behavior is covered by NoteListComponentTest and
 * RegisterComponentTest.
 */
@LievitTest(classes = GoldenPathApp.class)
@ActiveProfiles("test")
class GoldenPathSmokeTest {

    @Autowired
    LievitWireService wireService;

    @Autowired
    ComponentRegistry componentRegistry;

    @Autowired
    SecurityFilterChain securityFilterChain;

    /**
     * @spec.given the app is running
     * @spec.when the component registry is inspected
     * @spec.then both RegisterComponent and NoteListComponent are registered
     */
    @Test
    void both_lievit_components_are_registered() {
        assertThat(componentRegistry.isEmpty()).isFalse();
        // Both components must resolve to valid metadata (throws if not registered).
        componentRegistry.metadata(RegisterComponent.class.getName());
        componentRegistry.metadata(NoteListComponent.class.getName());
    }

    /**
     * @spec.given the lievit wire service
     * @spec.when the NoteListComponent is mounted
     * @spec.then the result carries a non-blank HTML fragment and a signed snapshot
     */
    @Test
    void wire_service_mounts_note_list_component() {
        WireCallResult mounted = wireService.mount(NoteListComponent.class.getName());
        assertThat(mounted.html()).isNotBlank();
        assertThat(mounted.snapshot()).isNotBlank();
        assertThat(mounted.html()).contains("data-lievit-component");
    }

    /**
     * @spec.given the lievit wire service
     * @spec.when the RegisterComponent is mounted
     * @spec.then the result carries a non-blank HTML fragment with the component root
     */
    @Test
    void wire_service_mounts_register_component() {
        WireCallResult mounted = wireService.mount(RegisterComponent.class.getName());
        assertThat(mounted.html()).isNotBlank();
        assertThat(mounted.snapshot()).isNotBlank();
        assertThat(mounted.html()).contains("data-lievit-component");
    }

    /**
     * @spec.given the app security configuration
     * @spec.when the SecurityFilterChain bean is resolved
     * @spec.then it is non-null (Spring Security is wired)
     */
    @Test
    void spring_security_filter_chain_is_configured() {
        assertThat(securityFilterChain).isNotNull();
    }
}
