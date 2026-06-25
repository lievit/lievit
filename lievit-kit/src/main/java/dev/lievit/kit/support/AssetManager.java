/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.zip.CRC32;

import org.jspecify.annotations.Nullable;

/**
 * The package-scoped asset registry (the filament-support {@code AssetManager} carried over): the
 * kit core, each panel, and each plugin register CSS/JS/font assets under a package name, and the
 * layout layer asks the manager for the head and body-end injection blocks.
 *
 * <p>Versioning: each asset's public URL carries a content-hash query param
 * ({@code ?v=<hash>}) so a changed asset is re-fetched by the browser. The hash is computed from
 * the asset's {@code package + id + path} (a stable surrogate; a real build wires the file digest).
 *
 * <p>Theme replacement: when a {@link Theme} is registered, it suppresses every {@link Asset#isCore
 * core} stylesheet in the head, so a panel reskins the admin by shipping one CSS file.
 *
 * <p>Boot data: {@link #registerScriptData(String, Object)} and
 * {@link #registerCssVariables(Map, String)} carry server-side values to the client at boot, the
 * former serialized into a single boot {@code <script>} block, the latter into an inline
 * {@code <style>} of CSS custom properties.
 */
public final class AssetManager {

    /** The URL prefix the kit's static-resource handler serves assets under. */
    public static final String BASE_URL = "/lievit/assets";

    private final Map<String, Asset> assets = new LinkedHashMap<>();
    private final Map<String, String> scriptData = new LinkedHashMap<>();
    private final Map<String, String> cssVariables = new LinkedHashMap<>();

    /**
     * Registers one or more assets. Re-registering the same {@code package:id} replaces the prior
     * one (idempotent: the layout injects each {@code package:id} exactly once).
     *
     * @param toRegister the assets to register
     * @return this manager
     */
    public AssetManager register(Asset... toRegister) {
        for (Asset asset : toRegister) {
            assets.put(key(asset), Objects.requireNonNull(asset, "asset"));
        }
        return this;
    }

    /**
     * @return the registered assets in registration order
     */
    public List<Asset> assets() {
        return List.copyOf(assets.values());
    }

    /**
     * Registers a server value handed to the client islands at boot.
     *
     * @param key the data key
     * @param value the value (serialized to a JSON-ish string)
     * @return this manager
     */
    public AssetManager registerScriptData(String key, @Nullable Object value) {
        scriptData.put(Objects.requireNonNull(key, "key"), value == null ? "null" : jsonScalar(value));
        return this;
    }

    /**
     * Registers CSS custom properties (theme tokens) for a package, emitted as an inline
     * {@code <style>} of {@code :root} variables.
     *
     * @param vars the variable name to value map (names without the leading {@code --})
     * @param pkg the owning package
     * @return this manager
     */
    public AssetManager registerCssVariables(Map<String, String> vars, String pkg) {
        Objects.requireNonNull(pkg, "pkg");
        vars.forEach((name, value) -> cssVariables.put("--" + pkg + "-" + name, value));
        return this;
    }

    /**
     * Builds the {@code <head>} injection block: CSS variables, then stylesheets (core first), then
     * fonts. If any registered {@link Theme} exists, core stylesheets are suppressed and the theme
     * replaces them.
     *
     * @return the head HTML block
     */
    public String renderHead() {
        StringBuilder sb = new StringBuilder();
        if (!cssVariables.isEmpty()) {
            sb.append("<style>:root{");
            cssVariables.forEach((k, v) -> sb.append(k).append(':').append(v).append(';'));
            sb.append("}</style>");
        }
        boolean hasTheme = assets.values().stream().anyMatch(a -> a instanceof Theme);
        ordered(Asset.Slot.HEAD)
                .forEach(
                        asset -> {
                            boolean suppressedCoreCss =
                                    hasTheme
                                            && asset instanceof Css css
                                            && !css.isTheme()
                                            && asset.isCore();
                            if (!suppressedCoreCss) {
                                sb.append(asset.render(versionedUrl(asset)));
                            }
                        });
        return sb.toString();
    }

    /**
     * Builds the block injected before {@code </body>}: the boot script-data block, then scripts
     * (core first).
     *
     * @return the body-end HTML block
     */
    public String renderBodyEnd() {
        StringBuilder sb = new StringBuilder();
        if (!scriptData.isEmpty()) {
            sb.append("<script id=\"lievit-boot-data\" type=\"application/json\">{");
            boolean first = true;
            for (Map.Entry<String, String> e : scriptData.entrySet()) {
                if (!first) {
                    sb.append(',');
                }
                sb.append('"').append(e.getKey()).append("\":").append(e.getValue());
                first = false;
            }
            sb.append("}</script>");
        }
        ordered(Asset.Slot.BODY_END).forEach(asset -> sb.append(asset.render(versionedUrl(asset))));
        return sb.toString();
    }

    /**
     * Resolves an asset's versioned public URL.
     *
     * @param asset the asset
     * @return {@code /lievit/assets/<relativePublicPath>?v=<contentHash>}
     */
    public String versionedUrl(Asset asset) {
        return BASE_URL + "/" + asset.relativePublicPath() + "?v=" + version(asset);
    }

    /**
     * @param asset the asset
     * @return the content-hash version token for the asset
     */
    public String version(Asset asset) {
        CRC32 crc = new CRC32();
        crc.update((asset.pkg() + ":" + asset.id() + ":" + asset.path()).getBytes(StandardCharsets.UTF_8));
        return Long.toHexString(crc.getValue());
    }

    private List<Asset> ordered(Asset.Slot slot) {
        List<Asset> out = new ArrayList<>();
        for (Asset asset : assets.values()) {
            if (asset.slot() == slot) {
                out.add(asset);
            }
        }
        // Stable sort: core assets first, registration order preserved within each tier.
        out.sort(Comparator.comparing((Asset a) -> a.isCore() ? 0 : 1));
        return out;
    }

    private static String key(Asset asset) {
        return asset.pkg() + ":" + asset.id();
    }

    private static String jsonScalar(Object value) {
        if (value instanceof Number || value instanceof Boolean) {
            return value.toString();
        }
        String s = String.valueOf(value).replace("\\", "\\\\").replace("\"", "\\\"");
        return "\"" + s + "\"";
    }
}
