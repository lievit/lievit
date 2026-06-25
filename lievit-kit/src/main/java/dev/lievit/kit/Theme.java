/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

/**
 * A custom panel theme (the Filament {@code Support/Assets/Theme}, which extends {@code Css} to mean
 * "replace the core stylesheet"): a compiled CSS file built from a Tailwind v4 theme that
 * <em>replaces</em> the core kit stylesheet for the panel that registers it via
 * {@link Panel#theme(String)}. Unlike a plain additive {@link Css}, a theme is the whole skin.
 *
 * <h2>The build-side contract (purge-safety)</h2>
 *
 * A custom theme is a Tailwind v4 stylesheet. For the utility classes the kit's components emit to
 * survive Tailwind's purge, the app theme MUST declare the kit as a content source. With Tailwind v4
 * the canonical import + source declaration is:
 *
 * <pre>{@code
 * @import "tailwindcss";
 * @import "@lievit/kit/theme.css";          /* the kit's CSS custom-property + base layer *\/
 * @source "../../**\/*.jte";                 /* the app's own templates *\/
 * @source "../node_modules/@lievit/kit";     /* the kit's emitted classes (purge-safety) *\/
 * }</pre>
 *
 * <p>The {@code @source} pointing at the kit is what keeps kit-emitted classes
 * ({@code fi-color-*}, the layout grid, the table/badge utilities) from being purged out of a
 * bespoke theme. Omitting it is the classic "my custom theme dropped half the styles" bug.
 *
 * <h2>The CSS custom-property contract (what an app may override)</h2>
 *
 * The kit reads these CSS custom properties; a theme overrides them to restyle without touching
 * markup (the same vars {@link Color#cssClass(String)} keys on):
 *
 * <ul>
 *   <li>{@code --primary-50 … --primary-950} (and the other palette ramps): the brand colour ramp.
 *   <li>{@code --kit-radius}: the global corner radius.
 *   <li>{@code --kit-spacing}: the base spacing unit.
 *   <li>{@code --kit-font-sans}: the UI font stack.
 * </ul>
 *
 * <h2>Dark mode</h2>
 *
 * The kit uses the class strategy ({@code <html class="dark">} toggled by the theme switcher), not
 * the media strategy, so a theme that wants dark mode declares {@code @custom-variant dark
 * (&:where(.dark, .dark *))} and styles under it. {@link Panel#defaultThemeMode(ThemeMode)} decides
 * the initial mode; the switcher flips the class.
 */
public final class Theme extends Css {

    /**
     * @param name the theme id (the panel references it via {@link Panel#theme(String)})
     * @param href the compiled stylesheet URL that replaces the core
     */
    public Theme(String name, String href) {
        super(name, href);
    }

    /**
     * @param name the theme id
     * @param href the compiled stylesheet URL
     * @return a theme that replaces the core stylesheet
     */
    public static Theme make(String name, String href) {
        return new Theme(name, href);
    }

    @Override
    public boolean replacesCore() {
        return true;
    }
}
