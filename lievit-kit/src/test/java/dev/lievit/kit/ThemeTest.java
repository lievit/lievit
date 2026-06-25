/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the custom-theme mechanism (the Filament {@code Theme extends Css = replace} rule): a
 * plain {@link Css} loads additively alongside the core stylesheet, a {@link Theme} replaces the
 * core for the panel that registers it, and the {@link AssetManager} resolves the right stylesheet
 * set per panel. The Tailwind v4 {@code @source}/custom-property build contract is documented on
 * {@link Theme}.
 */
class ThemeTest {

    /**
     * @spec.given a theme and a plain css asset
     * @spec.when  their replace semantics are read
     * @spec.then  a theme replaces the core, a plain css is additive
     */
    @Test
    void a_theme_replaces_the_core_a_css_is_additive() {
        assertThat(Theme.make("acme", "/themes/acme.css").replacesCore()).isTrue();
        assertThat(Css.make("extra", "/extra.css").replacesCore()).isFalse();
    }

    /**
     * @spec.given an asset manager with the default core and one additive asset
     * @spec.when  the stylesheets for the default (no theme) panel are resolved
     * @spec.then  the core loads first, then the additive asset
     */
    @Test
    void without_a_theme_the_core_plus_additive_assets_load() {
        AssetManager assets =
                AssetManager.create().coreStylesheet("/kit.css").register(Css.make("extra", "/extra.css"));

        assertThat(assets.stylesheetsFor(null)).containsExactly("/kit.css", "/extra.css");
    }

    /**
     * @spec.given an asset manager with a registered theme
     * @spec.when  the stylesheets for a panel naming that theme are resolved
     * @spec.then  the theme's stylesheet replaces the core (it is the only one loaded)
     */
    @Test
    void a_named_theme_replaces_the_core_stylesheet() {
        AssetManager assets =
                AssetManager.create()
                        .coreStylesheet("/kit.css")
                        .register(Theme.make("acme", "/themes/acme.css"))
                        .register(Css.make("extra", "/extra.css"));

        assertThat(assets.stylesheetsFor("acme")).containsExactly("/themes/acme.css");
    }

    /**
     * @spec.given a panel that names a theme
     * @spec.when  the theme name is read back
     * @spec.then  the panel carries it (the layout pairs it with the asset manager to pick the href)
     */
    @Test
    void a_panel_carries_its_theme_name() {
        Panel panel = Panel.create("admin").theme("acme");

        assertThat(panel.theme()).contains("acme");
    }
}
