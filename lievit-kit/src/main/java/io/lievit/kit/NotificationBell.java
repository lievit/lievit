/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.time.Duration;
import java.util.List;
import java.util.Objects;

/**
 * The topbar notification bell (the Filament {@code Livewire/DatabaseNotifications} component): a
 * stateful view over a recipient's {@link DatabaseNotificationStore}, exposing the unread badge
 * count, a paginated dropdown list, and the mark-read / mark-unread / delete / mark-all-read /
 * clear-all operations the dropdown wires. It is scoped to one recipient at construction; every
 * read/mutation it issues carries that recipient, so the bell can only ever touch its own user's
 * notifications.
 *
 * <p>The bell refreshes by {@linkplain #pollInterval() polling} (default 30s, the Filament default);
 * a websocket broadcast accelerator is a separate, deferred concern (issue #304).
 */
public final class NotificationBell {

    /** The default polling interval the bell refreshes on (Filament's 30s default). */
    public static final Duration DEFAULT_POLL_INTERVAL = Duration.ofSeconds(30);

    /** The default dropdown page size. */
    public static final int DEFAULT_PAGE_SIZE = 10;

    private final DatabaseNotificationStore store;
    private final String recipient;
    private final Duration pollInterval;
    private final int pageSize;

    private NotificationBell(
            DatabaseNotificationStore store, String recipient, Duration pollInterval, int pageSize) {
        this.store = Objects.requireNonNull(store, "store");
        this.recipient = Objects.requireNonNull(recipient, "recipient");
        this.pollInterval = Objects.requireNonNull(pollInterval, "pollInterval");
        this.pageSize = pageSize < 1 ? 1 : pageSize;
    }

    /**
     * @param store the notification store
     * @param recipient the recipient user id the bell is scoped to
     * @return a bell on the default polling interval and page size
     */
    public static NotificationBell of(DatabaseNotificationStore store, String recipient) {
        return new NotificationBell(store, recipient, DEFAULT_POLL_INTERVAL, DEFAULT_PAGE_SIZE);
    }

    /**
     * @param interval the polling interval
     * @return a copy refreshing on the given interval
     */
    public NotificationBell pollInterval(Duration interval) {
        return new NotificationBell(store, recipient, interval, pageSize);
    }

    /**
     * @param size the dropdown page size
     * @return a copy with the given page size
     */
    public NotificationBell pageSize(int size) {
        return new NotificationBell(store, recipient, pollInterval, size);
    }

    /** @return the recipient user id the bell is scoped to */
    public String recipient() {
        return recipient;
    }

    /** @return the polling refresh interval */
    public Duration pollInterval() {
        return pollInterval;
    }

    /** @return the unread badge count */
    public long unreadCount() {
        return store.unreadCount(recipient);
    }

    /** @return whether the badge should show (any unread) */
    public boolean hasUnread() {
        return unreadCount() > 0;
    }

    /**
     * @param page the one-based page number
     * @return that page of the recipient's notifications, newest first
     */
    public List<DatabaseNotification> page(int page) {
        int safePage = page < 1 ? 1 : page;
        return store.list(recipient, (safePage - 1) * pageSize, pageSize);
    }

    /** @return the first page of the recipient's notifications */
    public List<DatabaseNotification> notifications() {
        return page(1);
    }

    /**
     * @param id the notification id
     */
    public void markRead(String id) {
        store.markRead(recipient, id);
    }

    /**
     * @param id the notification id
     */
    public void markUnread(String id) {
        store.markUnread(recipient, id);
    }

    /** Marks every notification read. */
    public void markAllRead() {
        store.markAllRead(recipient);
    }

    /**
     * @param id the notification id
     */
    public void delete(String id) {
        store.delete(recipient, id);
    }

    /** Deletes every notification. */
    public void clearAll() {
        store.clearAll(recipient);
    }
}
