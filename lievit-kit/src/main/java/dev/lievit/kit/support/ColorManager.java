/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * The kit color registry (the filament-app {@code FilamentColor} / {@code ColorManager} carried
 * over): semantic color NAMES ({@code primary}, {@code danger}, {@code success}, {@code warning},
 * {@code gray}, {@code info}) bound to a {@link Color} ramp, and the name-to-CSS-class mapping a
 * badge/button/icon uses to style itself.
 *
 * <p>The kit registers sane defaults at construction; an app or plugin overrides a name with
 * {@link #register(String, Color)} (last write wins, so a panel can rebrand {@code primary}). The
 * CSS-class mapping ({@link #cssClass(String, String)}) is the stable contract the templates emit;
 * a badge with color {@code danger} renders class {@code lievit-color-danger}, and the theme
 * stylesheet binds that class to the registered ramp via CSS custom properties.
 */
public final class ColorManager {

    /** The semantic color name applied by default when none is set. */
    public static final String DEFAULT = "primary";

    private final Map<String, Color> colors = new LinkedHashMap<>();

    /** Builds a manager pre-loaded with the kit's default semantic palette. */
    public ColorManager() {
        register("primary", Colors.BLUE);
        register("danger", Colors.RED);
        register("success", Colors.GREEN);
        register("warning", Colors.AMBER);
        register("info", Colors.BLUE);
        register("gray", Colors.GRAY);
    }

    /**
     * Registers (or overrides) a semantic color name with a ramp. Last write wins.
     *
     * @param name the semantic name ({@code primary}, {@code danger}, …)
     * @param color the ramp to bind
     * @return this manager
     */
    public ColorManager register(String name, Color color) {
        colors.put(Objects.requireNonNull(name, "name"), Objects.requireNonNull(color, "color"));
        return this;
    }

    /**
     * @param name the semantic color name
     * @return the bound ramp, empty if the name is not registered
     */
    public Optional<Color> color(String name) {
        return Optional.ofNullable(colors.get(name));
    }

    /**
     * @return every registered semantic name (iteration order = registration order)
     */
    public Set<String> names() {
        return Set.copyOf(colors.keySet());
    }

    /**
     * Maps a semantic color name to its stable CSS class, the contract the templates emit.
     *
     * @param prefix the component-scoped class prefix (for example {@code "lievit-badge"})
     * @param name the semantic color name
     * @return the CSS class ({@code prefix-name}); falls back to {@link #DEFAULT} when the name is
     *     not registered, so an unknown color never produces an unstyled element
     */
    public String cssClass(String prefix, String name) {
        Objects.requireNonNull(prefix, "prefix");
        String resolved = colors.containsKey(name) ? name : DEFAULT;
        return prefix + "-" + resolved;
    }

    /**
     * Emits every registered color as CSS custom properties the theme stylesheet consumes (the
     * filament-support {@code componentCustomStyles} / theme-CSS-variable bridge). Each shade of
     * each color becomes one declaration, {@code --lievit-{name}-{shade}: {value};}, so a generated
     * or overridden ramp flows straight into the stylesheet without recompiling Tailwind.
     *
     * <p>This is the seam that closes the theming loop: an app registers a generated ramp (or
     * overrides one shade), and the emitted block is dropped into a {@code :root} rule the theme
     * binds its utility classes to.
     *
     * @return the CSS custom-property declarations, one per shade, in registration + shade order
     */
    public String cssVariables() {
        StringBuilder out = new StringBuilder();
        for (Map.Entry<String, Color> entry : colors.entrySet()) {
            String name = entry.getKey();
            for (Map.Entry<Integer, String> shade : entry.getValue().ramp().entrySet()) {
                out.append("--lievit-")
                        .append(name)
                        .append('-')
                        .append(shade.getKey())
                        .append(": ")
                        .append(shade.getValue())
                        .append(";\n");
            }
        }
        return out.toString();
    }
}
