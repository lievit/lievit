/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * The render-time bundle the kit PANEL shell template ({@code kit/page.jte}) reads: the Filament
 * panel chrome facts the page-body view-models ({@link dev.lievit.kit.AdminListView}, {@link
 * dev.lievit.kit.AdminFormView}, {@link dev.lievit.kit.AdminViewView}, {@link
 * dev.lievit.kit.auth.AuthFormView}) deliberately do not carry, because they depend on the panel's
 * branding + the current request + the signed-in user, not on the resource.
 *
 * <p>This is the panel analog of {@link KitTableView}: a pure projection (the navigation tree, the
 * user-menu, the breadcrumb trail, the page heading) wrapped with the render-only facts the shell
 * needs to paint the Filament layout (the {@code base.blade} + {@code sidebar.blade} +
 * {@code topbar.blade} + {@code header.blade} + {@code user-menu.blade} set). A host builds it with
 * {@link #of} and layers the chrome on with the withers; {@link KitPageComponent} derives a default
 * bundle from a {@link dev.lievit.kit.Panel}.
 *
 * <p>The collection shapes are the documented template idiom (the {@code List<Map<String,String>>}
 * the {@code blocks/app-shell} + {@code breadcrumb} lievit-ui partials already iterate), so the shell
 * binds to them with no custom record type to import. Each map is either a NAV-GROUP header (key
 * {@code groupLabel}) or a NAV-ITEM (keys {@code key}, {@code label}, {@code href}, {@code icon},
 * {@code badge}, {@code badgeVariant}, and {@code active}={@code "true"} for the current route); a
 * USER-MENU entry keys {@code label} + {@code href}/{@code formAction} (+ optional {@code icon},
 * {@code variant}, {@code separator}={@code "true"}); a BREADCRUMB crumb keys {@code label} (+
 * optional {@code href}).
 *
 * @param brandName the product/app name shown in the sidebar header (the panel's brand)
 * @param pageTitle the page {@code <h1>} text (the main landmark heading)
 * @param subheading an optional muted sub-heading under the page heading; empty hides it
 * @param activeNav the key of the active nav item (the server-set {@code aria-current})
 * @param navGroups the sidebar tree: group headers + nav items, in render order
 * @param breadcrumb the header breadcrumb trail root-to-current; empty hides the trail
 * @param userName the signed-in user's display name (the user-menu trigger + avatar)
 * @param userAvatarSrc the user's avatar image URL; empty drives the initials fallback
 * @param userInitials the avatar fallback initials when no image
 * @param userMenu the user-menu items (the always-present logout is the host's last entry)
 * @param themeMode the active theme the theme-switcher renders selected ({@code light}/{@code
 *     dark}/{@code system}); empty hides the switcher (panel dark-mode off)
 * @param searchAction the global-search form action / the search target; empty hides the search field
 * @param searchQuery the active global-search term echoed back into the field
 * @param notificationCount the unread notification-bell count; {@code -1} hides the bell (panel
 *     database-notifications off), {@code 0} shows the bell with no unread badge
 * @param maxContentWidth the main content max-width token (e.g. {@code "7xl"}); empty = full width
 */
public record KitPageView(
        String brandName,
        String pageTitle,
        String subheading,
        String activeNav,
        List<Map<String, String>> navGroups,
        List<Map<String, String>> breadcrumb,
        String userName,
        String userAvatarSrc,
        String userInitials,
        List<Map<String, String>> userMenu,
        String themeMode,
        String searchAction,
        String searchQuery,
        int notificationCount,
        String maxContentWidth) {

    /** Compact constructor: defends the lists and never-null the strings. */
    public KitPageView {
        brandName = brandName == null ? "" : brandName;
        pageTitle = pageTitle == null ? "" : pageTitle;
        subheading = subheading == null ? "" : subheading;
        activeNav = activeNav == null ? "" : activeNav;
        navGroups = List.copyOf(navGroups);
        breadcrumb = List.copyOf(breadcrumb);
        userName = userName == null ? "" : userName;
        userAvatarSrc = userAvatarSrc == null ? "" : userAvatarSrc;
        userInitials = userInitials == null ? "" : userInitials;
        userMenu = List.copyOf(userMenu);
        themeMode = themeMode == null ? "" : themeMode;
        searchAction = searchAction == null ? "" : searchAction;
        searchQuery = searchQuery == null ? "" : searchQuery;
        maxContentWidth = maxContentWidth == null ? "" : maxContentWidth;
    }

    /**
     * The minimal bundle: just the brand + heading + nav tree, with no breadcrumb, no user (anonymous
     * chrome), no theme switcher, no search, no bell. The host layers the rest on with the withers.
     *
     * @param brandName the panel brand
     * @param pageTitle the page heading
     * @param navGroups the sidebar tree
     * @return the bundle
     */
    public static KitPageView of(
            String brandName, String pageTitle, List<Map<String, String>> navGroups) {
        return new KitPageView(
                brandName, pageTitle, "", "", navGroups, List.of(), "", "", "", List.of(), "", "",
                "", -1, "");
    }

    /**
     * @param key the active nav item key (server-set {@code aria-current})
     * @return a copy marking that nav item active
     */
    public KitPageView withActiveNav(String key) {
        return new KitPageView(
                brandName, pageTitle, subheading, key, navGroups, breadcrumb, userName, userAvatarSrc,
                userInitials, userMenu, themeMode, searchAction, searchQuery, notificationCount,
                maxContentWidth);
    }

    /**
     * @param subheading the muted sub-heading under the page heading
     * @return a copy carrying the sub-heading
     */
    public KitPageView withSubheading(String subheading) {
        return new KitPageView(
                brandName, pageTitle, subheading, activeNav, navGroups, breadcrumb, userName,
                userAvatarSrc, userInitials, userMenu, themeMode, searchAction, searchQuery,
                notificationCount, maxContentWidth);
    }

    /**
     * @param trail the breadcrumb crumbs root-to-current
     * @return a copy carrying the breadcrumb trail
     */
    public KitPageView withBreadcrumb(List<Map<String, String>> trail) {
        return new KitPageView(
                brandName, pageTitle, subheading, activeNav, navGroups, trail, userName,
                userAvatarSrc, userInitials, userMenu, themeMode, searchAction, searchQuery,
                notificationCount, maxContentWidth);
    }

    /**
     * @param name the user's display name
     * @param avatarSrc the avatar image URL (empty = initials fallback)
     * @param initials the avatar fallback initials
     * @param menu the user-menu items
     * @return a copy carrying the signed-in user identity + menu
     */
    public KitPageView withUser(
            String name, String avatarSrc, String initials, List<Map<String, String>> menu) {
        return new KitPageView(
                brandName, pageTitle, subheading, activeNav, navGroups, breadcrumb, name, avatarSrc,
                initials, menu, themeMode, searchAction, searchQuery, notificationCount,
                maxContentWidth);
    }

    /**
     * @param mode the active theme ({@code light}/{@code dark}/{@code system}); the switcher renders
     *     it selected
     * @return a copy carrying the theme-switcher's active mode
     */
    public KitPageView withTheme(String mode) {
        return new KitPageView(
                brandName, pageTitle, subheading, activeNav, navGroups, breadcrumb, userName,
                userAvatarSrc, userInitials, userMenu, mode, searchAction, searchQuery,
                notificationCount, maxContentWidth);
    }

    /**
     * @param action the global-search form action (the search target)
     * @param query the active search term echoed back into the field
     * @return a copy carrying the global-search field
     */
    public KitPageView withSearch(String action, String query) {
        return new KitPageView(
                brandName, pageTitle, subheading, activeNav, navGroups, breadcrumb, userName,
                userAvatarSrc, userInitials, userMenu, themeMode, action, query, notificationCount,
                maxContentWidth);
    }

    /**
     * @param unread the unread notification count ({@code 0} shows the bell with no badge)
     * @return a copy showing the notification bell with that unread count
     */
    public KitPageView withNotifications(int unread) {
        return new KitPageView(
                brandName, pageTitle, subheading, activeNav, navGroups, breadcrumb, userName,
                userAvatarSrc, userInitials, userMenu, themeMode, searchAction, searchQuery,
                Math.max(0, unread), maxContentWidth);
    }

    /**
     * @param token the content max-width token (e.g. {@code "7xl"})
     * @return a copy capping the main content at that width
     */
    public KitPageView withMaxContentWidth(String token) {
        return new KitPageView(
                brandName, pageTitle, subheading, activeNav, navGroups, breadcrumb, userName,
                userAvatarSrc, userInitials, userMenu, themeMode, searchAction, searchQuery,
                notificationCount, token);
    }

    /** @return whether a muted sub-heading renders under the page heading */
    public boolean hasSubheading() {
        return !subheading.isBlank();
    }

    /** @return whether the header breadcrumb trail renders */
    public boolean hasBreadcrumb() {
        return !breadcrumb.isEmpty();
    }

    /** @return whether a signed-in user (and thus the user menu) renders */
    public boolean hasUser() {
        return !userName.isBlank();
    }

    /** @return whether the theme switcher renders in the user menu (panel dark-mode on) */
    public boolean hasThemeSwitcher() {
        return !themeMode.isBlank();
    }

    /** @return whether the global-search field renders in the topbar */
    public boolean hasSearch() {
        return !searchAction.isBlank();
    }

    /** @return whether the notification bell renders (panel database-notifications on) */
    public boolean hasNotifications() {
        return notificationCount >= 0;
    }

    /** @return whether the main content is width-capped (a max-width token is set) */
    public boolean hasMaxContentWidth() {
        return !maxContentWidth.isBlank();
    }

    /**
     * @return the avatar image URL, or {@code null} when none is set (the avatar partial's
     *     null-means-initials contract; the empty string is never a valid {@code src})
     */
    public @Nullable String avatarSrcOrNull() {
        return userAvatarSrc.isBlank() ? null : userAvatarSrc;
    }
}
