/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * The registry of CSS assets the kit emits {@code <link>}s for (the Filament {@code AssetManager}):
 * the core stylesheet plus any additive {@link Css} or replacing {@link Theme} a plugin/panel
 * registers. The kit reads {@link #stylesheetsFor(String)} when rendering a panel's {@code <head>}:
 * when a panel names a theme, the theme replaces the core stylesheet (the {@link Theme} replace
 * semantics); otherwise the core plus the additive assets load.
 *
 * <p>Wired as a singleton bean and reachable from the non-DI registration phase through
 * {@link Lievit#assets()}.
 */
public final class AssetManager {

    private final Map<String, Css> registered = new LinkedHashMap<>();
    private String coreHref = "/_lievit/kit.css";

    /** @return a manager with no registered assets and the default core stylesheet href */
    public static AssetManager create() {
        return new AssetManager();
    }

    /**
     * Registers an additive CSS asset or a replacing theme.
     *
     * @param css the asset
     * @return this manager
     */
    public AssetManager register(Css css) {
        Objects.requireNonNull(css, "css");
        registered.put(css.name(), css);
        return this;
    }

    /**
     * Overrides the core stylesheet href.
     *
     * @param href the core stylesheet URL
     * @return this manager
     */
    public AssetManager coreStylesheet(String href) {
        this.coreHref = Objects.requireNonNull(href, "href");
        return this;
    }

    /** @return the core stylesheet href */
    public String coreStylesheet() {
        return coreHref;
    }

    /**
     * @param name the asset id
     * @return the registered asset, or {@code null} if none
     */
    public Css asset(String name) {
        return registered.get(name);
    }

    /** @return the registered assets, in registration order */
    public List<Css> assets() {
        return List.copyOf(registered.values());
    }

    /**
     * Resolves the stylesheet hrefs to emit for a panel, honouring the theme-replaces-core rule.
     *
     * @param themeName the panel's registered theme name, or {@code null} for the default skin
     * @return the stylesheet hrefs in load order: either {@code [theme]} (replace) or {@code [core,
     *     additive...]}
     */
    public List<String> stylesheetsFor(String themeName) {
        if (themeName != null) {
            Css css = registered.get(themeName);
            if (css != null && css.replacesCore()) {
                return List.of(css.href());
            }
        }
        List<String> hrefs = new ArrayList<>();
        hrefs.add(coreHref);
        for (Css css : registered.values()) {
            if (!css.replacesCore()) {
                hrefs.add(css.href());
            }
        }
        return Collections.unmodifiableList(hrefs);
    }
}
