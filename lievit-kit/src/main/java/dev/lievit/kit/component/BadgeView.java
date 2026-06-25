/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.component;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.support.ColorManager;
import dev.lievit.kit.support.IconManager;

/**
 * The badge view-model (the Filament {@code BadgeComponent} carried over): a small colored label,
 * optionally with a leading icon. Used by badge columns, notification chips, and status indicators.
 */
public final class BadgeView {

    /** The base CSS class every badge carries. */
    public static final String BASE = "lievit-badge";

    private final String label;
    private String color = ColorManager.DEFAULT;
    private @Nullable String icon;

    private BadgeView(String label) {
        this.label = Objects.requireNonNull(label, "label");
    }

    /**
     * @param label the badge text
     * @return a badge view
     */
    public static BadgeView make(String label) {
        return new BadgeView(label);
    }

    /**
     * @param colorName the semantic color name
     * @return this view
     */
    public BadgeView color(String colorName) {
        this.color = Objects.requireNonNull(colorName, "colorName");
        return this;
    }

    /**
     * @param iconNameOrAlias the icon name or alias
     * @return this view
     */
    public BadgeView icon(String iconNameOrAlias) {
        this.icon = Objects.requireNonNull(iconNameOrAlias, "iconNameOrAlias");
        return this;
    }

    /** @return the badge text */
    public String label() {
        return label;
    }

    /**
     * @param colors the color registry
     * @return the resolved CSS classes the JTE badge partial emits
     */
    public List<String> cssClasses(ColorManager colors) {
        List<String> classes = new ArrayList<>();
        classes.add(BASE);
        classes.add(colors.cssClass(BASE, color));
        return List.copyOf(classes);
    }

    /**
     * @param icons the icon registry
     * @return the resolved icon name, empty if none
     */
    public Optional<String> resolvedIcon(IconManager icons) {
        return icon == null ? Optional.empty() : Optional.of(icons.resolve(icon));
    }
}
