/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Specifies the asset pipeline: package-scoped registration, versioned (content-hash) URLs, the
 * per-asset rendering flags, theme-replaces-core semantics, and the boot script-data / CSS-variable
 * injection.
 */
class AssetManagerTest {

    /**
     * @spec.given a JS asset registered under a package with module+defer flags
     * @spec.when  the body-end block is rendered
     * @spec.then  it contains exactly one script tag with the right attributes and a versioned URL
     */
    @Test
    void a_plugin_js_asset_renders_once_with_its_flags() {
        AssetManager assets = new AssetManager();
        assets.register(Js.make("tags", "tags.js").pkg("acme").module().defer());

        String body = assets.renderBodyEnd();

        assertThat(body).containsOnlyOnce("<script");
        assertThat(body).contains("type=\"module\"").contains(" defer");
        assertThat(body).contains("/lievit/assets/js/acme/tags.js?v=");
    }

    /**
     * @spec.given a CSS asset
     * @spec.when  its versioned URL is computed before and after the content path changes
     * @spec.then  the version token changes (content-hash cache-buster)
     */
    @Test
    void a_versioned_url_changes_when_the_asset_content_changes() {
        AssetManager assets = new AssetManager();
        Css v1 = Css.make("theme", "theme-v1.css").pkg("acme");
        Css v2 = Css.make("theme", "theme-v2.css").pkg("acme");

        assertThat(assets.version(v1)).isNotEqualTo(assets.version(v2));
    }

    /**
     * @spec.given a registered theme alongside a core stylesheet
     * @spec.when  the head block is rendered
     * @spec.then  the theme replaces the core stylesheet href (Theme = replacing-Css)
     */
    @Test
    void a_theme_replaces_the_core_stylesheet() {
        AssetManager assets = new AssetManager();
        assets.register(Css.make("kit", "kit.css").pkg("lievit").core());
        assets.register(Theme.make("acme", "acme.css").pkg("acme"));

        String head = assets.renderHead();

        assertThat(head).contains("/lievit/assets/css/acme/acme.css");
        assertThat(head).doesNotContain("/lievit/assets/css/lievit/kit.css");
    }

    /**
     * @spec.given two registered script-data values
     * @spec.when  the body-end block is rendered
     * @spec.then  they are serialized into a single boot JSON script block
     */
    @Test
    void script_data_serializes_into_one_boot_block() {
        AssetManager assets = new AssetManager();
        assets.registerScriptData("locale", "it");
        assets.registerScriptData("maxUpload", 10);

        String body = assets.renderBodyEnd();

        assertThat(body).containsOnlyOnce("lievit-boot-data");
        assertThat(body).contains("\"locale\":\"it\"").contains("\"maxUpload\":10");
    }

    /**
     * @spec.given registered CSS variables for a package
     * @spec.when  the head block is rendered
     * @spec.then  they emit as namespaced :root custom properties
     */
    @Test
    void css_variables_emit_as_namespaced_root_properties() {
        AssetManager assets = new AssetManager();
        assets.registerCssVariables(Map.of("primary-500", "#3b82f6"), "acme");

        String head = assets.renderHead();

        assertThat(head).contains(":root{").contains("--acme-primary-500:#3b82f6;");
    }

    /**
     * @spec.given a core and a non-core script registered out of order
     * @spec.when  the body-end block is rendered
     * @spec.then  the core asset is injected before the non-core one
     */
    @Test
    void core_assets_inject_before_non_core_ones() {
        AssetManager assets = new AssetManager();
        assets.register(Js.make("plugin", "plugin.js").pkg("acme"));
        assets.register(Js.make("runtime", "runtime.js").pkg("lievit").core());

        String body = assets.renderBodyEnd();

        assertThat(body.indexOf("runtime.js")).isLessThan(body.indexOf("plugin.js"));
    }
}
