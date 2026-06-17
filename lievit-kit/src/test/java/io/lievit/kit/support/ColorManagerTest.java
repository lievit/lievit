/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Specifies the color system: semantic palettes ({@code primary}, {@code danger}, …) bound to
 * shade ramps, the name-to-CSS-class mapping the templates emit, and app-level overrides.
 */
class ColorManagerTest {

    /**
     * @spec.given a fresh ColorManager
     * @spec.when  the default semantic names are read
     * @spec.then  primary/danger/success/warning/info/gray are all registered with a ramp
     */
    @Test
    void ships_the_default_semantic_palette() {
        ColorManager colors = new ColorManager();

        assertThat(colors.names())
                .contains("primary", "danger", "success", "warning", "info", "gray");
        assertThat(colors.color("danger")).isPresent();
        assertThat(colors.color("danger").orElseThrow().base()).isEqualTo(Colors.RED.base());
    }

    /**
     * @spec.given a color ramp
     * @spec.when  a specific shade is requested
     * @spec.then  the registered CSS value is returned, and an unknown shade throws
     */
    @Test
    void a_color_resolves_its_shades() {
        assertThat(Colors.BLUE.shade(500)).isEqualTo("#3b82f6");
        assertThat(Colors.BLUE.base()).isEqualTo(Colors.BLUE.shade(500));
        assertThatThrownBy(() -> Colors.BLUE.shade(42))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /**
     * @spec.given a ColorManager with a registered name
     * @spec.when  cssClass is built for that name
     * @spec.then  it returns prefix-name; an unknown name falls back to the default
     */
    @Test
    void maps_a_semantic_name_to_a_stable_css_class() {
        ColorManager colors = new ColorManager();

        assertThat(colors.cssClass("lievit-badge", "danger")).isEqualTo("lievit-badge-danger");
        assertThat(colors.cssClass("lievit-badge", "unknown"))
                .isEqualTo("lievit-badge-" + ColorManager.DEFAULT);
    }

    /**
     * @spec.given a ColorManager
     * @spec.when  an app overrides the primary color with its own ramp
     * @spec.then  the new ramp is returned (last write wins, the panel rebrand path)
     */
    @Test
    void an_app_can_override_a_semantic_color() {
        ColorManager colors = new ColorManager();

        colors.register("primary", Colors.GREEN);

        assertThat(colors.color("primary").orElseThrow().base()).isEqualTo(Colors.GREEN.base());
    }
}
