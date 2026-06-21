/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * RENDER gate for the lievit-kit canonical PANEL SHELL (kit/page.jte + kit/page/* sub-parts).
 *
 * The precompile smoke (the jte-maven-plugin `generate` goal in this module's pom, which stages the
 * whole kit/ tree) proves the templates COMPILE against io.lievit.kit + the lievit-ui partials; it
 * cannot prove the Filament panel chrome actually RENDERS. This does: it builds a real Panel +
 * KitPageView (via KitPageComponent) + the page-body view-models (AdminFormView / AdminViewView /
 * AuthFormView), source-renders kit/page.jte + the resource / auth wrappers on the fly (the same
 * gg.jte 3.2.4 compiler, ContentType.Html, DirectoryCodeResolver over the staged target/jte-src
 * tree), and asserts the chrome lands: the sidebar nav tree with the active item, the topbar (global
 * search + notification bell + user menu with the theme switcher), the page header (breadcrumbs + h1
 * + header actions), and the list / form / view / auth bodies.
 */
package io.lievit.kit.jtecompile;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;
import gg.jte.resolve.DirectoryCodeResolver;
import io.lievit.kit.AdminFormView;
import io.lievit.kit.AdminViewView;
import io.lievit.kit.Color;
import io.lievit.kit.GlobalSearchResult;
import io.lievit.kit.GlobalSearchResults;
import io.lievit.kit.Icon;
import io.lievit.kit.IconRegistry;
import io.lievit.kit.NavigationBuilder;
import io.lievit.kit.NavigationGroup;
import io.lievit.kit.NavigationItem;
import io.lievit.kit.Panel;
import io.lievit.kit.ThemeMode;
import io.lievit.kit.auth.AuthFormView;
import io.lievit.kit.page.KitPageComponent;
import io.lievit.kit.page.KitPageView;
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
        io.lievit.kit.Resource<TestRow> resource = listResource();
        io.lievit.kit.AdminListView listView = io.lievit.kit.AdminListView.of(resource, 1, 10);
        io.lievit.kit.page.KitTableView table =
                io.lievit.kit.page.KitTableView.of(listView).withPageHref("/admin/things?page=%d");

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
                                        "notes", "Notes", "TextareaField", "VIP", List.of()),
                                new AdminFormView.FieldView(
                                        "active", "Active", "ToggleField", "true", List.of()),
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
        assertTrue(html.contains("Save changes"), "edit submit label missing");
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

    // ── Fixtures for the list body ───────────────────────────────────────────────────────────────

    record TestRow(int id, String name) {}

    private io.lievit.kit.Resource<TestRow> listResource() {
        java.util.List<TestRow> all = java.util.List.of(new TestRow(1, "Alpha"), new TestRow(2, "Beta"));
        io.lievit.kit.RecordRepository<TestRow> repo =
                new io.lievit.kit.RecordRepository<>() {
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
        return new io.lievit.kit.Resource<>(repo) {
            @Override
            public String slug() {
                return "things";
            }

            @Override
            public String label() {
                return "Things";
            }

            @Override
            public io.lievit.kit.Table<TestRow> table() {
                return io.lievit.kit.Table.<TestRow>create()
                        .id(r -> String.valueOf(r.id()))
                        .column(io.lievit.kit.TextColumn.make("Name", TestRow::name));
            }
        };
    }
}
