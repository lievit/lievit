/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.support;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the icon registry: a Heroicon-name catalog plus semantic aliases, with the two-layer
 * resolve (alias mapped, literal name passed through) and app-level alias overrides.
 */
class IconManagerTest {

    /**
     * @spec.given a fresh IconManager
     * @spec.when  a default semantic alias is resolved
     * @spec.then  it maps to the catalog Heroicon name
     */
    @Test
    void resolves_a_default_semantic_alias_to_a_heroicon() {
        IconManager icons = new IconManager();

        assertThat(icons.hasAlias("actions.delete")).isTrue();
        assertThat(icons.resolve("actions.delete")).isEqualTo("heroicon-o-trash");
    }

    /**
     * @spec.given a name that is not a registered alias
     * @spec.when  it is resolved
     * @spec.then  it is treated as a literal icon name and returned unchanged
     */
    @Test
    void passes_a_literal_icon_name_through_unchanged() {
        IconManager icons = new IconManager();

        assertThat(icons.resolve("heroicon-o-star")).isEqualTo("heroicon-o-star");
        assertThat(icons.hasAlias("heroicon-o-star")).isFalse();
    }

    /**
     * @spec.given an IconManager
     * @spec.when  an app overrides a semantic alias
     * @spec.then  the alias resolves to the new glyph without the component changing
     */
    @Test
    void an_app_can_override_a_semantic_alias() {
        IconManager icons = new IconManager();

        icons.alias("actions.create", "heroicon-s-plus-circle");

        assertThat(icons.resolve("actions.create")).isEqualTo("heroicon-s-plus-circle");
    }
}
