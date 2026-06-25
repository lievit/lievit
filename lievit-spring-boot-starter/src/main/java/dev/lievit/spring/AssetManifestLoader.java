/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

import org.springframework.core.io.ClassPathResource;

import dev.lievit.compiler.AssetManifest;
import tools.jackson.databind.ObjectMapper;

/**
 * Loads the Vite build manifest ({@code .vite/manifest.json}, issue #171, ADR-0060) off the classpath
 * into the compiler's {@link AssetManifest}. The manifest lets the {@link LievitAssetController} serve
 * the runtime bundle by its content-hashed name (versioned, long-cacheable, busted only when the
 * bytes change). When no manifest is on the classpath (dev mode, or a build that did not emit one),
 * this returns {@link AssetManifest#EMPTY} so the controller falls back to the fixed unhashed bundle
 * file: "it works in dev with no build step, it is versioned in prod with the build".
 *
 * <p>The manifest is parsed once at startup and held immutable: a production manifest never changes
 * within a process. Resolution is relative to the configured runtime classpath dir
 * ({@code lievit.assets.classpath-dir}).
 */
public final class AssetManifestLoader {

    private AssetManifestLoader() {}

    /**
     * Reads and parses the manifest at {@code <classpathDir>/<manifestPath>}.
     *
     * @param classpathDir the runtime bundle classpath dir (e.g. {@code lievit-runtime})
     * @param manifestPath the manifest path relative to it (e.g. {@code .vite/manifest.json})
     * @param json the Jackson mapper
     * @return the parsed manifest, or {@link AssetManifest#EMPTY} when none is present / unreadable
     */
    @SuppressWarnings("unchecked")
    public static AssetManifest load(String classpathDir, String manifestPath, ObjectMapper json) {
        String location = join(classpathDir, manifestPath);
        ClassPathResource resource = new ClassPathResource(location);
        if (!resource.exists()) {
            return AssetManifest.EMPTY;
        }
        try (InputStream in = resource.getInputStream()) {
            Map<String, ?> raw = json.readValue(in, Map.class);
            return AssetManifest.of(raw);
        } catch (IOException | RuntimeException e) {
            // A malformed/unreadable manifest must not crash startup: fall back to dev serving (the
            // unhashed bundle still loads), the build just is not versioned. Fail soft, not closed.
            return AssetManifest.EMPTY;
        }
    }

    private static String join(String dir, String path) {
        String d = dir.endsWith("/") ? dir.substring(0, dir.length() - 1) : dir;
        String p = path.startsWith("/") ? path.substring(1) : path;
        return d.isEmpty() ? p : d + "/" + p;
    }
}
