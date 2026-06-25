/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

/**
 * Specifies persistent (database) notifications (the Filament {@code DatabaseNotification} +
 * {@code Notification::sendToDatabase} + the bell): the store persists a notification scoped to a
 * recipient, the unread count + mark-read/unread transitions, the mark-all-read / clear-all
 * operations, and the strict per-recipient scoping (a user never sees or mutates another's
 * notifications). The {@link NotificationBell} is the stateful view the topbar renders.
 */
class DatabaseNotificationTest {

    private static final Clock FIXED = Clock.fixed(Instant.parse("2026-06-18T10:00:00Z"), ZoneOffset.UTC);

    /**
     * @spec.given a notification store and an admin notification
     * @spec.when  it is sent to a recipient via sendToDatabase
     * @spec.then  it persists with the (id, recipient, data, unread) shape and the rendered content
     */
    @Test
    void send_to_database_persists_a_notification_to_a_recipient() {
        DatabaseNotificationStore store = new InMemoryDatabaseNotificationStore(FIXED);

        DatabaseNotification saved =
                AdminNotification.success("Import done").body("42 rows").sendToDatabase(store, "u1");

        assertThat(saved.id()).isNotBlank();
        assertThat(saved.recipient()).isEqualTo("u1");
        assertThat(saved.isUnread()).isTrue();
        assertThat(saved.data()).containsEntry("title", "Import done").containsEntry("body", "42 rows");
        assertThat(saved.createdAt()).isEqualTo(Instant.parse("2026-06-18T10:00:00Z"));
    }

    /**
     * @spec.given a recipient with two persisted notifications
     * @spec.when  the unread count is read and one is marked read
     * @spec.then  the count drops and the bell reflects the transition
     */
    @Test
    void unread_count_and_mark_read_transition() {
        InMemoryDatabaseNotificationStore store = new InMemoryDatabaseNotificationStore(FIXED);
        DatabaseNotification a = AdminNotification.info("a").sendToDatabase(store, "u1");
        AdminNotification.info("b").sendToDatabase(store, "u1");
        NotificationBell bell = NotificationBell.of(store, "u1");

        assertThat(bell.unreadCount()).isEqualTo(2);

        bell.markRead(a.id());

        assertThat(bell.unreadCount()).isEqualTo(1);
        assertThat(bell.hasUnread()).isTrue();
    }

    /**
     * @spec.given a recipient with a notification marked read
     * @spec.when  it is marked unread again
     * @spec.then  the unread count rises back
     */
    @Test
    void mark_unread_reverses_the_transition() {
        InMemoryDatabaseNotificationStore store = new InMemoryDatabaseNotificationStore(FIXED);
        DatabaseNotification a = AdminNotification.info("a").sendToDatabase(store, "u1");
        NotificationBell bell = NotificationBell.of(store, "u1");
        bell.markRead(a.id());
        assertThat(bell.unreadCount()).isZero();

        bell.markUnread(a.id());

        assertThat(bell.unreadCount()).isEqualTo(1);
    }

    /**
     * @spec.given a recipient with several notifications
     * @spec.when  mark-all-read then clear-all run
     * @spec.then  all become read, then the list empties
     */
    @Test
    void mark_all_read_and_clear_all() {
        InMemoryDatabaseNotificationStore store = new InMemoryDatabaseNotificationStore(FIXED);
        AdminNotification.info("a").sendToDatabase(store, "u1");
        AdminNotification.info("b").sendToDatabase(store, "u1");
        NotificationBell bell = NotificationBell.of(store, "u1");

        bell.markAllRead();
        assertThat(bell.unreadCount()).isZero();
        assertThat(bell.notifications()).hasSize(2);

        bell.clearAll();
        assertThat(bell.notifications()).isEmpty();
    }

    /**
     * @spec.given two recipients each with their own notifications
     * @spec.when  one recipient reads, lists, and clears
     * @spec.then  the other recipient's notifications are untouched (per-user scoping)
     */
    @Test
    void notifications_are_scoped_strictly_to_the_recipient() {
        InMemoryDatabaseNotificationStore store = new InMemoryDatabaseNotificationStore(FIXED);
        DatabaseNotification mine = AdminNotification.info("mine").sendToDatabase(store, "u1");
        DatabaseNotification theirs = AdminNotification.info("theirs").sendToDatabase(store, "u2");

        // u1 cannot mark/delete u2's notification (scoping is a no-op for the wrong owner).
        store.markRead("u1", theirs.id());
        store.delete("u1", theirs.id());

        assertThat(store.unreadCount("u2")).isEqualTo(1);
        assertThat(store.list("u1", 0, 10)).extracting(DatabaseNotification::id).containsExactly(mine.id());
        assertThat(store.list("u2", 0, 10)).extracting(DatabaseNotification::id).containsExactly(theirs.id());

        store.clearAll("u1");
        assertThat(store.unreadCount("u2")).isEqualTo(1);
    }

    /**
     * @spec.given a recipient with three notifications and a bell paged at size 2
     * @spec.when  the second page is read
     * @spec.then  it returns the remaining notification, newest first across pages
     */
    @Test
    void the_bell_list_is_paginated() {
        InMemoryDatabaseNotificationStore store = new InMemoryDatabaseNotificationStore(FIXED);
        for (int i = 1; i <= 3; i++) {
            AdminNotification.info("n" + i).sendToDatabase(store, "u1");
        }
        NotificationBell bell = NotificationBell.of(store, "u1").pageSize(2);

        assertThat(bell.page(1)).hasSize(2);
        assertThat(bell.page(2)).hasSize(1);
    }

    /**
     * @spec.given a panel with database notifications enabled at a custom polling interval
     * @spec.when  the bell is built for a recipient
     * @spec.then  the bell honours the panel's polling interval
     */
    @Test
    void the_panel_toggle_builds_a_bell_with_the_configured_polling() {
        Panel panel =
                Panel.create("admin")
                        .databaseNotificationsPolling(java.time.Duration.ofSeconds(15));
        InMemoryDatabaseNotificationStore store = new InMemoryDatabaseNotificationStore(FIXED);

        NotificationBell bell = panel.notificationBell(store, "u1");

        assertThat(panel.hasDatabaseNotifications()).isTrue();
        assertThat(bell.pollInterval()).isEqualTo(java.time.Duration.ofSeconds(15));
    }
}
