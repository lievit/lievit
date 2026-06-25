/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.Test;

import dev.lievit.LievitComponent;
import dev.lievit.LievitRender;
import dev.lievit.Wire;
import dev.lievit.compiler.AssetManifest;
import dev.lievit.compiler.ComponentCompiler;

/**
 * Spec for the page-level asset derivation (issue #171/#119/#129, ADR-0060/0061/0063): an emitter
 * turns a rendered component type into the {@code run($wire,$js)} module URL, the {@code @assets} head
 * tags, and the scoped-CSS {@code styleModule} the update response carries so a late-arriving
 * component ships its JS/CSS. Each asset is emitted once per page (the seen-set guards re-emission).
 * The script URL is Vite-hashed when the manifest knows it, else the dev module route.
 */
class ComponentAssetEmitterTest {

    @LievitComponent
    static class PlainComp {
        @Wire int n;

        @LievitRender
        Object view() {
            return null;
        }
    }

    private final ComponentCompiler compiler = new ComponentCompiler();

    /**
     * @spec.given a component with no colocated script/style/assets
     * @spec.when  its assets are derived
     * @spec.then  nothing is emitted (a plain component brings no page assets)
     * @spec.adr   ADR-0060
     * @spec.us    US-171-asset-pipeline
     */
    @Test
    void a_plain_component_brings_no_assets() {
        ComponentAssetEmitter emitter =
                new ComponentAssetEmitter(compiler, AssetManifest.EMPTY, "/lievit");

        assertThat(emitter.emit(PlainComp.class, new HashSet<>())).isNull();
    }

    /**
     * @spec.given a component whose script module the Vite manifest resolves to a hashed file
     * @spec.when  its assets are derived
     * @spec.then  the script URL is the content-hashed served file (versioned, long-cacheable)
     * @spec.adr   ADR-0060
     * @spec.us    US-171-asset-pipeline
     */
    @Test
    void resolves_a_built_script_module_to_its_hashed_url() {
        // dev/lievit/spring/asset/Widget.lievit.ts is the colocated module of the test fixture.
        String moduleSrc = "dev/lievit/spring/asset/Widget.lievit.ts";
        AssetManifest manifest =
                AssetManifest.of(
                        java.util.Map.of(moduleSrc, java.util.Map.of("file", "assets/Widget-AbCd12.js")));
        ComponentAssetEmitter emitter = new ComponentAssetEmitter(compiler, manifest, "/lievit");

        WireEffects.Assets assets = emitter.emit(dev.lievit.spring.asset.Widget.class, new HashSet<>());

        assertThat(assets).isNotNull();
        assertThat(assets.scripts()).containsExactly("/lievit/assets/assets/Widget-AbCd12.js");
        assertThat(assets.headTags())
                .containsExactly("<script src=\"https://cdn.example.com/lib.js\"></script>");
        assertThat(assets.styleModules()).hasSize(1);
        assertThat(assets.styleModules().get(0).component())
                .isEqualTo(dev.lievit.spring.asset.Widget.class.getName());
        assertThat(assets.styleModules().get(0).href()).startsWith("/lievit/css/");
    }

    /**
     * @spec.given a component with a script module and no Vite manifest (dev mode)
     * @spec.when  its assets are derived
     * @spec.then  the script URL falls back to the per-component dev module route
     * @spec.adr   ADR-0060
     */
    @Test
    void falls_back_to_the_dev_module_route_without_a_manifest() {
        ComponentAssetEmitter emitter =
                new ComponentAssetEmitter(compiler, AssetManifest.EMPTY, "/lievit");

        WireEffects.Assets assets = emitter.emit(dev.lievit.spring.asset.Widget.class, new HashSet<>());

        assertThat(assets).isNotNull();
        assertThat(assets.scripts())
                .containsExactly("/lievit/module/dev/lievit/spring/asset/Widget.lievit.ts");
    }

    /**
     * @spec.given a component whose assets already shipped on a prior call (its keys are in the
     *     seen-set)
     * @spec.when  its assets are derived again with the same seen-set
     * @spec.then  nothing is re-emitted: each asset ships exactly once per page (the {@code getAssets}
     *     once-semantic)
     * @spec.adr   ADR-0061
     * @spec.us    US-119-script-and-assets
     */
    @Test
    void ships_each_asset_once_per_page() {
        ComponentAssetEmitter emitter =
                new ComponentAssetEmitter(compiler, AssetManifest.EMPTY, "/lievit");
        Set<String> seen = new HashSet<>();

        assertThat(emitter.emit(dev.lievit.spring.asset.Widget.class, seen)).isNotNull();
        assertThat(emitter.emit(dev.lievit.spring.asset.Widget.class, seen)).isNull();
    }
}
