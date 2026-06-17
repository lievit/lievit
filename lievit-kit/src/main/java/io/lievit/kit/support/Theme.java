/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.support;

/**
 * A theme stylesheet: a {@link Css} that REPLACES the kit's core stylesheet for a panel rather than
 * appending to it (the filament-support {@code Theme extends Css} = replace semantics). When a
 * panel registers a theme, {@link AssetManager} drops the core stylesheet from the head and injects
 * the theme in its place. This is the "ship one CSS file to reskin the admin" path.
 */
public final class Theme extends Css {

    private Theme(String id, String path) {
        super(id, path);
    }

    /**
     * @param id the theme id
     * @param path the compiled theme CSS source path
     * @return a new theme asset
     */
    public static Theme make(String id, String path) {
        return new Theme(id, path);
    }

    @Override
    public Theme pkg(String pkg) {
        super.pkg(pkg);
        return this;
    }

    @Override
    public Theme core() {
        super.core();
        return this;
    }

    @Override
    public boolean isTheme() {
        return true;
    }
}
