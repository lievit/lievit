/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.page;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Predicate;

import io.lievit.kit.Icon;
import io.lievit.kit.IconRegistry;
import io.lievit.kit.MenuItem;
import io.lievit.kit.NavigationBuilder;
import io.lievit.kit.NavigationGroup;
import io.lievit.kit.NavigationItem;
import io.lievit.kit.Panel;
import io.lievit.kit.Resource;

/**
 * The kit-owned, GENERIC render entry for the canonical panel shell ({@code kit/page.jte}): the
 * reusable logic a concrete controller delegates to in order to render a {@link Panel}'s chrome
 * (sidebar + topbar + breadcrumb + user-menu) around any page body, instead of hand-assembling the
 * shell the way an adopter does today.
 *
 * <p>It mirrors {@link KitTableComponent} (the table chrome's driver): it reads the panel's
 * navigation tree, branding, theme, search and notification settings, and projects them into the
 * {@code List<Map<String,String>>} template idiom the {@code kit/page.jte} shell binds to. The
 * navigation visibility predicate is the authorization seam: a resource the predicate hides drops out
 * of the rendered tree (the {@link Panel#buildNavigation} contract).
 *
 * <p>The kit refers to icons by stable {@link Icon} aliases, never concrete glyphs, so the driver
 * takes an {@link IconRegistry} to turn each nav alias into the Lucide glyph the shell renders; an
 * unmapped alias renders no glyph (the leaf still shows its label). The host layers the per-request
 * facts the panel does not know (the active route, the breadcrumb trail, the signed-in user, the
 * unread count, the active theme) on with the {@link KitPageView} withers.
 */
public final class KitPageComponent {

    private final Panel panel;
    private final IconRegistry icons;

    /**
     * @param panel the panel whose chrome to render
     * @param icons the icon registry resolving nav {@link Icon} aliases to Lucide glyph names
     */
    public KitPageComponent(Panel panel, IconRegistry icons) {
        this.panel = Objects.requireNonNull(panel, "panel");
        this.icons = Objects.requireNonNull(icons, "icons");
    }

    /**
     * @param panel the panel whose chrome to render
     * @return a component over the panel with the default icon registry (kit aliases mapped to their
     *     default glyphs)
     */
    public static KitPageComponent of(Panel panel) {
        return new KitPageComponent(panel, IconRegistry.withDefaults());
    }

    /**
     * Builds the default render bundle for a page: the panel brand + the navigation tree (all
     * resources visible) + the page heading, plus the panel's theme switcher (when dark-mode is on),
     * search field (when a search action is given) and notification bell (when database-notifications
     * are on). No breadcrumb, no signed-in user yet; the host layers those on with the
     * {@link KitPageView} withers.
     *
     * @param pageTitle the page heading
     * @param searchAction the global-search form action, or empty to hide the search field
     * @return the render bundle the {@code kit/page.jte} shell reads
     */
    public KitPageView render(String pageTitle, String searchAction) {
        return render(pageTitle, searchAction, resource -> true);
    }

    /**
     * Builds the default render bundle, filtering the navigation tree through an authorization
     * predicate (a resource the predicate rejects is dropped from the sidebar).
     *
     * @param pageTitle the page heading
     * @param searchAction the global-search form action, or empty to hide the search field
     * @param navVisible decides whether a resource's nav entry is visible to the current user
     * @return the render bundle
     */
    public KitPageView render(
            String pageTitle, String searchAction, Predicate<Resource<?>> navVisible) {
        KitPageView view =
                KitPageView.of(panel.brandName().orElse(""), pageTitle, navGroups(navVisible));
        if (searchAction != null && !searchAction.isBlank()) {
            view = view.withSearch(searchAction, "");
        }
        if (panel.isDarkMode()) {
            view = view.withTheme(themeToken(panel.defaultThemeMode()));
        }
        if (panel.hasDatabaseNotifications()) {
            view = view.withNotifications(0);
        }
        return panel.maxContentWidth().map(view::withMaxContentWidth).orElse(view);
    }

    /**
     * Projects the panel's navigation tree into the template's {@code List<Map<String,String>>} idiom:
     * a {@code groupLabel} row opens a group, the {@code key}/{@code label}/{@code href}/{@code
     * icon}/{@code badge} rows that follow are its items. Top-level (ungrouped) items come first, then
     * each group, all honouring the builder's visibility + sort.
     *
     * @param navVisible the per-resource visibility predicate
     * @return the projected nav rows
     */
    public List<Map<String, String>> navGroups(Predicate<Resource<?>> navVisible) {
        NavigationBuilder nav = panel.buildNavigation(navVisible);
        List<Map<String, String>> rows = new ArrayList<>();
        for (NavigationItem item : nav.visibleItems()) {
            rows.add(itemRow(item));
        }
        for (NavigationGroup group : nav.visibleGroups()) {
            Map<String, String> header = new LinkedHashMap<>();
            header.put("groupLabel", group.label());
            rows.add(header);
            for (NavigationItem item : group.visibleItems()) {
                rows.add(itemRow(item));
            }
        }
        return rows;
    }

    private Map<String, String> itemRow(NavigationItem item) {
        Map<String, String> row = new LinkedHashMap<>();
        String key = item.url();
        row.put("key", key);
        row.put("label", item.label());
        row.put("href", item.url());
        item.icon().flatMap(icons::resolve).ifPresent(glyph -> row.put("icon", glyph));
        item.badge().ifPresent(badge -> row.put("badge", badge));
        item.badgeColor().ifPresent(color -> row.put("badgeVariant", color.name()));
        return row;
    }

    /**
     * Assembles the user-menu rows from the panel's configured items plus the always-present logout
     * (the Filament user-menu: profile / configured items / separator / logout). A {@code profile()}
     * panel gets a leading profile item; the logout is a form-submit row to {@code logoutAction}.
     *
     * @param logoutAction the form action the logout item posts to (e.g. {@code "/logout"})
     * @return the user-menu rows in display order
     */
    public List<Map<String, String>> userMenu(String logoutAction) {
        Objects.requireNonNull(logoutAction, "logoutAction");
        List<Map<String, String>> rows = new ArrayList<>();
        if (panel.hasProfilePage()) {
            Map<String, String> profile = new LinkedHashMap<>();
            profile.put("label", "Profile");
            profile.put("href", panel.profilePath());
            profile.put("icon", "user");
            rows.add(profile);
        }
        for (MenuItem item :
                panel.userMenuItems().stream()
                        .sorted(java.util.Comparator.comparingInt(MenuItem::sortKey))
                        .toList()) {
            Map<String, String> row = new LinkedHashMap<>();
            row.put("label", item.label());
            row.put("href", item.url());
            if (item.icon() != null) {
                row.put("icon", item.icon());
            }
            if (item.color() != null) {
                row.put("variant", "danger".equals(item.color()) ? "destructive" : "default");
            }
            rows.add(row);
        }
        Map<String, String> separator = new LinkedHashMap<>();
        separator.put("separator", "true");
        rows.add(separator);
        Map<String, String> logout = new LinkedHashMap<>();
        logout.put("label", "Sign out");
        logout.put("formAction", logoutAction);
        logout.put("icon", "log-out");
        logout.put("variant", "destructive");
        rows.add(logout);
        return rows;
    }

    /** @return the panel this component renders the chrome of */
    public Panel panel() {
        return panel;
    }

    private static String themeToken(io.lievit.kit.ThemeMode mode) {
        return switch (mode) {
            case LIGHT -> "light";
            case DARK -> "dark";
            case SYSTEM -> "system";
        };
    }
}
