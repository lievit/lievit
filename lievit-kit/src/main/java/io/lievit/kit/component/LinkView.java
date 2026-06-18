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

/**
 * The link view-model (the Filament {@code LinkComponent} carried over): a text link with a target
 * href, an optional color, and an optional leading icon. The kit carries the href verbatim; the JTE
 * partial owns the attribute-escaping when it emits it.
 */
public final class LinkView {

    /** The base CSS class every link carries. */
    public static final String BASE = "lievit-link";

    private final String label;
    private final String href;
    private String color = ColorManager.DEFAULT;
    private @Nullable String icon;

    private LinkView(String label, String href) {
        this.label = Objects.requireNonNull(label, "label");
        this.href = Objects.requireNonNull(href, "href");
    }

    /**
     * @param label the link text
     * @param href the link target
     * @return a link view
     */
    public static LinkView make(String label, String href) {
        return new LinkView(label, href);
    }

    /**
     * @param colorName the semantic color name
     * @return this view
     */
    public LinkView color(String colorName) {
        this.color = Objects.requireNonNull(colorName, "colorName");
        return this;
    }

    /**
     * @param iconNameOrAlias the icon name or alias
     * @return this view
     */
    public LinkView icon(String iconNameOrAlias) {
        this.icon = Objects.requireNonNull(iconNameOrAlias, "iconNameOrAlias");
        return this;
    }

    /** @return the link text */
    public String label() {
        return label;
    }

    /** @return the link target href */
    public String href() {
        return href;
    }

    /**
     * @param colors the color registry
     * @return the resolved CSS classes the JTE link partial emits
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
