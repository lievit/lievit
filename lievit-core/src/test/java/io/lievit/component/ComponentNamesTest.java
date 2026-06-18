/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Pins the component naming convention (issue #183, the Livewire {@code Finder} name&lt;-&gt;path
 * mapping): dotted name to slashed template path and back, and the default name derived from a class
 * with / without a declared template.
 */
class ComponentNamesTest {

    static class UserTableComponent {}

    static class Plain {}

    /**
     * @spec.given a dotted component name like "admin.users.table"
     * @spec.when  it is mapped to a template path and back
     * @spec.then  dots become slashes and slashes become dots (the Finder convention), so a name
     *     round-trips through its path
     * @spec.adr   ADR-0023
     * @spec.us    US-183-component-finder
     */
    @Test
    void dotted_name_maps_to_slashed_path_and_back() {
        assertThat(ComponentNames.nameToPath("admin.users.table")).isEqualTo("admin/users/table");
        assertThat(ComponentNames.pathToName("admin/users/table")).isEqualTo("admin.users.table");
        assertThat(ComponentNames.pathToName(ComponentNames.nameToPath("foo.bar"))).isEqualTo("foo.bar");
    }

    /**
     * @spec.given a component class with a declared template "admin/users"
     * @spec.when  its default name is derived
     * @spec.then  the declared template wins, its slashes lowered to the name's dots
     * @spec.adr   ADR-0023
     * @spec.us    US-183-component-finder
     */
    @Test
    void declared_template_drives_the_name() {
        assertThat(ComponentNames.nameFor(UserTableComponent.class, "admin/users"))
                .isEqualTo("admin.users");
    }

    /**
     * @spec.given a component class with no declared template
     * @spec.when  its default name is derived
     * @spec.then  the simple class name is decapitalised and a trailing "Component" suffix dropped
     *     (UserTableComponent -> userTable, Plain -> plain)
     * @spec.adr   ADR-0023
     * @spec.us    US-183-component-finder
     */
    @Test
    void name_falls_back_to_the_decapitalised_class_name_without_component_suffix() {
        assertThat(ComponentNames.nameFor(UserTableComponent.class, "")).isEqualTo("userTable");
        assertThat(ComponentNames.nameFor(Plain.class, "")).isEqualTo("plain");
        assertThat(ComponentNames.nameFor(Plain.class, null)).isEqualTo("plain");
    }
}
