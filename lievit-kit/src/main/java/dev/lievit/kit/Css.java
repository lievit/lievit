/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;

/**
 * A registered CSS asset (the Filament {@code Support/Assets/Css}): a named stylesheet the kit
 * emits a {@code <link>} for. A plain {@code Css} is <em>additive</em> (it loads alongside the core
 * kit stylesheet); a {@link Theme} is a {@code Css} that <em>replaces</em> the core stylesheet for a
 * panel (the {@link #replacesCore() replace} semantics, the Filament rule "Theme extends Css =
 * replace").
 *
 * @param name the asset id (the panel references a theme by this name)
 * @param href the stylesheet URL the {@code <link>} points to
 */
public sealed class Css permits Theme {

    private final String name;
    private final String href;

    /**
     * @param name the asset id
     * @param href the stylesheet URL
     */
    public Css(String name, String href) {
        this.name = Objects.requireNonNull(name, "name");
        this.href = Objects.requireNonNull(href, "href");
    }

    /**
     * @param name the asset id
     * @param href the stylesheet URL
     * @return an additive CSS asset (loaded alongside the core stylesheet)
     */
    public static Css make(String name, String href) {
        return new Css(name, href);
    }

    /** @return the asset id */
    public final String name() {
        return name;
    }

    /** @return the stylesheet URL */
    public final String href() {
        return href;
    }

    /**
     * @return whether this asset replaces the core kit stylesheet (a plain {@code Css} is additive;
     *     a {@link Theme} replaces)
     */
    public boolean replacesCore() {
        return false;
    }
}
