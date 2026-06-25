/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

import dev.lievit.kit.AdminNotification;
import dev.lievit.kit.DatabaseNotification;
import dev.lievit.kit.NotificationBell;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * The render-time bundle the kit bell template ({@code kit/notification/bell.jte}) reads: a
 * recipient-scoped {@link NotificationBell} (the unread count + the page of the recipient's
 * {@link DatabaseNotification}s) PLUS the render-only facts the pure view-model deliberately does not
 * carry, which all depend on the host's URL shape and presentation clock:
 *
 * <ul>
 *   <li>the server-first mutation URLs the panel forms POST to ({@link #markAllReadUrl()},
 *       {@link #clearAllUrl()}, and the per-row {@link #markReadUrl(String)} from a {@code %s} id
 *       pattern), so every control is a real {@code <form>} submit that works JS-off;
 *   <li>the per-row presentation derived from each notification's {@code data} map and
 *       {@code createdAt}: the {@link #title}, {@link #body}, a level→Lucide {@link #icon} (the
 *       stored heroicon-style icon is intentionally NOT used; it is not in the lievit set), an
 *       optional deep-link {@link #rowHref}, and a {@link #relativeTime} formatted against the
 *       render clock.
 * </ul>
 *
 * <p>This mirrors {@link KitTableView}: it keeps {@link NotificationBell} a pure recipient-scoped
 * read/mutation model while giving the template ONE typed object that already speaks the lievit-ui
 * notification-bell vocabulary. A host builds it with {@link #of(NotificationBell, String, String,
 * String)} and reads the same row helpers the template calls.
 *
 * @param bell the recipient-scoped bell (unread count + the notification page)
 * @param page the one-based page of notifications the panel lists (the bell's first page by default)
 * @param id the panel element id (the popover target; unique per page)
 * @param markReadUrlPattern a {@code printf} pattern with one {@code %s} = notification id, for the
 *     per-row mark-read POST (e.g. {@code "/admin/notifications/%s/read"})
 * @param markAllReadUrl the mark-all-read POST href
 * @param clearAllUrl the clear-all POST href
 * @param rowHrefPattern a {@code printf} pattern with one {@code %s} = notification id, for a row
 *     deep-link (e.g. {@code "/admin/notifications/%s"}); empty leaves rows inert
 * @param now the render clock the relative time is computed against
 */
public record KitBellView(
        NotificationBell bell,
        int page,
        String id,
        String markReadUrlPattern,
        String markAllReadUrl,
        String clearAllUrl,
        String rowHrefPattern,
        Instant now) {

    /** The default panel element id (the popover target). */
    public static final String DEFAULT_ID = "lv-notification-bell";

    /** Compact constructor: defends the collaborators and never-nulls the optional strings. */
    public KitBellView {
        Objects.requireNonNull(bell, "bell");
        Objects.requireNonNull(now, "now");
        id = id == null || id.isBlank() ? DEFAULT_ID : id;
        markReadUrlPattern = markReadUrlPattern == null ? "" : markReadUrlPattern;
        markAllReadUrl = markAllReadUrl == null ? "" : markAllReadUrl;
        clearAllUrl = clearAllUrl == null ? "" : clearAllUrl;
        rowHrefPattern = rowHrefPattern == null ? "" : rowHrefPattern;
    }

    /**
     * The minimal bundle: the bell, its first page, the three mutation URLs, the default panel id,
     * no row deep-link, and the render clock {@code now}.
     *
     * @param bell the recipient-scoped bell
     * @param markReadUrlPattern the {@code %s} per-row mark-read POST pattern
     * @param markAllReadUrl the mark-all-read POST href
     * @param clearAllUrl the clear-all POST href
     * @return the render bundle
     */
    public static KitBellView of(
            NotificationBell bell,
            String markReadUrlPattern,
            String markAllReadUrl,
            String clearAllUrl) {
        return new KitBellView(
                bell, 1, DEFAULT_ID, markReadUrlPattern, markAllReadUrl, clearAllUrl, "",
                Instant.now());
    }

    /**
     * @param page the one-based page to list
     * @return a copy listing that page
     */
    public KitBellView withPage(int page) {
        return new KitBellView(
                bell, page, id, markReadUrlPattern, markAllReadUrl, clearAllUrl, rowHrefPattern, now);
    }

    /**
     * @param id the panel element id
     * @return a copy with the panel id set
     */
    public KitBellView withId(String id) {
        return new KitBellView(
                bell, page, id, markReadUrlPattern, markAllReadUrl, clearAllUrl, rowHrefPattern, now);
    }

    /**
     * @param pattern the {@code %s} row deep-link pattern
     * @return a copy carrying the per-row deep-link pattern
     */
    public KitBellView withRowHref(String pattern) {
        return new KitBellView(
                bell, page, id, markReadUrlPattern, markAllReadUrl, clearAllUrl, pattern, now);
    }

    /**
     * @param clock the render clock the relative time is computed against
     * @return a copy pinned to that clock (deterministic relative time in tests)
     */
    public KitBellView withClock(Instant clock) {
        return new KitBellView(
                bell, page, id, markReadUrlPattern, markAllReadUrl, clearAllUrl, rowHrefPattern, clock);
    }

    /** @return the unread badge count (the trigger pill; hidden at zero by the partial) */
    public long unreadCount() {
        return bell.unreadCount();
    }

    /** @return the page of the recipient's notifications, newest first */
    public List<DatabaseNotification> notifications() {
        return bell.page(page);
    }

    /** @return whether the listed page has any notification (else the empty line renders) */
    public boolean hasNotifications() {
        return !notifications().isEmpty();
    }

    /**
     * @param id a notification id
     * @return the mark-read POST href for that row (the {@code %s} pattern with the id), or empty
     */
    public String markReadUrl(String id) {
        return markReadUrlPattern.isBlank()
                ? ""
                : markReadUrlPattern.formatted(Objects.requireNonNull(id, "id"));
    }

    /**
     * @param n a notification
     * @return its title from the stored {@code data}, or empty when absent
     */
    public String title(DatabaseNotification n) {
        return string(n, "title");
    }

    /**
     * @param n a notification
     * @return its body from the stored {@code data}, or empty when absent
     */
    public String body(DatabaseNotification n) {
        return string(n, "body");
    }

    /**
     * The leading Lucide icon for a row, derived from the notification's stored {@code level} (the
     * {@link AdminNotification.Level}), NOT from the stored heroicon-style {@code icon} (which is not
     * in the lievit set). Unknown / absent level => no icon.
     *
     * @param n a notification
     * @return the Lucide icon name, or empty when the level is unknown
     */
    public String icon(DatabaseNotification n) {
        return switch (string(n, "level").toLowerCase(Locale.ROOT)) {
            case "success" -> "circle-check";
            case "warning" -> "triangle-alert";
            case "danger" -> "circle-x";
            case "info" -> "info";
            default -> "";
        };
    }

    /**
     * @param n a notification
     * @return the row deep-link href (the {@code %s} pattern with the id), or empty for an inert row
     */
    public String rowHref(DatabaseNotification n) {
        return rowHrefPattern.isBlank() ? "" : rowHrefPattern.formatted(n.id());
    }

    /**
     * A compact relative time for a row, computed from the notification's {@code createdAt} against
     * the bundle's render clock ("just now", "2m ago", "3h ago", "5d ago"). Display-only.
     *
     * @param n a notification
     * @return the relative time label
     */
    public String relativeTime(DatabaseNotification n) {
        Duration ago = Duration.between(n.createdAt(), now);
        if (ago.isNegative()) {
            return "just now";
        }
        long minutes = ago.toMinutes();
        if (minutes < 1) {
            return "just now";
        }
        if (minutes < 60) {
            return minutes + "m ago";
        }
        long hours = ago.toHours();
        if (hours < 24) {
            return hours + "h ago";
        }
        return ago.toDays() + "d ago";
    }

    private static String string(DatabaseNotification n, String key) {
        Object value = n.data().get(key);
        return value == null ? "" : value.toString();
    }
}
