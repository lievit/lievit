/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the topbar user menu + edit-profile page (the Filament {@code HasUserMenu} +
 * {@code EditProfile}): a panel carries configurable user-menu items (the always-present logout
 * aside), and enabling the profile page routes {@code <panel>/profile}.
 */
class UserMenuTest {

    /**
     * @spec.given a panel with two extra user-menu items
     * @spec.when  the menu items are read back
     * @spec.then  they are carried in declaration order with their icon/url
     */
    @Test
    void a_panel_carries_configurable_user_menu_items() {
        Panel panel =
                Panel.create("admin")
                        .userMenuItems(
                                MenuItem.make("Settings", "/admin/settings").icon("heroicon-o-cog"),
                                MenuItem.make("Docs", "https://docs.test").openUrlInNewTab());

        assertThat(panel.userMenuItems()).extracting(MenuItem::label).containsExactly("Settings", "Docs");
        assertThat(panel.userMenuItems().get(0).icon()).isEqualTo("heroicon-o-cog");
        assertThat(panel.userMenuItems().get(1).opensInNewTab()).isTrue();
    }

    /**
     * @spec.given a panel with the profile page enabled
     * @spec.when  the profile state is read
     * @spec.then  the page is on and routes under the panel path
     */
    @Test
    void enabling_the_profile_page_routes_it_under_the_panel() {
        Panel panel = Panel.create("admin").path("backoffice").profile();

        assertThat(panel.hasProfilePage()).isTrue();
        assertThat(panel.profilePath()).isEqualTo("backoffice/profile");
    }

    /**
     * @spec.given a default panel
     * @spec.when  the user-menu/profile state is read
     * @spec.then  no extra items and the profile page is off (Filament parity)
     */
    @Test
    void a_default_panel_has_no_extra_menu_items_and_no_profile_page() {
        Panel panel = Panel.create("admin");

        assertThat(panel.userMenuItems()).isEmpty();
        assertThat(panel.hasProfilePage()).isFalse();
    }
}
