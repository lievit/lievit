/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

/**
 * A CSS stylesheet asset (injected as a {@code <link rel="stylesheet">} in the head). A
 * {@link Theme} is a CSS that REPLACES the core stylesheet rather than appending; a plain
 * {@code Css} appends.
 */
public sealed class Css extends Asset permits Theme {

    Css(String id, String path) {
        super(id, path);
    }

    /**
     * @param id the asset id
     * @param path the source path
     * @return a new CSS asset
     */
    public static Css make(String id, String path) {
        return new Css(id, path);
    }

    @Override
    public Css pkg(String pkg) {
        super.pkg(pkg);
        return this;
    }

    @Override
    public Css core() {
        super.core();
        return this;
    }

    @Override
    public Css loadedOnce() {
        super.loadedOnce();
        return this;
    }

    @Override
    public Slot slot() {
        return Slot.HEAD;
    }

    @Override
    public String relativePublicPath() {
        return "css/" + pkg() + "/" + id() + ".css";
    }

    /**
     * @return {@code false}; a plain CSS asset appends to the page, only a {@link Theme} replaces
     */
    public boolean isTheme() {
        return false;
    }

    @Override
    public String render(String versionedUrl) {
        return "<link rel=\"stylesheet\" href=\"" + attr(versionedUrl) + "\">";
    }
}
