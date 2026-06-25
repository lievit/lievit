/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

/**
 * A JavaScript asset (injected as a {@code <script>} before the body close). Carries the per-asset
 * rendering flags ({@code async}, {@code defer}, {@code module}); an ES-module island that
 * registers a Lit custom element is a {@code Js.make(...).module()} (the kit's mapping of
 * Filament's {@code AlpineComponent} to the Lit/htmx idiom).
 */
public final class Js extends Asset {

    private boolean async;
    private boolean defer;
    private boolean module;

    private Js(String id, String path) {
        super(id, path);
    }

    /**
     * @param id the asset id
     * @param path the source path
     * @return a new JS asset
     */
    public static Js make(String id, String path) {
        return new Js(id, path);
    }

    @Override
    public Js pkg(String pkg) {
        super.pkg(pkg);
        return this;
    }

    @Override
    public Js core() {
        super.core();
        return this;
    }

    @Override
    public Js loadedOnce() {
        super.loadedOnce();
        return this;
    }

    /**
     * Marks the script {@code async}.
     *
     * @return this asset
     */
    public Js async() {
        this.async = true;
        return this;
    }

    /**
     * Marks the script {@code defer}.
     *
     * @return this asset
     */
    public Js defer() {
        this.defer = true;
        return this;
    }

    /**
     * Marks the script {@code type="module"} (an ES-module island, e.g. a Lit custom element).
     *
     * @return this asset
     */
    public Js module() {
        this.module = true;
        return this;
    }

    /**
     * @return {@code true} if the script is async
     */
    public boolean isAsync() {
        return async;
    }

    /**
     * @return {@code true} if the script is deferred
     */
    public boolean isDefer() {
        return defer;
    }

    /**
     * @return {@code true} if the script is an ES module
     */
    public boolean isModule() {
        return module;
    }

    @Override
    public Slot slot() {
        return Slot.BODY_END;
    }

    @Override
    public String relativePublicPath() {
        return "js/" + pkg() + "/" + id() + ".js";
    }

    @Override
    public String render(String versionedUrl) {
        StringBuilder sb = new StringBuilder("<script src=\"").append(attr(versionedUrl)).append('"');
        if (module) {
            sb.append(" type=\"module\"");
        }
        if (async) {
            sb.append(" async");
        }
        if (defer) {
            sb.append(" defer");
        }
        return sb.append("></script>").toString();
    }
}
