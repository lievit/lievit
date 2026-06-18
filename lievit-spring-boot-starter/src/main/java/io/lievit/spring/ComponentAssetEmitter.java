/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

import io.lievit.compiler.AssetManifest;
import io.lievit.compiler.CompiledComponent;
import io.lievit.compiler.ComponentCompiler;

/**
 * Derives the page-level {@link WireEffects.Assets} a component type brings (issue #171/#119/#129): the
 * lievit analogue of Livewire's {@code getAssets()} the update response carries so a late-arriving
 * component ships its JS/CSS. It is the wire layer's bookkeeping, not a user-callable effect: it reads
 * the {@link CompiledComponent} (the colocated script module, the {@code @assets} head tags, the
 * scoped CSS) and emits the URLs/tags, each <strong>once per page</strong>.
 *
 * <p>The once-per-page guarantee is the caller's: it threads a {@code seen} set of dedup keys across a
 * page's wire calls (the per-component asset key, the {@code @assets} {@link
 * io.lievit.compiler.ComponentAssets#key()}, and the {@code styleModule} hash), so a component whose
 * assets already shipped is skipped. This class is the pure derivation given the seen-set; tracking
 * lives in {@link ComponentAssetTracker}.
 *
 * <p>Per-component script URLs are resolved through the {@link AssetManifest} (the Vite-hashed file)
 * when the module is a built entry, falling back to the served per-component module route otherwise.
 * Scoped CSS is emitted as a {@code styleModule} pointing at the {@code /lievit/css/{component}} route
 * with the content hash for cache-busting (the route is served by {@link LievitAssetController}).
 */
public final class ComponentAssetEmitter {

    private final ComponentCompiler compiler;
    private final AssetManifest manifest;
    private final String assetBasePath;

    /**
     * @param compiler the component compiler (reads the colocated artifacts; cached)
     * @param manifest the Vite build manifest (resolves a module to its hashed file), or
     *     {@link AssetManifest#EMPTY} in dev
     * @param assetBasePath the URL base the served assets sit under (e.g. {@code /lievit})
     */
    public ComponentAssetEmitter(
            ComponentCompiler compiler, AssetManifest manifest, String assetBasePath) {
        this.compiler = compiler;
        this.manifest = manifest;
        this.assetBasePath = stripTrailingSlash(assetBasePath);
    }

    /**
     * Derives the assets a rendered component brings that have not shipped yet, recording the ones it
     * emits in {@code seen} so they are not re-emitted on a later call within the same page.
     *
     * @param componentType the rendered component class
     * @param seen the per-page set of already-shipped dedup keys (mutated: emitted keys are added)
     * @return the assets to ship on this update, or {@code null} when the component brings none new
     */
    public WireEffects.@Nullable Assets emit(Class<?> componentType, java.util.Set<String> seen) {
        CompiledComponent compiled = compiler.compile(componentType);
        List<String> scripts = new ArrayList<>();
        List<String> headTags = new ArrayList<>();
        List<WireEffects.StyleModule> styleModules = new ArrayList<>();

        // The per-component run($wire,$js) module (the @script analogue), once per component type.
        Optional<String> scriptModule = compiled.scriptModule();
        if (scriptModule.isPresent()) {
            String scriptKey = "script:" + compiled.className();
            if (seen.add(scriptKey)) {
                scripts.add(scriptUrl(scriptModule.get()));
            }
        }

        // The @assets head tags (shared third-party assets), once per page by the deterministic key.
        if (!compiled.assets().isEmpty() && seen.add(compiled.assets().key())) {
            headTags.addAll(compiled.assets().headTags());
        }

        // The scoped CSS module (issue #129): once per component type, keyed by the content hash so a
        // changed stylesheet re-ships (the cache-busting transport).
        Optional<String> style = compiled.style();
        if (style.isPresent()) {
            String componentName = compiled.metadata().className();
            String hash = ScopedCss.contentHash(style.get());
            String styleKey = "style:" + componentName + ":" + hash;
            if (seen.add(styleKey)) {
                styleModules.add(
                        new WireEffects.StyleModule(componentName, cssUrl(componentName, hash), hash));
            }
        }

        WireEffects.Assets assets = new WireEffects.Assets(scripts, headTags, styleModules);
        return assets.isEmpty() ? null : assets;
    }

    /**
     * Resolves a per-component module path to its served URL: the Vite-hashed file under the asset
     * base when the manifest knows it, else the served per-component module route (dev / unbuilt).
     */
    private String scriptUrl(String moduleResourcePath) {
        return manifest
                .resolve(moduleResourcePath)
                .map(e -> assetBasePath + "/assets/" + e.file())
                .orElse(assetBasePath + "/module/" + moduleResourcePath);
    }

    private String cssUrl(String componentName, String hash) {
        return assetBasePath + "/css/" + componentName + "?v=" + hash;
    }

    private static String stripTrailingSlash(String path) {
        return path.endsWith("/") ? path.substring(0, path.length() - 1) : path;
    }
}
