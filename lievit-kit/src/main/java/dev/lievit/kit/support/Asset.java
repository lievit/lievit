/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * A registrable front-end asset (the filament-support {@code Asset} hierarchy carried over): a CSS,
 * JS or font file, keyed by an {@code id} and a {@code package} (so the kit core, each panel, and
 * each plugin register under their own namespace). The {@link AssetManager} collects assets and the
 * layout layer injects them (styles in the head, scripts before the body close).
 *
 * <p>The {@code path} is the source the manager resolves to a versioned public URL
 * ({@code /lievit/assets/<package>/<id>.<ext>?v=<hash>}); the content-hash query param is the
 * cache-buster. Subtypes set their own type and rendering flags.
 */
public abstract sealed class Asset permits Css, Js, Font {

    /** Where the asset injects in the page. */
    public enum Slot {
        /** Inside {@code <head>} (stylesheets, fonts). */
        HEAD,
        /** Before {@code </body>} (scripts). */
        BODY_END
    }

    private final String id;
    private String pkg = "lievit";
    private final String path;
    private boolean core;
    private boolean loadedOnce;

    /**
     * @param id the asset id, unique within its package
     * @param path the source path the manager resolves to a versioned public URL
     */
    protected Asset(String id, String path) {
        this.id = Objects.requireNonNull(id, "id");
        this.path = Objects.requireNonNull(path, "path");
    }

    /**
     * @return the asset id
     */
    public String id() {
        return id;
    }

    /**
     * Sets the owning package namespace (the kit core, a panel, or a plugin). Subtypes override
     * with a covariant return so the fluent chain keeps the concrete type.
     *
     * @param pkg the package name
     * @return this asset
     */
    public Asset pkg(String pkg) {
        this.pkg = Objects.requireNonNull(pkg, "pkg");
        return this;
    }

    /**
     * @return the owning package namespace (default {@code "lievit"})
     */
    public String pkg() {
        return pkg;
    }

    /**
     * @return the source path
     */
    public String path() {
        return path;
    }

    /**
     * Marks the asset as a core asset (always injected, before non-core assets).
     *
     * @return this asset
     */
    public Asset core() {
        this.core = true;
        return this;
    }

    /**
     * @return {@code true} if this is a core asset (injected first)
     */
    public boolean isCore() {
        return core;
    }

    /**
     * Marks the asset to load only once across SPA-style navigations (not re-injected on a
     * partial wire navigation).
     *
     * @return this asset
     */
    public Asset loadedOnce() {
        this.loadedOnce = true;
        return this;
    }

    /**
     * @return {@code true} if the asset loads once per page lifetime
     */
    public boolean isLoadedOnce() {
        return loadedOnce;
    }

    /**
     * @return the slot this asset injects into
     */
    public abstract Slot slot();

    /**
     * The default public path of the asset: {@code <type>/<package>/<id>.<ext>} (the filament
     * {@code getRelativePublicPath} default), used when no explicit path resolution is configured.
     *
     * @return the relative public path
     */
    public abstract String relativePublicPath();

    /**
     * Renders the full HTML tag for this asset against a resolved, versioned URL.
     *
     * @param versionedUrl the public URL with the content-hash cache-buster
     * @return the {@code <link>} / {@code <script>} / font tag
     */
    public abstract String render(String versionedUrl);

    /** Escapes a URL for safe attribute embedding (defensive against a crafted package/id). */
    static String attr(@Nullable String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("\"", "&quot;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }
}
