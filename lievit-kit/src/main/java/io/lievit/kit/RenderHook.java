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
 * <p>This is the standard hook catalog (the Filament {@code FilamentView::renderHook} names): the
 * layout-level body/content slots, the topbar and sidebar slots, the page slots, and the auth-page
 * slots. A hook may be registered globally or {@linkplain Panel#renderHook(String, String,
 * java.util.function.Supplier) scoped} to a single page/resource class, so a fragment fires only on
 * the declared surface and nowhere else. The layout calls {@link Panel#hasRenderHook(String)} to
 * skip the wrapper markup when nothing is registered.
 */
public final class RenderHook {

    // --- layout body ---

    /** Just inside the {@code <body>}, before anything else. */
    public static final String BODY_START = "kit::body.start";

    /** Just before the page content area (after the sidebar / header). */
    public static final String CONTENT_BEFORE = "kit::content.before";

    /** Just after the page content area. */
    public static final String CONTENT_AFTER = "kit::content.after";

    /** Just before the closing {@code </body>}. */
    public static final String BODY_END = "kit::body.end";

    // --- topbar ---

    /** The start (leading edge) of the topbar. */
    public static final String TOPBAR_START = "kit::topbar.start";

    /** The end (trailing edge) of the topbar, before the user menu. */
    public static final String TOPBAR_END = "kit::topbar.end";

    // --- sidebar ---

    /** The start of the sidebar navigation, after the brand. */
    public static final String SIDEBAR_NAV_START = "kit::sidebar.nav.start";

    /** The end of the sidebar navigation. */
    public static final String SIDEBAR_NAV_END = "kit::sidebar.nav.end";

    // --- page ---

    /** The start of a page's content, before its heading. */
    public static final String PAGE_START = "kit::page.start";

    /** The end of a page's content. */
    public static final String PAGE_END = "kit::page.end";

    // --- auth pages ---

    /** Before the login form. */
    public static final String AUTH_LOGIN_FORM_BEFORE = "kit::auth.login.form.before";

    /** After the login form. */
    public static final String AUTH_LOGIN_FORM_AFTER = "kit::auth.login.form.after";

    private RenderHook() {}
}
