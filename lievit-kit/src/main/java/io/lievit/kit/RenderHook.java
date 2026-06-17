/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The named injection points of the admin layout: the primary customization surface that does not
 * require forking a published view (the load-bearing filament-internals.md lesson, "render hooks
 * beat published views").
 *
 * <p>An adopter or {@link Plugin} registers a hook against one of these names with {@link
 * Panel#renderHook(String, java.util.function.Supplier)}; the layout stamps the registered
 * fragments at each point. Because the surface is a fixed set of {@code String} constants, the
 * layout HTML stays owned by the kit and survives upgrades, unlike Filament's "publish the view and
 * hand-merge it forever".
 *
 * <p>v0.1 ships the four points the skeleton layout needs; the set grows as the layout does.
 */
public final class RenderHook {

    /** Just inside the {@code <body>}, before anything else. */
    public static final String BODY_START = "kit::body.start";

    /** Just before the page content area (after the sidebar / header). */
    public static final String CONTENT_BEFORE = "kit::content.before";

    /** Just after the page content area. */
    public static final String CONTENT_AFTER = "kit::content.after";

    /** Just before the closing {@code </body>}. */
    public static final String BODY_END = "kit::body.end";

    private RenderHook() {}
}
