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
import java.util.Optional;
import java.util.function.Supplier;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.auth.EmailVerificationPage;
import dev.lievit.kit.auth.LoginPage;
import dev.lievit.kit.auth.PasswordResetPage;
import dev.lievit.kit.auth.RegisterPage;
import dev.lievit.kit.cluster.Cluster;
import dev.lievit.kit.tenancy.Tenancy;

/**
 * A named, independently configurable admin surface, built with a fluent DSL (the
 * filament-internals.md Panel builder, mapped to a Spring configuration DSL instead of a Laravel
 * {@code ServiceProvider}). One application can run several panels (for example {@code admin} and a
 * customer portal), each with its own resources, pages, render hooks, and plugins.
 *
 * <p>Deliberately kept under ten concerns (the filament-internals.md lesson: Filament's {@code Panel}
 * accumulates ~35 traits; heavy concerns like tenancy and multi-auth are opt-in later modules, not
 * baked into the core panel). v0.1 holds resources, render hooks, and plugins.
 */
public final class Panel {

    private final String id;
    private String path;
    private boolean isDefault;
    private final List<Resource<?>> resources = new ArrayList<>();
    private final List<WidgetPage> pages = new ArrayList<>();
    private final Map<String, List<Supplier<String>>> renderHooks = new LinkedHashMap<>();
    private final Map<String, List<ScopedHook>> scopedRenderHooks = new LinkedHashMap<>();
    private final Map<String, Plugin> plugins = new LinkedHashMap<>();

    // Branding / theming (issue #321).
    private @Nullable String brandName;
    private @Nullable String brandLogo;
    private @Nullable String darkModeBrandLogo;
    private @Nullable String favicon;
    private @Nullable Color primaryColor;
    private boolean darkMode = true;
    private ThemeMode defaultThemeMode = ThemeMode.SYSTEM;
    private @Nullable String theme;
    private boolean topNavigation;
    private @Nullable String maxContentWidth;

    // Auth scaffolding (issue #325) — all disabled by default (parity with Filament). The boolean
    // flag and the backing page model (the audit gap: a flag rendered nothing) move together: the
    // handler-accepting overloads set both, so hasX() answers the flag while xPage() returns the
    // real AuthPage the panel routes to.
    private boolean registration;
    private boolean passwordReset;
    private boolean emailVerification;
    private @Nullable LoginPage loginPage;
    private @Nullable RegisterPage registerPage;
    private @Nullable PasswordResetPage passwordResetPage;
    private @Nullable EmailVerificationPage emailVerificationPage;

    // Authorization (issue #325/#327): the gate decides who may reach the panel at all.
    private PanelAccessGate accessGate = PanelAccessGate.permitAll();

    // Navigation override (issue #278): an explicit builder replaces the auto-derived tree.
    private @Nullable NavigationBuilder navigation;

    // Database notifications bell (issue #300) — off by default (parity with Filament).
    private boolean databaseNotifications;
    private java.time.Duration databaseNotificationsPollInterval = NotificationBell.DEFAULT_POLL_INTERVAL;

    // User menu + profile (issue #343).
    private final List<MenuItem> userMenuItems = new ArrayList<>();
    private boolean profilePage;

    // Multi-tenancy (issue #339) — opt-in, off by default: tenancy is the largest panel subsystem,
    // so it stays an external module the panel merely references, not a set of accreted concerns.
    private @Nullable Tenancy tenancy;

    // Clusters (issue #341) — resources/pages grouped under a shared prefix + sub-navigation.
    private final List<Cluster> clusters = new ArrayList<>();

    private Panel(String id) {
        this.id = Objects.requireNonNull(id, "id");
        this.path = id;
    }

    /**
     * @param id the panel id (also its route prefix, for example {@code "admin"})
     * @return a new, empty panel
     */
    public static Panel create(String id) {
        return new Panel(id);
    }

    /**
     * @return the panel id
     */
    public String id() {
        return id;
    }

    /**
     * Registers a resource on the panel.
     *
     * @param resource the resource
     * @return this panel
     */
    public Panel resource(Resource<?> resource) {
        resources.add(Objects.requireNonNull(resource, "resource"));
        return this;
    }

    /**
     * @return the registered resources, in registration order, as an unmodifiable snapshot
     */
    public List<Resource<?>> resources() {
        return Collections.unmodifiableList(resources);
    }

    /**
     * Registers a {@link WidgetPage} on the panel. Widget pages appear in the panel's navigation
     * as first-class pages alongside resources.
     *
     * @param page the widget page
     * @return this panel
     */
    public Panel page(WidgetPage page) {
        pages.add(Objects.requireNonNull(page, "page"));
        return this;
    }

    /**
     * @return the registered widget pages, in registration order, as an unmodifiable snapshot
     */
    public List<WidgetPage> pages() {
        return Collections.unmodifiableList(pages);
    }

    /**
     * Registers a render hook: a fragment supplier injected at a named layout point.
     *
     * @param point one of the {@link RenderHook} constants
     * @param fragment supplies the HTML fragment to inject
     * @return this panel
     */
    public Panel renderHook(String point, Supplier<String> fragment) {
        renderHooks.computeIfAbsent(point, p -> new ArrayList<>())
                .add(Objects.requireNonNull(fragment, "fragment"));
        return this;
    }

    /**
     * Registers a <em>scoped</em> render hook: a fragment injected at a named point only when the
     * active page/resource matches the given scope (the Filament scoped {@code renderHook}). A
     * scoped hook does not fire on other surfaces.
     *
     * @param point one of the {@link RenderHook} constants
     * @param scope the page/resource class (or any scope key) the hook is bound to
     * @param fragment supplies the HTML fragment to inject
     * @return this panel
     */
    public Panel renderHook(String point, String scope, Supplier<String> fragment) {
        Objects.requireNonNull(scope, "scope");
        scopedRenderHooks
                .computeIfAbsent(point, p -> new ArrayList<>())
                .add(new ScopedHook(scope, Objects.requireNonNull(fragment, "fragment")));
        return this;
    }

    /**
     * @param point one of the {@link RenderHook} constants
     * @return the fragment suppliers registered at that point with no scope, in registration order
     *     (empty if none)
     */
    public List<Supplier<String>> renderHooks(String point) {
        return Collections.unmodifiableList(renderHooks.getOrDefault(point, List.of()));
    }

    /**
     * Resolves the fragments to render at a point for the active scope: the unscoped fragments plus
     * any scoped fragment whose scope equals {@code activeScope} (the Filament
     * {@code renderHook(name, scopes)} resolution).
     *
     * @param point one of the {@link RenderHook} constants
     * @param activeScope the active page/resource scope key (or {@code null} for none)
     * @return the fragment suppliers to render, unscoped first then matching-scoped, in order
     */
    public List<Supplier<String>> renderHooks(String point, @Nullable String activeScope) {
        List<Supplier<String>> resolved = new ArrayList<>(renderHooks.getOrDefault(point, List.of()));
        for (ScopedHook hook : scopedRenderHooks.getOrDefault(point, List.of())) {
            if (activeScope != null && hook.scope().equals(activeScope)) {
                resolved.add(hook.fragment());
            }
        }
        return Collections.unmodifiableList(resolved);
    }

    /**
     * @param point one of the {@link RenderHook} constants
     * @return whether any fragment (scoped or not) is registered at the point, so the layout can skip
     *     the wrapper markup when nothing is registered
     */
    public boolean hasRenderHook(String point) {
        return !renderHooks.getOrDefault(point, List.of()).isEmpty()
                || !scopedRenderHooks.getOrDefault(point, List.of()).isEmpty();
    }

    private record ScopedHook(String scope, Supplier<String> fragment) {}

    /**
     * Applies a plugin: runs its {@link Plugin#register(Panel)} immediately and its
     * {@link Plugin#boot(Panel)} once registration has run (the Filament
     * register-then-boot lifecycle).
     *
     * @param plugin the plugin
     * @return this panel
     */
    public Panel plugin(Plugin plugin) {
        Objects.requireNonNull(plugin, "plugin");
        plugins.put(plugin.getId(), plugin);
        plugin.register(this);
        plugin.boot(this);
        return this;
    }

    /**
     * Looks up an applied plugin by id.
     *
     * @param id the plugin id
     * @return the plugin, or empty if none with that id was applied
     */
    public Optional<Plugin> plugin(String id) {
        return Optional.ofNullable(plugins.get(id));
    }

    /**
     * @param id the plugin id
     * @return {@code true} if a plugin with that id has been applied to this panel
     */
    public boolean hasPlugin(String id) {
        return plugins.containsKey(Objects.requireNonNull(id, "id"));
    }

    /**
     * Looks up an applied plugin by id, failing loudly when it is not registered (the cross-plugin
     * wiring path: a plugin's {@link Plugin#boot(Panel)} reads an earlier-registered plugin and must
     * not get a silent {@code null}).
     *
     * @param id the plugin id
     * @return the applied plugin
     * @throws IllegalArgumentException if no plugin with that id is registered for this panel
     */
    public Plugin requirePlugin(String id) {
        Plugin plugin = plugins.get(Objects.requireNonNull(id, "id"));
        if (plugin == null) {
            throw new IllegalArgumentException(
                    "plugin \"" + id + "\" is not registered for panel \"" + this.id + "\"");
        }
        return plugin;
    }

    // ── Routing / registry (issue #319) ─────────────────────────────────────────────────────────

    /**
     * Sets the panel's route prefix (defaults to the id). Two panels in one app must have distinct
     * paths so their routes do not collide.
     *
     * @param path the route prefix (for example {@code "admin"} or {@code "app"})
     * @return this panel
     */
    public Panel path(String path) {
        this.path = Objects.requireNonNull(path, "path");
        return this;
    }

    /**
     * @return the route prefix
     */
    public String path() {
        return path;
    }

    /**
     * Marks this as the default panel (the one resolved when no panel is named). At most one panel
     * in a {@link PanelRegistry} may be default.
     *
     * @return this panel
     */
    public Panel makeDefault() {
        this.isDefault = true;
        return this;
    }

    /**
     * @return whether this panel is the default
     */
    public boolean isDefault() {
        return isDefault;
    }

    // ── Branding / theming (issue #321) ─────────────────────────────────────────────────────────

    /**
     * @param brandName the brand name shown in the shell header
     * @return this panel
     */
    public Panel brandName(String brandName) {
        this.brandName = Objects.requireNonNull(brandName, "brandName");
        return this;
    }

    /**
     * @param brandLogo the brand logo url shown in the shell header
     * @return this panel
     */
    public Panel brandLogo(String brandLogo) {
        this.brandLogo = Objects.requireNonNull(brandLogo, "brandLogo");
        return this;
    }

    /**
     * @param brandLogo the light-mode brand logo url
     * @param darkModeBrandLogo the dark-mode brand logo url
     * @return this panel
     */
    public Panel brandLogo(String brandLogo, String darkModeBrandLogo) {
        this.brandLogo = Objects.requireNonNull(brandLogo, "brandLogo");
        this.darkModeBrandLogo = Objects.requireNonNull(darkModeBrandLogo, "darkModeBrandLogo");
        return this;
    }

    /**
     * @param favicon the favicon url
     * @return this panel
     */
    public Panel favicon(String favicon) {
        this.favicon = Objects.requireNonNull(favicon, "favicon");
        return this;
    }

    /**
     * Sets the panel's primary brand color, which feeds the color system's {@code primary} slot.
     *
     * @param primaryColor the primary color
     * @return this panel
     */
    public Panel primaryColor(Color primaryColor) {
        this.primaryColor = Objects.requireNonNull(primaryColor, "primaryColor");
        return this;
    }

    /**
     * @param darkMode whether the dark-mode toggle is offered (default {@code true})
     * @return this panel
     */
    public Panel darkMode(boolean darkMode) {
        this.darkMode = darkMode;
        return this;
    }

    /**
     * @param defaultThemeMode the default color-scheme mode
     * @return this panel
     */
    public Panel defaultThemeMode(ThemeMode defaultThemeMode) {
        this.defaultThemeMode = Objects.requireNonNull(defaultThemeMode, "defaultThemeMode");
        return this;
    }

    /**
     * Registers a custom theme stylesheet name for this panel. The theme <em>replaces</em> the core
     * stylesheet rather than appending (the Filament {@code Theme} = replacing-{@code Css} rule).
     *
     * @param theme the theme name / asset id
     * @return this panel
     */
    public Panel theme(String theme) {
        this.theme = Objects.requireNonNull(theme, "theme");
        return this;
    }

    /**
     * @param topNavigation {@code true} for a top navigation bar instead of the sidebar
     * @return this panel
     */
    public Panel topNavigation(boolean topNavigation) {
        this.topNavigation = topNavigation;
        return this;
    }

    /**
     * @param maxContentWidth the max content width token (for example {@code "7xl"})
     * @return this panel
     */
    public Panel maxContentWidth(String maxContentWidth) {
        this.maxContentWidth = Objects.requireNonNull(maxContentWidth, "maxContentWidth");
        return this;
    }

    /** @return the brand name, if set */
    public Optional<String> brandName() {
        return Optional.ofNullable(brandName);
    }

    /** @return the (light-mode) brand logo url, if set */
    public Optional<String> brandLogo() {
        return Optional.ofNullable(brandLogo);
    }

    /** @return the dark-mode brand logo url, if set */
    public Optional<String> darkModeBrandLogo() {
        return Optional.ofNullable(darkModeBrandLogo);
    }

    /** @return the favicon url, if set */
    public Optional<String> favicon() {
        return Optional.ofNullable(favicon);
    }

    /** @return the primary brand color, if set */
    public Optional<Color> primaryColor() {
        return Optional.ofNullable(primaryColor);
    }

    /** @return whether the dark-mode toggle is offered */
    public boolean isDarkMode() {
        return darkMode;
    }

    /** @return the default color-scheme mode */
    public ThemeMode defaultThemeMode() {
        return defaultThemeMode;
    }

    /** @return the custom theme name, if set */
    public Optional<String> theme() {
        return Optional.ofNullable(theme);
    }

    /** @return whether top navigation is used */
    public boolean isTopNavigation() {
        return topNavigation;
    }

    /** @return the max content width token, if set */
    public Optional<String> maxContentWidth() {
        return Optional.ofNullable(maxContentWidth);
    }

    // ── Auth scaffolding (issue #325) ───────────────────────────────────────────────────────────

    /**
     * Enables the self-serve registration page under this panel (disabled by default).
     *
     * @return this panel
     */
    public Panel registration() {
        this.registration = true;
        return this;
    }

    /**
     * Enables the request-password-reset + reset-password pages (disabled by default).
     *
     * @return this panel
     */
    public Panel passwordReset() {
        this.passwordReset = true;
        return this;
    }

    /**
     * Enables the email-verification prompt page (disabled by default).
     *
     * @return this panel
     */
    public Panel emailVerification() {
        this.emailVerification = true;
        return this;
    }

    /** @return whether the registration page is enabled */
    public boolean hasRegistration() {
        return registration;
    }

    /** @return whether the password-reset pages are enabled */
    public boolean hasPasswordReset() {
        return passwordReset;
    }

    /** @return whether the email-verification page is enabled */
    public boolean hasEmailVerification() {
        return emailVerification;
    }

    /**
     * Sets the backing {@link LoginPage} the panel routes {@code /<panel>/login}
     * to (the always-on auth page). Until set, the panel has no real login surface, only the flag the
     * audit flagged; setting it is what turns "auth" from a placeholder into a rendered page.
     *
     * @param loginPage the login page model
     * @return this panel
     */
    public Panel loginPage(LoginPage loginPage) {
        this.loginPage = Objects.requireNonNull(loginPage, "loginPage");
        return this;
    }

    /**
     * Enables registration AND sets its backing {@link RegisterPage} (the flag and
     * the page move together, so {@link #hasRegistration()} and {@link #registerPage()} agree).
     *
     * @param registerPage the register page model
     * @return this panel
     */
    public Panel registration(RegisterPage registerPage) {
        this.registerPage = Objects.requireNonNull(registerPage, "registerPage");
        this.registration = true;
        return this;
    }

    /**
     * Enables password reset AND sets its backing {@link PasswordResetPage}.
     *
     * @param passwordResetPage the password-reset page model
     * @return this panel
     */
    public Panel passwordReset(PasswordResetPage passwordResetPage) {
        this.passwordResetPage = Objects.requireNonNull(passwordResetPage, "passwordResetPage");
        this.passwordReset = true;
        return this;
    }

    /**
     * Enables email verification AND sets its backing
     * {@link EmailVerificationPage}.
     *
     * @param emailVerificationPage the email-verification page model
     * @return this panel
     */
    public Panel emailVerification(EmailVerificationPage emailVerificationPage) {
        this.emailVerificationPage = Objects.requireNonNull(emailVerificationPage, "emailVerificationPage");
        this.emailVerification = true;
        return this;
    }

    /** @return the backing login page model, if one was set */
    public Optional<LoginPage> loginPage() {
        return Optional.ofNullable(loginPage);
    }

    /** @return the backing register page model, if registration was enabled with one */
    public Optional<RegisterPage> registerPage() {
        return Optional.ofNullable(registerPage);
    }

    /** @return the backing password-reset page model, if password reset was enabled with one */
    public Optional<PasswordResetPage> passwordResetPage() {
        return Optional.ofNullable(passwordResetPage);
    }

    /** @return the backing email-verification page model, if email verification was enabled with one */
    public Optional<EmailVerificationPage> emailVerificationPage() {
        return Optional.ofNullable(emailVerificationPage);
    }

    /**
     * Sets the panel-access gate (the {@code canAccessPanel} equivalent): decides whether a given
     * principal may reach the panel at all, before any resource authorization.
     *
     * @param accessGate the gate
     * @return this panel
     */
    public Panel accessGate(PanelAccessGate accessGate) {
        this.accessGate = Objects.requireNonNull(accessGate, "accessGate");
        return this;
    }

    /** @return the panel-access gate */
    public PanelAccessGate accessGate() {
        return accessGate;
    }

    // ── Navigation (issue #278/#327) ────────────────────────────────────────────────────────────

    /**
     * Sets an explicit navigation builder, replacing the tree auto-derived from the registered
     * resources.
     *
     * @param navigation the explicit navigation builder
     * @return this panel
     */
    public Panel navigation(NavigationBuilder navigation) {
        this.navigation = Objects.requireNonNull(navigation, "navigation");
        return this;
    }

    /**
     * Builds the navigation tree for this panel. If an explicit {@link #navigation(NavigationBuilder)}
     * was set, it is returned; otherwise a builder is derived from the registered resources, each
     * contributing its {@link Resource#navigationItem(String)} gated by the given visibility check
     * (the seam where authorization removes an unauthorized resource from the nav, issue #327).
     *
     * @param visibleToCurrentUser decides whether a resource's nav entry is visible to the current
     *     user; a resource for which this returns {@code false} is filtered out of the tree
     * @return the navigation builder to render
     */
    public NavigationBuilder buildNavigation(java.util.function.Predicate<Resource<?>> visibleToCurrentUser) {
        Objects.requireNonNull(visibleToCurrentUser, "visibleToCurrentUser");
        if (navigation != null) {
            return navigation;
        }
        NavigationBuilder builder = NavigationBuilder.create();
        Map<String, NavigationGroup> groupsByLabel = new LinkedHashMap<>();
        for (Resource<?> resource : resources) {
            Optional<NavigationItem> maybeItem = resource.navigationItem(path);
            if (maybeItem.isEmpty()) {
                continue;
            }
            NavigationItem item = maybeItem.get();
            // Authorization at the nav seam: hide the entry the current user may not access.
            boolean allowed = visibleToCurrentUser.test(resource);
            item.visible(allowed);
            Optional<String> group = item.groupLabel();
            if (group.isPresent()) {
                groupsByLabel
                        .computeIfAbsent(group.get(), NavigationGroup::make)
                        .item(item);
            } else {
                builder.item(item);
            }
        }
        groupsByLabel.values().forEach(builder::group);
        return builder;
    }

    // --- Database notifications bell (issue #300) ---

    /**
     * Enables the topbar notification bell backed by a {@link DatabaseNotificationStore} (the
     * Filament {@code Panel::databaseNotifications()}). Off by default.
     *
     * @return this panel
     */
    public Panel databaseNotifications() {
        this.databaseNotifications = true;
        return this;
    }

    /**
     * Sets the bell's polling refresh interval (the Filament
     * {@code databaseNotificationsPolling}); enabling notifications implicitly.
     *
     * @param interval the polling interval
     * @return this panel
     */
    public Panel databaseNotificationsPolling(java.time.Duration interval) {
        this.databaseNotifications = true;
        this.databaseNotificationsPollInterval = Objects.requireNonNull(interval, "interval");
        return this;
    }

    /** @return whether the database-notification bell is enabled */
    public boolean hasDatabaseNotifications() {
        return databaseNotifications;
    }

    /** @return the bell's polling refresh interval */
    public java.time.Duration databaseNotificationsPollInterval() {
        return databaseNotificationsPollInterval;
    }

    /**
     * Builds a {@link NotificationBell} for the current recipient over a store, honouring this
     * panel's polling interval. The page wires the store bean + the authenticated user id.
     *
     * @param store the notification store
     * @param recipient the authenticated user id
     * @return the bell view-model
     */
    public NotificationBell notificationBell(DatabaseNotificationStore store, String recipient) {
        return NotificationBell.of(store, recipient).pollInterval(databaseNotificationsPollInterval);
    }

    // --- User menu + profile (issue #343) ---

    /**
     * Adds an item to the topbar user menu (the avatar dropdown, the Filament
     * {@code Panel::userMenuItems}). The logout item is always present; these are extras.
     *
     * @param items the menu items, in order
     * @return this panel
     */
    public Panel userMenuItems(MenuItem... items) {
        for (MenuItem item : items) {
            userMenuItems.add(Objects.requireNonNull(item, "item"));
        }
        return this;
    }

    /** @return the configured user-menu items, in order (excludes the always-present logout) */
    public List<MenuItem> userMenuItems() {
        return Collections.unmodifiableList(userMenuItems);
    }

    /**
     * Enables the edit-profile page routed under the panel (the Filament {@code EditProfile}). When
     * on, the user menu carries a "profile" item and {@code <panel>/profile} resolves to the page.
     *
     * @return this panel
     */
    public Panel profile() {
        this.profilePage = true;
        return this;
    }

    /** @return whether the edit-profile page is enabled */
    public boolean hasProfilePage() {
        return profilePage;
    }

    /** @return the panel-relative route of the edit-profile page */
    public String profilePath() {
        return path + "/profile";
    }

    // --- Multi-tenancy (issue #339), opt-in ---

    /**
     * Turns multi-tenancy on for this panel (the Filament {@code Panel::tenant(...)}). Off by default
     * so a single-tenant app pays nothing; with it set the panel scopes resources to the active
     * tenant, offers the tenant switcher, and resolves the tenant route segment.
     *
     * @param tenancy the tenancy configuration
     * @return this panel
     */
    public Panel tenancy(Tenancy tenancy) {
        this.tenancy = Objects.requireNonNull(tenancy, "tenancy");
        return this;
    }

    /** @return whether multi-tenancy is enabled on this panel */
    public boolean hasTenancy() {
        return tenancy != null;
    }

    /** @return the tenancy configuration, if enabled */
    public Optional<Tenancy> tenancy() {
        return Optional.ofNullable(tenancy);
    }

    // --- Clusters (issue #341) ---

    /**
     * Registers a cluster: a group of resources/pages under a shared url prefix with its own
     * sub-navigation (the Filament {@code Cluster}).
     *
     * @param cluster the cluster
     * @return this panel
     */
    public Panel cluster(Cluster cluster) {
        clusters.add(Objects.requireNonNull(cluster, "cluster"));
        return this;
    }

    /** @return the registered clusters, in registration order, as an unmodifiable snapshot */
    public List<Cluster> clusters() {
        return Collections.unmodifiableList(clusters);
    }
}
