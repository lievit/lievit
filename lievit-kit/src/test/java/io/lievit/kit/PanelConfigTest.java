/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

/**
 * Specifies the panel configuration surface added for the admin shell: the multi-panel registry
 * (#319), branding/theming (#321), auth scaffolding (#325), the panel-access gate, and the
 * navigation tree derived from a panel's resources with authorization filtering (#327). Pure tests.
 */
class PanelConfigTest {

    private static Resource<String> resource(String slug, String label) {
        return new Resource<String>(repo()) {
            @Override
            public String slug() {
                return slug;
            }

            @Override
            public String label() {
                return label;
            }

            @Override
            public Table<String> table() {
                return Table.create();
            }
        };
    }

    private static RecordRepository<String> repo() {
        return new RecordRepository<>() {
            @Override
            public Page<String> page(Query query) {
                return Page.of(List.of(), 0);
            }

            @Override
            public Optional<String> findById(String id) {
                return Optional.empty();
            }

            @Override
            public String create(String record) {
                return record;
            }

            @Override
            public String update(String id, String record) {
                return record;
            }

            @Override
            public void delete(String id) {}
        };
    }

    // ── Multi-panel registry (#319) ─────────────────────────────────────────────────────────────

    /**
     * @spec.given two panels with distinct ids/paths, one marked default
     * @spec.when  the registry resolves the default
     * @spec.then  the marked panel is returned
     */
    @Test
    void registry_resolves_the_marked_default_panel() {
        Panel admin = Panel.create("admin").makeDefault();
        Panel portal = Panel.create("portal").path("app");
        PanelRegistry registry = PanelRegistry.create().register(admin).register(portal);

        assertThat(registry.getDefault()).isSameAs(admin);
        assertThat(registry.get("portal")).contains(portal);
    }

    /**
     * @spec.given a registry with a single panel and no explicit default
     * @spec.when  the default is resolved
     * @spec.then  the only panel is the default
     */
    @Test
    void registry_treats_a_lone_panel_as_the_default() {
        Panel only = Panel.create("admin");
        PanelRegistry registry = PanelRegistry.create().register(only);

        assertThat(registry.getDefault()).isSameAs(only);
    }

    /**
     * @spec.given a registry with several panels and none marked default
     * @spec.when  the default is resolved
     * @spec.then  it throws, demanding an explicit default
     */
    @Test
    void registry_demands_an_explicit_default_when_several_panels_exist() {
        PanelRegistry registry =
                PanelRegistry.create()
                        .register(Panel.create("a").path("a"))
                        .register(Panel.create("b").path("b"));

        assertThatThrownBy(registry::getDefault).isInstanceOf(IllegalStateException.class);
    }

    /**
     * @spec.given two panels registered as default
     * @spec.when  the second is registered
     * @spec.then  it is rejected (at most one default)
     */
    @Test
    void registry_rejects_a_second_default_panel() {
        PanelRegistry registry = PanelRegistry.create().register(Panel.create("a").makeDefault());

        assertThatThrownBy(() -> registry.register(Panel.create("b").path("b").makeDefault()))
                .isInstanceOf(IllegalStateException.class);
    }

    /**
     * @spec.given two panels at different route prefixes
     * @spec.when  a request path is resolved to its owning panel
     * @spec.then  the matching-prefix panel is returned, longest prefix wins
     */
    @Test
    void registry_resolves_the_owning_panel_by_route_prefix() {
        Panel admin = Panel.create("admin");
        Panel portal = Panel.create("portal").path("app");
        PanelRegistry registry = PanelRegistry.create().register(admin).register(portal);

        assertThat(registry.resolveForPath("/admin/listings/1/edit")).contains(admin);
        assertThat(registry.resolveForPath("/app/orders")).contains(portal);
        assertThat(registry.resolveForPath("/nowhere")).isEmpty();
    }

    /**
     * @spec.given a panel already registered
     * @spec.when  another panel reuses its path
     * @spec.then  the duplicate path is rejected
     */
    @Test
    void registry_rejects_a_duplicate_path() {
        PanelRegistry registry = PanelRegistry.create().register(Panel.create("a").path("admin"));

        assertThatThrownBy(() -> registry.register(Panel.create("b").path("admin")))
                .isInstanceOf(IllegalStateException.class);
    }

    // ── Branding / theming (#321) ───────────────────────────────────────────────────────────────

    /**
     * @spec.given a panel with brand name, logo, favicon, primary color, and dark mode
     * @spec.when  the branding slots are read
     * @spec.then  each returns the configured value
     */
    @Test
    void panel_carries_branding_and_theme_config() {
        Panel panel =
                Panel.create("admin")
                        .brandName("HouseTree")
                        .brandLogo("/logo.svg", "/logo-dark.svg")
                        .favicon("/favicon.ico")
                        .primaryColor(Color.of("indigo"))
                        .defaultThemeMode(ThemeMode.DARK)
                        .maxContentWidth("7xl")
                        .topNavigation(true);

        assertThat(panel.brandName()).contains("HouseTree");
        assertThat(panel.brandLogo()).contains("/logo.svg");
        assertThat(panel.darkModeBrandLogo()).contains("/logo-dark.svg");
        assertThat(panel.favicon()).contains("/favicon.ico");
        assertThat(panel.primaryColor()).contains(Color.of("indigo"));
        assertThat(panel.defaultThemeMode()).isEqualTo(ThemeMode.DARK);
        assertThat(panel.maxContentWidth()).contains("7xl");
        assertThat(panel.isTopNavigation()).isTrue();
    }

    /**
     * @spec.given a fresh panel
     * @spec.when  its theme defaults are read
     * @spec.then  dark mode is offered and the default theme mode is SYSTEM
     */
    @Test
    void panel_theme_defaults_are_dark_capable_and_follow_system() {
        Panel panel = Panel.create("admin");

        assertThat(panel.isDarkMode()).isTrue();
        assertThat(panel.defaultThemeMode()).isEqualTo(ThemeMode.SYSTEM);
        assertThat(panel.theme()).isEmpty();
    }

    // ── Auth scaffolding (#325) ─────────────────────────────────────────────────────────────────

    /**
     * @spec.given a fresh panel
     * @spec.when  the auth-page flags are read
     * @spec.then  registration, password reset, and email verification are all disabled by default
     */
    @Test
    void panel_auth_pages_are_disabled_by_default() {
        Panel panel = Panel.create("admin");

        assertThat(panel.hasRegistration()).isFalse();
        assertThat(panel.hasPasswordReset()).isFalse();
        assertThat(panel.hasEmailVerification()).isFalse();
    }

    /**
     * @spec.given a panel with auth pages enabled
     * @spec.when  the flags are read
     * @spec.then  each enabled page reports true
     */
    @Test
    void panel_enables_auth_pages_on_request() {
        Panel panel = Panel.create("admin").registration().passwordReset().emailVerification();

        assertThat(panel.hasRegistration()).isTrue();
        assertThat(panel.hasPasswordReset()).isTrue();
        assertThat(panel.hasEmailVerification()).isTrue();
    }

    /**
     * @spec.given a panel whose access gate admits only an authenticated principal
     * @spec.when  the gate is asked about anonymous and authenticated principals
     * @spec.then  it denies anonymous and admits authenticated
     */
    @Test
    void panel_access_gate_denies_anonymous_when_authentication_required() {
        Panel panel = Panel.create("admin").accessGate(PanelAccessGate.authenticated());

        assertThat(panel.accessGate().canAccess(null)).isFalse();
        assertThat(panel.accessGate().canAccess("alice")).isTrue();
    }

    /**
     * @spec.given a fresh panel
     * @spec.when  its default access gate is consulted
     * @spec.then  it admits everyone (the v0.1 default)
     */
    @Test
    void panel_access_gate_defaults_to_permit_all() {
        assertThat(Panel.create("admin").accessGate().canAccess(null)).isTrue();
    }

    // ── Navigation from a panel with authorization filtering (#278/#327) ────────────────────────

    /**
     * @spec.given a panel with two resources and a visibility predicate that denies one
     * @spec.when  the navigation tree is built
     * @spec.then  the unauthorized resource's nav item is hidden (authorization at the nav seam)
     */
    @Test
    void panel_navigation_hides_an_unauthorized_resource() {
        Resource<String> listings = resource("listings", "Listings");
        Resource<String> users = resource("users", "Users");
        Panel panel = Panel.create("admin").resource(listings).resource(users);

        NavigationBuilder nav = panel.buildNavigation(r -> r == listings);

        assertThat(nav.visibleItems()).extracting(NavigationItem::label).containsExactly("Listings");
    }

    /**
     * @spec.given a panel with an explicit navigation builder
     * @spec.when  the navigation tree is built
     * @spec.then  the explicit builder is returned verbatim (overrides the auto-derivation)
     */
    @Test
    void panel_explicit_navigation_overrides_auto_derivation() {
        NavigationBuilder explicit =
                NavigationBuilder.create().item(NavigationItem.make("Custom", "/custom"));
        Panel panel = Panel.create("admin").resource(resource("listings", "Listings")).navigation(explicit);

        assertThat(panel.buildNavigation(r -> true)).isSameAs(explicit);
    }
}
