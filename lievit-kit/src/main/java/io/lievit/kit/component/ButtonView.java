/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.component;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.support.ColorManager;
import io.lievit.kit.support.IconManager;
import io.lievit.kit.support.Size;

/**
 * The button view-model (the Filament {@code ButtonComponent} carried over): a labelled, colored,
 * sized button with an optional leading icon and an outlined variant. {@link #cssClasses} resolves
 * the stable classes the JTE button partial emits; {@link #resolvedIcon} resolves the icon alias.
 */
public final class ButtonView {

    /** The base CSS class every button carries. */
    public static final String BASE = "lievit-btn";

    private final String label;
    private String color = ColorManager.DEFAULT;
    private Size size = Size.MEDIUM;
    private @Nullable String icon;
    private boolean outlined;

    private ButtonView(String label) {
        this.label = Objects.requireNonNull(label, "label");
    }

    /**
     * @param label the button label
     * @return a button view
     */
    public static ButtonView make(String label) {
        return new ButtonView(label);
    }

    /**
     * @param colorName the semantic color name
     * @return this view
     */
    public ButtonView color(String colorName) {
        this.color = Objects.requireNonNull(colorName, "colorName");
        return this;
    }

    /**
     * @param s the button size
     * @return this view
     */
    public ButtonView size(Size s) {
        this.size = Objects.requireNonNull(s, "s");
        return this;
    }

    /**
     * @param iconNameOrAlias the icon name or semantic alias
     * @return this view
     */
    public ButtonView icon(String iconNameOrAlias) {
        this.icon = Objects.requireNonNull(iconNameOrAlias, "iconNameOrAlias");
        return this;
    }

    /**
     * @return this view as an outlined button
     */
    public ButtonView outlined() {
        this.outlined = true;
        return this;
    }

    /** @return the button label */
    public String label() {
        return label;
    }

    /**
     * Resolves the CSS classes the JTE button partial emits: the base class, the color class (via
     * the manager, with the default fallback), the size class, and the outlined modifier.
     *
     * @param colors the color registry
     * @return the resolved classes, in stable order
     */
    public List<String> cssClasses(ColorManager colors) {
        List<String> classes = new ArrayList<>();
        classes.add(BASE);
        classes.add(colors.cssClass(BASE, color));
        classes.add(BASE + "-" + size.token());
        if (outlined) {
            classes.add(BASE + "-outlined");
        }
        return List.copyOf(classes);
    }

    /**
     * @param icons the icon registry
     * @return the resolved icon name, empty if the button has no icon
     */
    public Optional<String> resolvedIcon(IconManager icons) {
        return icon == null ? Optional.empty() : Optional.of(icons.resolve(icon));
    }
}
