/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Specifies the kit's semantic icon and color seam: the {@link Icon}/{@link IconRegistry} alias
 * indirection and the {@link Color} name-to-CSS-class mapping that the navigation, widget, and
 * action surfaces consume. Pure tests — no Spring context.
 */
class IconColorTest {

    /**
     * @spec.given an icon registry seeded with the kit defaults
     * @spec.when  a default alias is resolved
     * @spec.then  it resolves to the kit's Heroicon-style glyph name
     */
    @Test
    void icon_registry_resolves_a_default_alias_to_its_glyph() {
        IconRegistry registry = IconRegistry.withDefaults();

        assertThat(registry.resolve(Icon.of("actions.delete"))).contains("heroicon-o-trash");
    }

    /**
     * @spec.given an icon registry with a default mapping for an alias
     * @spec.when  an adopter registers an override for the same alias and resolves it
     * @spec.then  the override wins over the default (last write wins)
     */
    @Test
    void icon_registry_override_beats_the_default() {
        IconRegistry registry = IconRegistry.withDefaults().register("actions.delete", "my-trash");

        assertThat(registry.resolve(Icon.of("actions.delete"))).contains("my-trash");
    }

    /**
     * @spec.given an icon registry
     * @spec.when  an unknown alias is resolved
     * @spec.then  an empty Optional is returned (the caller renders no icon)
     */
    @Test
    void icon_registry_returns_empty_for_an_unknown_alias() {
        IconRegistry registry = IconRegistry.empty();

        assertThat(registry.resolve(Icon.of("nope"))).isEmpty();
    }

    /**
     * @spec.given a map of alias-to-glyph overrides
     * @spec.when  it is merged into a registry
     * @spec.then  each mapping resolves
     */
    @Test
    void icon_registry_merges_a_map_of_overrides() {
        IconRegistry registry =
                IconRegistry.empty().register(Map.of("a", "glyph-a", "b", "glyph-b"));

        assertThat(registry.resolve(Icon.of("a"))).contains("glyph-a");
        assertThat(registry.resolve(Icon.of("b"))).contains("glyph-b");
    }

    /**
     * @spec.given a blank icon alias
     * @spec.when  an Icon is constructed
     * @spec.then  it is rejected with an IllegalArgumentException
     */
    @Test
    void icon_rejects_a_blank_alias() {
        assertThatThrownBy(() -> Icon.of("  ")).isInstanceOf(IllegalArgumentException.class);
    }

    /**
     * @spec.given the danger semantic color constant
     * @spec.when  its CSS class is requested
     * @spec.then  it is the fi-color-danger convention class
     */
    @Test
    void color_maps_a_semantic_name_to_its_css_class() {
        assertThat(Color.DANGER.cssClass()).isEqualTo("fi-color-danger");
    }

    /**
     * @spec.given a color name in mixed case
     * @spec.when  a Color is constructed
     * @spec.then  the name is normalized to lowercase
     */
    @Test
    void color_normalizes_its_name_to_lowercase() {
        assertThat(Color.of("Danger").name()).isEqualTo("danger");
    }

    /**
     * @spec.given the six default semantic colors
     * @spec.when  their names are read
     * @spec.then  they match Filament's default palette names
     */
    @Test
    void color_exposes_the_six_default_semantic_names() {
        assertThat(
                        java.util.List.of(
                                Color.PRIMARY.name(),
                                Color.DANGER.name(),
                                Color.INFO.name(),
                                Color.SUCCESS.name(),
                                Color.WARNING.name(),
                                Color.GRAY.name()))
                .containsExactly("primary", "danger", "info", "success", "warning", "gray");
    }
}
