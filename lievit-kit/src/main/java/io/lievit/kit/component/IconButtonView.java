/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.component;

import io.lievit.kit.support.ColorManager;
import io.lievit.kit.support.IconManager;
import io.lievit.kit.support.Size;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * The icon-button view-model (the Filament {@code IconButtonComponent} carried over): an icon-only
 * button for tight rows. The icon is mandatory; the accessible label rides as the button's
 * {@code aria-label} / tooltip, which the JTE partial emits.
 */
public final class IconButtonView {

    /** The base CSS class every icon-button carries. */
    public static final String BASE = "lievit-icon-btn";

    private final String label;
    private final String icon;
    private String color = ColorManager.DEFAULT;
    private Size size = Size.MEDIUM;

    private IconButtonView(String label, String icon) {
        this.label = Objects.requireNonNull(label, "label");
        this.icon = Objects.requireNonNull(icon, "icon");
    }

    /**
     * @param label the accessible label (aria-label / tooltip)
     * @param iconNameOrAlias the icon name or alias
     * @return an icon-button view
     */
    public static IconButtonView make(String label, String iconNameOrAlias) {
        return new IconButtonView(label, iconNameOrAlias);
    }

    /**
     * @param colorName the semantic color name
     * @return this view
     */
    public IconButtonView color(String colorName) {
        this.color = Objects.requireNonNull(colorName, "colorName");
        return this;
    }

    /**
     * @param s the button size
     * @return this view
     */
    public IconButtonView size(Size s) {
        this.size = Objects.requireNonNull(s, "s");
        return this;
    }

    /** @return the accessible label */
    public String label() {
        return label;
    }

    /**
     * @param colors the color registry
     * @return the resolved CSS classes the JTE icon-button partial emits
     */
    public List<String> cssClasses(ColorManager colors) {
        List<String> classes = new ArrayList<>();
        classes.add(BASE);
        classes.add(colors.cssClass(BASE, color));
        classes.add(BASE + "-" + size.token());
        return List.copyOf(classes);
    }

    /**
     * @param icons the icon registry
     * @return the resolved icon name (always present)
     */
    public String resolvedIcon(IconManager icons) {
        return icons.resolve(icon);
    }
}
