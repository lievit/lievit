/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.List;

/**
 * The persistence port for {@link DatabaseNotification database notifications} (the Filament
 * {@code Notifications/Livewire/DatabaseNotifications} backing store, the {@code notifications}
 * table). The kit's bell reads through this; the adopter supplies a JDBC/JPA implementation, exactly
 * as with {@link RecordRepository}. {@link InMemoryDatabaseNotificationStore} is the default for
 * tests and small deployments.
 *
 * <p>Every read is scoped to a recipient: a user only ever sees, counts, and mutates their own
 * notifications (the scoping is the security boundary, enforced in every method).
 */
public interface DatabaseNotificationStore {

    /**
     * Persists a notification to a recipient (the {@code sendToDatabase} equivalent).
     *
     * @param recipient the recipient user id
     * @param notification the flash notification to persist (its content is stored)
     * @return the persisted notification (with a store-assigned id + timestamp)
     */
    DatabaseNotification send(String recipient, AdminNotification notification);

    /**
     * Lists a recipient's notifications, newest first, as a bounded page.
     *
     * @param recipient the recipient user id
     * @param offset the zero-based first-row index
     * @param limit the maximum number of notifications to return
     * @return the recipient's notifications in that window, newest first
     */
    List<DatabaseNotification> list(String recipient, int offset, int limit);

    /**
     * @param recipient the recipient user id
     * @return the count of the recipient's unread notifications (the bell badge)
     */
    long unreadCount(String recipient);

    /**
     * Marks one of the recipient's notifications read. A no-op if it is not the recipient's or does
     * not exist (the scoping defends against marking another user's notification).
     *
     * @param recipient the recipient user id
     * @param id the notification id
     */
    void markRead(String recipient, String id);

    /**
     * Marks one of the recipient's notifications unread.
     *
     * @param recipient the recipient user id
     * @param id the notification id
     */
    void markUnread(String recipient, String id);

    /**
     * Marks every one of the recipient's notifications read.
     *
     * @param recipient the recipient user id
     */
    void markAllRead(String recipient);

    /**
     * Deletes one of the recipient's notifications.
     *
     * @param recipient the recipient user id
     * @param id the notification id
     */
    void delete(String recipient, String id);

    /**
     * Deletes every one of the recipient's notifications.
     *
     * @param recipient the recipient user id
     */
    void clearAll(String recipient);
}
