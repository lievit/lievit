/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.finder;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import io.lievit.spring.ComponentRegistry;
import io.lievit.spring.LievitWireService;
import io.lievit.spring.WireCallResult;

/**
 * Component discovery / factory / naming over the real registry + wire pipeline (issue #183, the
 * Livewire {@code Finder} + {@code Factory} + {@code componentStack}): a dotted name resolves to the
 * right component class and default template path, and a nested mount records its parent on the
 * component stack (the load-bearing piece for {@code $parent} and deterministic-key view-path
 * hashing).
 */
@SpringBootTest(classes = FinderTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class ComponentFinderIT {

    @Autowired ComponentRegistry registry;
    @Autowired LievitWireService wireService;

    /**
     * @spec.given a component declared with template "finder/parent"
     * @spec.when  its dotted name "finder.parent" is resolved through the registry
     * @spec.then  it resolves to the component's FQN and maps to the "finder/parent" template path
     *     (the Finder dotted-name convention)
     * @spec.adr   ADR-0023
     * @spec.us    US-183-component-finder
     */
    @Test
    void a_dotted_name_resolves_to_the_component_and_its_template_path() {
        assertThat(registry.resolveName("finder.parent"))
                .isEqualTo(ParentBoxComponent.class.getName());
        assertThat(registry.metadataByName("finder.parent").type())
                .isEqualTo(ParentBoxComponent.class);
        assertThat(registry.templatePath("finder.parent")).isEqualTo("finder/parent");
        // The inverse: the FQN maps back to the dotted name (used to label a stack frame).
        assertThat(registry.nameOf(ParentBoxComponent.class.getName())).isEqualTo("finder.parent");
    }

    /**
     * @spec.given a parent component that mounts one child
     * @spec.when  the parent is mounted (the child mounts nested inside it)
     * @spec.then  the child recorded its parent's dotted name ("finder.parent") off the component
     *     stack during its own mount: the nested mount tracked the parent (the $parent foundation)
     * @spec.adr   ADR-0023
     * @spec.us    US-183-component-finder
     */
    @Test
    void a_nested_mount_records_its_parent_on_the_component_stack() {
        WireCallResult mounted = wireService.mount(ParentBoxComponent.class.getName());

        assertThat(mounted.html()).contains("data-parent=\"finder.parent\"");
    }
}
