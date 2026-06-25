/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the account widget (the Filament {@code AccountWidget}): a dashboard card greeting the
 * authenticated user with avatar + profile link, the dashboard twin of the topbar user menu. It is
 * both a {@link Widget} (greeting/name) and a {@link DashboardWidget} (grid placement).
 */
class AccountWidgetTest {

    /**
     * @spec.given an account widget for a user with an avatar and a profile link
     * @spec.when  its surface is read
     * @spec.then  the heading is the greeting, the value is the user name, avatar/profile are carried
     */
    @Test
    void the_account_widget_greets_the_user_with_avatar_and_profile() {
        AccountWidget w =
                AccountWidget.of("Francesco")
                        .greeting("Ciao")
                        .avatarUrl("/avatars/f.png")
                        .profileUrl("/admin/profile");

        assertThat(w.heading()).isEqualTo("Ciao");
        assertThat(w.value()).isEqualTo("Francesco");
        assertThat(w.avatarUrl()).contains("/avatars/f.png");
        assertThat(w.profileUrl()).contains("/admin/profile");
    }

    /**
     * @spec.given a default account widget
     * @spec.when  the dashboard placement is read
     * @spec.then  it defaults to the greeting "Welcome back" and sorts to the top of the grid
     */
    @Test
    void it_defaults_to_a_welcome_greeting_and_sorts_to_the_top() {
        AccountWidget w = AccountWidget.of("Francesco");

        assertThat(w.heading()).isEqualTo("Welcome back");
        assertThat(w.sort()).isEqualTo(Integer.MIN_VALUE);
        assertThat(w.canView()).isTrue();
    }
}
