/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import io.lievit.compiler.AssetManifest;
import io.lievit.compiler.ComponentCompiler;
import io.lievit.compiler.CompiledComponent;
import io.lievit.component.ComponentMetadata;

/**
 * Serves the lievit client assets (issue #171/#129, ADR-0060/0063): the runtime bundle at
 * {@code /lievit/lievit.js}, the Vite-hashed bundle files under {@code /lievit/assets/**}, the
 * per-component dev module under {@code /lievit/module/**}, and each component's scoped CSS at
 * {@code /lievit/css/{component}}. This is the canonical Spring serving approach: the assets are
 * packaged on the classpath under {@code lievit.assets.classpath-dir} (the Vite build output), and the
 * controller resolves the content-hashed file through the {@link AssetManifest} so the served URL is
 * versioned and the browser can cache it indefinitely (a hashed file is immutable). When no manifest
 * is present (dev), the runtime serves the fixed unhashed bundle and a hashed cache TTL is not
 * claimed.
 *
 * <p>Under the strict CSP (ADR-0019) the served JS is an external module the page references by
 * {@code src} with a nonce, never inline; this controller only serves the bytes, the nonce rides on
 * the injected tag ({@link LievitAssetInjector}). The scoped CSS route wraps the component's colocated
 * stylesheet in its {@code [data-lievit-scope]} selector ({@link ScopedCss}) so the rules cannot leak,
 * and is cache-busted by the content hash the {@code styleModule} effect carries.
 */
@RestController
public final class LievitAssetController {

    private final ComponentRegistry registry;
    private final ComponentCompiler compiler;
    private final AssetManifest manifest;
    private final String classpathDir;
    private final String runtimeEntry;
    private final CacheControl immutableCache =
            CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable();
    private final CacheControl noVersionCache = CacheControl.noCache();

    /**
     * @param registry resolves a component name to its metadata (the CSS route)
     * @param compiler reads a component's colocated CSS (cached)
     * @param manifest the Vite build manifest (resolves the runtime entry to its hashed file)
     * @param properties the bound {@code lievit.assets.*} config (classpath dir + runtime entry)
     */
    public LievitAssetController(
            ComponentRegistry registry,
            ComponentCompiler compiler,
            AssetManifest manifest,
            LievitProperties properties) {
        this.registry = registry;
        this.compiler = compiler;
        this.manifest = manifest;
        this.classpathDir = stripTrailingSlash(properties.getAssets().getClasspathDir());
        this.runtimeEntry = properties.getAssets().getRuntimeEntry();
    }

    /**
     * Serves the runtime bundle. With a Vite manifest, redirects (302) to the content-hashed asset URL
     * so the browser caches the immutable file; without one (dev), serves the fixed unhashed bundle
     * inline. The stable {@code /lievit/lievit.js} path is the bootstrap URL the injected
     * {@code <script src>} references; versioning happens behind it.
     *
     * @return the runtime JS, or a redirect to its hashed URL, or 404 when no bundle is packaged
     */
    @GetMapping("/lievit/lievit.js")
    public ResponseEntity<byte[]> runtime() {
        Optional<AssetManifest.Entry> entry = manifest.resolve(runtimeEntry);
        if (entry.isPresent()) {
            // The hashed file is immutable: point the browser at it so it caches forever.
            return ResponseEntity.status(302)
                    .header(HttpHeaders.LOCATION, "/lievit/assets/" + entry.get().file())
                    .build();
        }
        // Dev / no manifest: serve the unhashed bundle directly (no immutable cache claim).
        return readClasspath(classpathDir + "/lievit.js", MediaType.valueOf("text/javascript"), noVersionCache);
    }

    /**
     * Serves a Vite-hashed bundle file (immutable cache). The {@code file} is a hashed name from the
     * manifest, so the bytes never change for a given URL.
     *
     * @param file the hashed file path under the bundle output (e.g. {@code assets/index-AbCd.js})
     * @return the asset bytes, or 404 when the file is not packaged
     */
    @GetMapping("/lievit/assets/**")
    public ResponseEntity<byte[]> hashedAsset(jakarta.servlet.http.HttpServletRequest request) {
        String file = afterPrefix(request.getRequestURI(), "/lievit/assets/");
        if (file == null || file.contains("..")) {
            return ResponseEntity.notFound().build();
        }
        return readClasspath(classpathDir + "/" + file, mediaTypeFor(file), immutableCache);
    }

    /**
     * Serves a per-component client module by its classpath resource path (the dev fallback when no
     * Vite manifest hashed it). The path is the compiler-recorded module resource (e.g.
     * {@code io/lievit/spring/asset/Widget.lievit.ts}); it is served as a JS module.
     *
     * @param request the request (the module path follows {@code /lievit/module/})
     * @return the module bytes, or 404 when the resource is not packaged / the path escapes the root
     */
    @GetMapping("/lievit/module/**")
    public ResponseEntity<byte[]> module(jakarta.servlet.http.HttpServletRequest request) {
        String path = afterPrefix(request.getRequestURI(), "/lievit/module/");
        if (path == null || path.contains("..")) {
            return ResponseEntity.notFound().build();
        }
        return readClasspath(path, MediaType.valueOf("text/javascript"), noVersionCache);
    }

    /**
     * Serves a component's scoped CSS (issue #129): the colocated stylesheet wrapped in the
     * component's {@code [data-lievit-scope]} selector so its rules apply only to that component's
     * subtree. Cache-busted by the {@code ?v=<hash>} the {@code styleModule} effect carries: a
     * versioned request caches immutably, an unversioned one is revalidated.
     *
     * @param component the component name (the {@code data-lievit-component} value)
     * @param version the content-hash query param ({@code v}), present when the client follows a
     *     {@code styleModule} effect
     * @return the scoped CSS, or 404 when the component declares none / is unknown
     */
    @GetMapping(path = "/lievit/css/{component}", produces = "text/css")
    public ResponseEntity<byte[]> componentCss(
            @PathVariable String component,
            @org.springframework.web.bind.annotation.RequestParam(name = "v", required = false)
                    String version) {
        ComponentMetadata metadata;
        try {
            metadata = registry.metadataByName(component);
        } catch (RuntimeException unknown) {
            return ResponseEntity.notFound().build();
        }
        CompiledComponent compiled = compiler.compile(metadata.type());
        Optional<String> style = compiled.style();
        if (style.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        String scoped = ScopedCss.scope(style.get(), metadata.className());
        byte[] body = scoped.getBytes(StandardCharsets.UTF_8);
        CacheControl cache = version != null && !version.isBlank() ? immutableCache : noVersionCache;
        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("text/css"))
                .cacheControl(cache)
                .body(body);
    }

    private static ResponseEntity<byte[]> readClasspath(
            String location, MediaType type, CacheControl cache) {
        ClassPathResource resource = new ClassPathResource(location);
        if (!resource.exists() || !resource.isReadable()) {
            return ResponseEntity.notFound().build();
        }
        try {
            byte[] bytes = resource.getInputStream().readAllBytes();
            return ResponseEntity.ok().contentType(type).cacheControl(cache).body(bytes);
        } catch (IOException e) {
            return ResponseEntity.notFound().build();
        }
    }

    private static MediaType mediaTypeFor(String file) {
        if (file.endsWith(".css")) {
            return MediaType.valueOf("text/css");
        }
        if (file.endsWith(".map") || file.endsWith(".json")) {
            return MediaType.APPLICATION_JSON;
        }
        return MediaType.valueOf("text/javascript");
    }

    private static String afterPrefix(String uri, String prefix) {
        int at = uri.indexOf(prefix);
        return at < 0 ? null : uri.substring(at + prefix.length());
    }

    private static String stripTrailingSlash(String path) {
        return path.endsWith("/") ? path.substring(0, path.length() - 1) : path;
    }
}
