/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * RENDER gate for the lievit-kit canonical PANEL SHELL (kit/page.jte + kit/page/* sub-parts).
 *
 * The precompile smoke (the jte-maven-plugin `generate` goal in this module's pom, which stages the
 * whole kit/ tree) proves the templates COMPILE against dev.lievit.kit + the lievit-ui partials; it
 * cannot prove the Filament panel chrome actually RENDERS. This does: it builds a real Panel +
 * KitPageView (via KitPageComponent) + the page-body view-models (AdminFormView / AdminViewView /
 * AuthFormView), source-renders kit/page.jte + the resource / auth wrappers on the fly (the same
 * gg.jte 3.2.4 compiler, ContentType.Html, DirectoryCodeResolver over the staged target/jte-src
 * tree), and asserts the chrome lands: the sidebar nav tree with the active item, the topbar (global
 * search + notification bell + user menu with the theme switcher), the page header (breadcrumbs + h1
 * + header actions), and the list / form / view / auth bodies.
 */
package dev.lievit.kit.jtecompile;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;
import gg.jte.resolve.DirectoryCodeResolver;
import dev.lievit.kit.AdminFormView;
import dev.lievit.kit.AdminViewView;
import dev.lievit.kit.Color;
import dev.lievit.kit.GlobalSearchResult;
import dev.lievit.kit.GlobalSearchResults;
import dev.lievit.kit.Icon;
import dev.lievit.kit.IconRegistry;
import dev.lievit.kit.NavigationBuilder;
import dev.lievit.kit.NavigationGroup;
import dev.lievit.kit.NavigationItem;
import dev.lievit.kit.Panel;
import dev.lievit.kit.ThemeMode;
import dev.lievit.kit.auth.AuthFormView;
import dev.lievit.kit.page.KitPageComponent;
import dev.lievit.kit.page.KitPageView;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class KitPageRenderTest {

    /** The staged template tree: kit/page.jte + kit/page/* + the lievit/* partials, under target/jte-src. */
    private static final Path JTE_DIR = Path.of("target", "jte-src");

    private static final TemplateEngine ENGINE =
            TemplateEngine.create(new DirectoryCodeResolver(JTE_DIR), ContentType.Html);

    private String render(String template, Map<String, Object> model) {
        StringOutput out = new StringOutput();
        ENGINE.render(template, model, out);
        return out.toString();
    }

    /**
     * A panel with two nav groups (Platform: Contatti + Immobili[badge 3]; Settings: Users) + brand,
     * dark mode, database notifications, an icon registry mapping the nav aliases to Lucide glyphs.
     */
    private Panel panel() {
        NavigationBuilder nav =
                NavigationBuilder.create()
                        .group(
                                NavigationGroup.make("Platform")
                                        .sort(1)
                                        .item(
                                                NavigationItem.make("Contatti", "/admin/contatti")
                                                        .icon(Icon.of("nav.contatti"))
                                                        .sort(1))
                                        .item(
                                                NavigationItem.make("Immobili", "/admin/immobili")
                                                        .icon(Icon.of("nav.immobili"))
                                                        .badge("3", Color.DANGER)
                                                        .sort(2)))
                        .group(
                                NavigationGroup.make("Settings")
                                        .sort(2)
                                        .item(
                                                NavigationItem.make("Users", "/admin/users")
                                                        .icon(Icon.of("nav.users"))));
        return Panel.create("admin")
                .brandName("HouseTree")
                .darkMode(true)
                .defaultThemeMode(ThemeMode.SYSTEM)
                .databaseNotifications()
                .navigation(nav);
    }

    /** The icon registry mapping the fixture's nav aliases to real Lucide glyph names. */
    private IconRegistry icons() {
        return IconRegistry.empty()
                .register("nav.contatti", "users")
                .register("nav.immobili", "house")
                .register("nav.users", "user");
    }

    /** The full panel-chrome bundle: nav + active item + breadcrumb + user + theme + search + bell. */
    private KitPageView pageView() {
        KitPageComponent component = new KitPageComponent(panel(), icons());
        return component
                .render("Contatti", "/admin/search")
                .withActiveNav("/admin/contatti")
                .withSubheading("Tutti i contatti della filiale")
                .withBreadcrumb(
                        List.of(
                                Map.of("label", "Home", "href", "/admin"),
                                Map.of("label", "Contatti")))
                .withUser(
                        "Francesco Bilotta",
                        "",
                        "FB",
                        component.userMenu("/logout"))
                .withSearch("/admin/search", "ross")
                .withNotifications(4);
    }

    @Test
    void renders_the_sidebar_nav_tree_with_groups_badge_and_the_active_item() {
        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("content", (gg.jte.Content) (o) -> o.writeContent("<p>body</p>"));
        String html = render("kit/page.jte", model);

        // 2. The sidebar nav tree: both group labels, every item as a real <a href>, the badge, and
        // aria-current="page" on the active route.
        assertTrue(html.contains("Platform"), "nav group label missing:\n" + html);
        assertTrue(html.contains("Settings"), "second nav group label missing");
        assertTrue(html.contains("/admin/contatti"), "nav item href missing");
        assertTrue(html.contains("/admin/immobili"), "nav item href missing");
        assertTrue(html.contains(">3<") || html.contains("3</span>"), "nav badge missing:\n" + html);
        assertTrue(html.contains("aria-current=\"page\""), "active nav aria-current missing");
        // The brand fills the sidebar header.
        assertTrue(html.contains("HouseTree"), "brand name missing");
    }

    @Test
    void renders_the_topbar_search_bell_and_user_menu_with_the_theme_switcher() {
        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("content", (gg.jte.Content) (o) -> o.writeContent("<p>body</p>"));
        String html = render("kit/page.jte", model);

        // 4. Global search field: a real form GET to the search action, echoing the active term.
        assertTrue(html.contains("action=\"/admin/search\""), "search form action missing:\n" + html);
        assertTrue(html.contains("ross"), "active search term not echoed");
        // 5. Notification bell: the unread count badge (4) on the bell trigger.
        assertTrue(html.contains("notification-bell"), "notification bell missing");
        assertTrue(html.contains("4 unread") || html.contains(">4<"), "bell unread count missing:\n" + html);
        // 6. User menu: the user name + the theme switcher (light/dark/system radiogroup).
        assertTrue(html.contains("Francesco Bilotta"), "user name missing");
        assertTrue(html.contains("kit-page-user-menu"), "user menu missing");
        assertTrue(html.contains("theme-switcher"), "theme switcher missing in the user menu:\n" + html);
        // The logout is a real form-submit item.
        assertTrue(html.contains("/logout"), "logout action missing");
    }

    @Test
    void renders_the_topbar_user_menu_as_a_compact_trigger_not_a_full_width_row() {
        // The default placement (inFooter=false): the topbar trigger is a compact chevron-down cluster,
        // NOT a full-width row. This pins the backward-compatible default of the inFooter param.
        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        String html = render("kit/page/user-menu.jte", model);

        assertTrue(html.contains("kit-page-user-menu"), "user menu missing:\n" + html);
        assertTrue(html.contains("data-lucide=\"chevron-down\""), "topbar chevron-down missing");
        // The compact trigger does not take the full sidebar width (that is the footer placement only).
        assertFalse(html.contains("w-full justify-between"), "topbar trigger must not be a full-width row");
        assertFalse(html.contains("data-lucide=\"chevron-up\""), "topbar must open downward, not upward");
    }

    @Test
    void renders_the_footer_user_menu_as_a_full_width_upward_row() {
        // inFooter=true (Filament panel user-menu placement): the trigger is a full-width row whose
        // <button> carries w-full justify-between (the triggerClass seam on the dropdown-menu partial),
        // opens UPWARD (chevron-up), and the name + chevron are lv-sidebar-collapsible so a collapsed
        // icon rail shows the avatar only.
        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("inFooter", true);
        String html = render("kit/page/user-menu.jte", model);

        assertTrue(html.contains("kit-page-user-menu"), "user menu missing:\n" + html);
        // The dropdown-menu trigger <button> spans the footer: w-full justify-between is applied to it.
        assertTrue(html.contains("w-full justify-between"), "footer trigger not full-width:\n" + html);
        // Opens upward and shows the chevron-up glyph (timegrid-style upward menu in a footer).
        assertTrue(html.contains("data-lucide=\"chevron-up\""), "footer chevron-up missing");
        assertFalse(html.contains("data-lucide=\"chevron-down\""), "footer must not show the topbar chevron-down");
        // The name + chevron collapse with the icon rail.
        assertTrue(html.contains("lv-sidebar-collapsible"), "footer collapsible label/chevron missing");
        // The user identity + logout still render (the menu body is placement-independent).
        assertTrue(html.contains("Francesco Bilotta"), "user name missing in footer menu");
        assertTrue(html.contains("/logout"), "logout action missing in footer menu");
    }

    @Test
    void renders_the_page_header_breadcrumb_heading_and_header_actions() {
        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("content", (gg.jte.Content) (o) -> o.writeContent("<p>body</p>"));
        model.put(
                "headerActions",
                (gg.jte.Content) (o) -> o.writeContent("<a href=\"/admin/contatti/create\">New</a>"));
        String html = render("kit/page.jte", model);

        // 7. The page header: breadcrumb trail + the h1 + subheading + the header-actions cluster.
        assertTrue(html.contains("breadcrumb"), "breadcrumb missing:\n" + html);
        assertTrue(html.contains(">Contatti<"), "page heading missing");
        assertTrue(html.contains("Tutti i contatti"), "subheading missing");
        assertTrue(html.contains("/admin/contatti/create"), "header action missing");
        // The skip-link is present as the first focusable.
        assertTrue(html.contains("Skip to main content"), "skip-link missing");
    }

    @Test
    void renders_the_global_search_grouped_results_popover() {
        GlobalSearchResults results =
                GlobalSearchResults.create()
                        .add(
                                "Contatti",
                                new GlobalSearchResult(
                                        "Rossi Mario",
                                        "/admin/contatti/1",
                                        Map.of("Telefono", "333-1234")))
                        .add("Immobili", GlobalSearchResult.of("Via Roma 12", "/admin/immobili/9"));
        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("searchResults", results);
        model.put("content", (gg.jte.Content) (o) -> o.writeContent("<p>body</p>"));
        String html = render("kit/page.jte", model);

        // The grouped-results popover: the group labels + a result link + a detail value.
        assertTrue(html.contains("data-search-group=\"Contatti\""), "search group missing:\n" + html);
        assertTrue(html.contains("/admin/contatti/1"), "search result link missing");
        assertTrue(html.contains("333-1234"), "search result detail missing");
    }

    @Test
    void renders_the_resource_list_page_with_create_action_and_the_table() {
        // Build a small table bundle via the existing kit table helpers (the chrome the list wraps).
        dev.lievit.kit.Resource<TestRow> resource = listResource();
        dev.lievit.kit.AdminListView listView = dev.lievit.kit.AdminListView.of(resource, 1, 10);
        dev.lievit.kit.page.KitTableView table =
                dev.lievit.kit.page.KitTableView.of(listView).withPageHref("/admin/things?page=%d");

        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("table", table);
        model.put("createUrl", "/admin/things/create");
        String html = render("kit/page/resource-list.jte", model);

        // The shell + the table render together: the page heading, the create header action, the table.
        assertTrue(html.contains("kit-page"), "panel shell missing:\n" + html);
        assertTrue(html.contains("/admin/things/create"), "create action missing");
        assertTrue(html.contains("Things"), "table heading missing");
    }

    @Test
    void renders_the_resource_form_page_with_fields_and_record_errors() {
        AdminFormView form =
                new AdminFormView(
                        "Edit contact",
                        true,
                        List.of(
                                new AdminFormView.FieldView(
                                        "name", "Name", "TextField", "Mario", List.of()),
                                new AdminFormView.FieldView(
                                                "notes", "Notes", "TextareaField", "VIP", List.of())
                                        .withOptions(AdminFormView.FieldOptions.textarea(3)),
                                new AdminFormView.FieldView(
                                                "active", "Active", "ToggleField", "true", List.of())
                                        .withOptions(AdminFormView.FieldOptions.toggle("", "")),
                                new AdminFormView.FieldView(
                                        "email",
                                        "Email",
                                        "TextField",
                                        "bad",
                                        List.of("must be a valid email"))),
                        List.of("The record could not be saved"));

        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("form", form);
        model.put("action", "/admin/contatti/1/edit");
        model.put("cancelUrl", "/admin/contatti");
        String html = render("kit/page/resource-form.jte", model);

        // A real POST form, one control per field (text + textarea + switch), a field error, the
        // record-level error banner, and the edit submit label.
        assertTrue(html.contains("action=\"/admin/contatti/1/edit\""), "form action missing:\n" + html);
        assertTrue(html.contains("name=\"name\""), "text field missing");
        assertTrue(html.contains("</textarea>"), "textarea field missing");
        assertTrue(html.contains("role=\"switch\"") || html.contains("name=\"active\""), "toggle field missing");
        assertTrue(html.contains("must be a valid email"), "field error missing");
        assertTrue(html.contains("The record could not be saved"), "record error banner missing");
        assertTrue(html.contains("Save"), "edit submit label missing");
    }

    @Test
    void renders_the_resource_view_page_with_sections_and_header_actions() {
        AdminViewView view =
                new AdminViewView(
                        "Mario Rossi",
                        "1",
                        List.of(
                                new AdminViewView.Section(
                                        "Anagrafica",
                                        new java.util.LinkedHashMap<>(
                                                Map.of("Nome", "Mario", "Telefono", "333-1234")),
                                        2)),
                        List.of(AdminViewView.HeaderAction.primary("Edit", "/admin/contatti/1/edit")));

        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("view", view);
        String html = render("kit/page/resource-view.jte", model);

        // The section heading, the label->value entries, and the Edit header action.
        assertTrue(html.contains("Anagrafica"), "section heading missing:\n" + html);
        assertTrue(html.contains("Mario"), "entry value missing");
        assertTrue(html.contains("Telefono"), "entry label missing");
        assertTrue(html.contains("/admin/contatti/1/edit"), "view header action missing");
    }

    @Test
    void renders_the_auth_page_from_an_auth_form_view() {
        AuthFormView view =
                new AuthFormView(
                        "Sign in",
                        List.of(
                                new AuthFormView.FieldView(
                                        "email", "Email address", "email", "", true, null),
                                new AuthFormView.FieldView(
                                        "password", "Password", "password", "", true, "required")),
                        "These credentials do not match our records.",
                        true,
                        "Sign in",
                        List.of(new AuthFormView.Link("Forgot your password?", "/admin/password-reset")));

        Map<String, Object> model = new HashMap<>();
        model.put("view", view);
        model.put("action", "/admin/login");
        model.put("brandName", "HouseTree");
        String html = render("kit/page/auth.jte", model);

        // A standalone auth card (no sidebar), the heading, the two inputs, the password type, the
        // field error, the form-level error alert, the submit, and the secondary link.
        assertFalse(html.contains("kit-page-sidebar"), "auth page must not wear the panel sidebar:\n" + html);
        assertTrue(html.contains("Sign in"), "auth heading missing");
        assertTrue(html.contains("name=\"email\""), "email field missing");
        assertTrue(html.contains("type=\"password\""), "password field missing");
        assertTrue(html.contains("required"), "field error missing");
        assertTrue(html.contains("These credentials do not match"), "form-level message missing");
        assertTrue(html.contains("/admin/password-reset"), "secondary link missing");
        assertTrue(html.contains("action=\"/admin/login\""), "auth form action missing");
    }

    // ── #492 brand-logo + page-header opt-out ───────────────────────────────────────────────────

    @Test
    void renders_the_brand_logo_img_when_brandLogo_is_set() {
        // #492 app-shell branding: a non-empty brandLogo renders an <img data-slot="kit-page-brand-logo">
        // in the sidebar header; an empty brandLogo falls back to the brandName text.
        // ADR sw-architecture-008 backflow.
        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("content", (gg.jte.Content) (o) -> o.writeContent("<p>body</p>"));
        model.put("brandLogo", "/assets/logo.svg");
        model.put("brandLogoAlt", "Acme Corp");
        String html = render("kit/page.jte", model);

        assertTrue(html.contains("data-slot=\"kit-page-brand-logo\""), "brand-logo img slot missing:\n" + html);
        assertTrue(html.contains("src=\"/assets/logo.svg\""), "brand-logo src missing");
        assertTrue(html.contains("alt=\"Acme Corp\""), "brand-logo alt missing");
        // The brand-name text fallback must NOT appear when a logo is set (Filament parity).
        assertFalse(html.contains(">HouseTree<"), "brand-name text must not render alongside the logo");
    }

    @Test
    void falls_back_to_brand_name_text_when_brandLogo_is_empty() {
        // #492: the default brandLogo="" keeps the brandName text fallback for existing adopters.
        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("content", (gg.jte.Content) (o) -> o.writeContent("<p>body</p>"));
        String html = render("kit/page.jte", model);

        assertTrue(html.contains("HouseTree"), "brand-name text fallback missing:\n" + html);
        assertFalse(html.contains("data-slot=\"kit-page-brand-logo\""), "no-logo case must not emit the img slot");
    }

    @Test
    void suppresses_the_page_header_when_pageHeader_is_false() {
        // #492 page-header opt-out: pageHeader=false removes the in-content header band so a
        // full-bleed page can render its own heading without being double-headed.
        // ADR sw-architecture-008 backflow.
        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("content", (gg.jte.Content) (o) -> o.writeContent("<h2>My own heading</h2>"));
        model.put("pageHeader", false);
        String html = render("kit/page.jte", model);

        assertFalse(html.contains("kit-page-header"), "page-header band must be absent when pageHeader=false:\n" + html);
        // The h1 the page-header would emit must not appear (the body carries its own heading).
        assertFalse(html.contains("<h1"), "page-header h1 must be absent when pageHeader=false");
        // The page body itself still renders.
        assertTrue(html.contains("My own heading"), "page body missing");
    }

    // ── #493 responsive shell (hamburger + sidebar-footer user-menu) ─────────────────────────────

    @Test
    void renders_the_mobile_hamburger_button_in_the_topbar() {
        // #493: a mobile hamburger button (data-lv-sidebar-open, lv-sidebar-mobile-open-trigger)
        // is always present in the topbar so the sidebar is reachable on narrow viewports.
        // ADR sw-architecture-008 backflow.
        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("content", (gg.jte.Content) (o) -> o.writeContent("<p>body</p>"));
        String html = render("kit/page.jte", model);

        assertTrue(html.contains("data-lv-sidebar-open"), "mobile hamburger data-lv-sidebar-open missing:\n" + html);
        assertTrue(html.contains("lv-sidebar-mobile-open-trigger"), "mobile hamburger CSS class missing");
        assertTrue(html.contains("Open navigation"), "hamburger aria-label missing");
    }

    @Test
    void renders_the_user_menu_in_the_sidebar_footer() {
        // #493: when the page has a user the user-menu is placed in the sidebar footer (Filament
        // panel placement) so it collapses with the icon rail on desktop.
        // ADR sw-architecture-008 backflow.
        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("content", (gg.jte.Content) (o) -> o.writeContent("<p>body</p>"));
        String html = render("kit/page.jte", model);

        // The sidebar footer slot carries the user menu (footer wrapper + user-menu slot).
        assertTrue(html.contains("sidebar-footer"), "sidebar-footer slot missing:\n" + html);
        assertTrue(html.contains("kit-page-user-menu"), "user menu in sidebar footer missing");
        // The footer menu renders upward (chevron-up, inFooter=true) and shows the user identity.
        assertTrue(html.contains("Francesco Bilotta"), "user name missing in footer menu");
    }

    // ── #494 sidebar multi-level nav + external links ────────────────────────────────────────────

    @Test
    void renders_a_multi_level_parent_child_nav_group() {
        // #494: a nav row with parent="true" renders as a <details> disclosure (sidebar.item parent);
        // the child rows appear inside the disclosure content slot.
        // ADR sw-architecture-008 backflow.
        List<Map<String, String>> navRows = new java.util.ArrayList<>();
        Map<String, String> parent = new java.util.LinkedHashMap<>();
        parent.put("parent", "true");
        parent.put("label", "Settings");
        parent.put("icon", "settings");
        navRows.add(parent);
        Map<String, String> child1 = new java.util.LinkedHashMap<>();
        child1.put("child", "true");
        child1.put("label", "Users");
        child1.put("href", "/admin/users");
        navRows.add(child1);
        Map<String, String> child2 = new java.util.LinkedHashMap<>();
        child2.put("child", "true");
        child2.put("label", "Roles");
        child2.put("href", "/admin/roles");
        navRows.add(child2);

        KitPageView page = KitPageView.of("Acme", "Users", navRows);
        Map<String, Object> model = new HashMap<>();
        model.put("page", page);
        String html = render("kit/page/sidebar-nav.jte", model);

        // The parent renders as a disclosure (<details>/<summary>); the children are real <a href>.
        assertTrue(html.contains("data-sidebar=\"disclosure\""), "parent disclosure missing:\n" + html);
        assertTrue(html.contains("Settings"), "parent label missing");
        assertTrue(html.contains("/admin/users"), "child href missing");
        assertTrue(html.contains("/admin/roles"), "second child href missing");
    }

    @Test
    void renders_external_leaf_items_with_target_blank_and_rel_noopener() {
        // #494: a nav row with external="true" renders with target="_blank" rel="noopener" on the
        // leaf <a> (Filament's openInNewTab semantics). ADR sw-architecture-008 backflow.
        List<Map<String, String>> navRows = new java.util.ArrayList<>();
        Map<String, String> ext = new java.util.LinkedHashMap<>();
        ext.put("label", "Legacy App");
        ext.put("href", "https://legacy.example.com");
        ext.put("external", "true");
        navRows.add(ext);
        Map<String, String> plain = new java.util.LinkedHashMap<>();
        plain.put("label", "Dashboard");
        plain.put("href", "/admin");
        navRows.add(plain);

        KitPageView page = KitPageView.of("Acme", "Dashboard", navRows);
        Map<String, Object> model = new HashMap<>();
        model.put("page", page);
        String html = render("kit/page/sidebar-nav.jte", model);

        // The external item carries the security attributes.
        assertTrue(html.contains("target=\"_blank\""), "target=_blank missing on external link:\n" + html);
        assertTrue(html.contains("rel=\"noopener\""), "rel=noopener missing on external link");
        assertTrue(html.contains("https://legacy.example.com"), "external href missing");
        // The plain item must NOT carry target/rel.
        assertFalse(html.contains("/admin\" target"), "internal link must not carry target=_blank");
    }

    // ── #495 global-search mobile magnifier popover ──────────────────────────────────────────────

    @Test
    void renders_the_mobile_magnifier_button_and_the_desktop_search_field() {
        // #495: global-search emits both a sm:hidden magnifier popover trigger (mobile) and a
        // hidden sm:block inline field (desktop). ADR sw-architecture-008 backflow.
        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("results", null);
        String html = render("kit/page/global-search.jte", model);

        // Mobile: the popover trigger wrapper is present and sm:hidden.
        assertTrue(html.contains("kit-page-global-search-mobile"), "mobile search slot missing:\n" + html);
        assertTrue(html.contains("sm:hidden"), "mobile search must be sm:hidden");
        // Desktop: the inline field is present and hidden sm:block.
        assertTrue(html.contains("kit-page-global-search"), "desktop search slot missing");
        assertTrue(html.contains("hidden") && html.contains("sm:block"), "desktop field must be hidden sm:block");
        // The mobile trigger is a magnifier icon (data-slot).
        assertTrue(html.contains("kit-page-search-mobile-trigger"), "mobile trigger slot missing");
    }

    @Test
    void the_topbar_search_field_carries_the_veiled_surface_tokens() {
        // The global-search field had no visible background on the brand band. It must now drive the
        // input-group surface to the veiled, semi-transparent --lv-color-topbar-search-* tokens via the
        // --lv-group-bg / --lv-group-border arbitrary properties (resolved by input-group's own bg/border
        // with --lv-color-input / --lv-color-border as the unchanged default fallbacks). Legible on both
        // a navy and a green band because the tokens are built from currentColor.
        Map<String, Object> model = new HashMap<>();
        model.put("page", pageView());
        model.put("results", null);
        String html = render("kit/page/global-search.jte", model);

        // The field opts the input-group surface onto the veiled topbar-search tokens.
        assertTrue(
                html.contains("[--lv-group-bg:var(--lv-color-topbar-search-bg)]"),
                "search field must set --lv-group-bg to the veiled topbar-search surface:\n" + html);
        assertTrue(
                html.contains("[--lv-group-border:var(--lv-color-topbar-search-border)]"),
                "search field must set --lv-group-border to the veiled topbar-search border");
        // The input-group still resolves bg/border from those vars with the standard defaults as fallback.
        assertTrue(
                html.contains("bg-[var(--lv-group-bg,var(--lv-color-input))]"),
                "input-group must read its bg from --lv-group-bg with --lv-color-input fallback");
        assertTrue(
                html.contains("border-[var(--lv-group-border,var(--lv-color-border))]"),
                "input-group must read its border from --lv-group-border with --lv-color-border fallback");
    }

    // ── Fixtures for the list body ───────────────────────────────────────────────────────────────

    record TestRow(int id, String name) {}

    private dev.lievit.kit.Resource<TestRow> listResource() {
        java.util.List<TestRow> all = java.util.List.of(new TestRow(1, "Alpha"), new TestRow(2, "Beta"));
        dev.lievit.kit.RecordRepository<TestRow> repo =
                new dev.lievit.kit.RecordRepository<>() {
                    @Override
                    public Page<TestRow> page(Query query) {
                        return Page.of(all, all.size());
                    }

                    @Override
                    public java.util.Optional<TestRow> findById(String id) {
                        return all.stream()
                                .filter(r -> String.valueOf(r.id()).equals(id))
                                .findFirst();
                    }

                    @Override
                    public TestRow create(TestRow record) {
                        return record;
                    }

                    @Override
                    public TestRow update(String id, TestRow record) {
                        return record;
                    }

                    @Override
                    public void delete(String id) {}
                };
        return new dev.lievit.kit.Resource<>(repo) {
            @Override
            public String slug() {
                return "things";
            }

            @Override
            public String label() {
                return "Things";
            }

            @Override
            public dev.lievit.kit.Table<TestRow> table() {
                return dev.lievit.kit.Table.<TestRow>create()
                        .id(r -> String.valueOf(r.id()))
                        .column(dev.lievit.kit.TextColumn.make("Name", TestRow::name));
            }
        };
    }
}
