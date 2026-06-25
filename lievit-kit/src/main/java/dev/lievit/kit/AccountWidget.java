/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * The default dashboard account widget (the Filament {@code AccountWidget}): a card that greets the
 * authenticated user by name with their avatar and a link to the {@linkplain Panel#profile() profile
 * page}. It is the dashboard twin of the topbar user menu (issue #343); pairing them is why the
 * account widget lands with the user-menu/profile work.
 *
 * <p>Implements {@link Widget} (heading = the greeting, value = the user name) and
 * {@link DashboardWidget} (grid placement), so it drops onto a {@link WidgetPage} like any other.
 * The avatar and the profile url are the account-specific slots beyond the base widget.
 */
public final class AccountWidget implements Widget, DashboardWidget {

    private final String userName;
    private String greeting = "Welcome back";
    private @Nullable String avatarUrl;
    private @Nullable String profileUrl;
    private int sort = Integer.MIN_VALUE; // accounts sit at the top of the dashboard by default

    private AccountWidget(String userName) {
        this.userName = Objects.requireNonNull(userName, "userName");
    }

    /**
     * @param userName the authenticated user's display name
     * @return an account widget for that user
     */
    public static AccountWidget of(String userName) {
        return new AccountWidget(userName);
    }

    /**
     * Overrides the greeting (defaults to {@code "Welcome back"}).
     *
     * @param text the greeting
     * @return this widget
     */
    public AccountWidget greeting(String text) {
        this.greeting = Objects.requireNonNull(text, "text");
        return this;
    }

    /**
     * @param url the avatar image url
     * @return this widget
     */
    public AccountWidget avatarUrl(String url) {
        this.avatarUrl = Objects.requireNonNull(url, "url");
        return this;
    }

    /**
     * @param url the profile-page url the card links to
     * @return this widget
     */
    public AccountWidget profileUrl(String url) {
        this.profileUrl = Objects.requireNonNull(url, "url");
        return this;
    }

    /**
     * @param sortKey the dashboard-grid sort key
     * @return this widget
     */
    public AccountWidget sort(int sortKey) {
        this.sort = sortKey;
        return this;
    }

    @Override
    public String heading() {
        return greeting;
    }

    @Override
    public String value() {
        return userName;
    }

    @Override
    public Optional<String> description() {
        return Optional.empty();
    }

    /** @return the avatar image url, if set */
    public Optional<String> avatarUrl() {
        return Optional.ofNullable(avatarUrl);
    }

    /** @return the profile-page url the card links to, if set */
    public Optional<String> profileUrl() {
        return Optional.ofNullable(profileUrl);
    }

    @Override
    public int sort() {
        return sort;
    }
}
