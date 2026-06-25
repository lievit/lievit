/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

/**
 * A font asset (injected as a preload {@code <link rel="preload" as="font">} in the head). The kit
 * preloads the panel's display font; an app or plugin registers its own.
 */
public final class Font extends Asset {

    private Font(String id, String path) {
        super(id, path);
    }

    /**
     * @param id the asset id
     * @param path the font source path
     * @return a new font asset
     */
    public static Font make(String id, String path) {
        return new Font(id, path);
    }

    @Override
    public Font pkg(String pkg) {
        super.pkg(pkg);
        return this;
    }

    @Override
    public Font core() {
        super.core();
        return this;
    }

    @Override
    public Slot slot() {
        return Slot.HEAD;
    }

    @Override
    public String relativePublicPath() {
        return "fonts/" + pkg() + "/" + id();
    }

    @Override
    public String render(String versionedUrl) {
        return "<link rel=\"preload\" as=\"font\" crossorigin href=\""
                + attr(versionedUrl)
                + "\">";
    }
}
