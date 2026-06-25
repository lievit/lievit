/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * One persisted notification (the Filament {@code DatabaseNotification}): the durable counterpart of
 * a flash {@link AdminNotification}, stored against a recipient so it survives navigation and the
 * recipient sees it later in the bell. The {@code (id, recipient, data, readAt, createdAt)} shape
 * mirrors Laravel's notifications table.
 *
 * <p>The {@code data} carries the rendered content (the {@link AdminNotification#toMap()} keys plus
 * any {@linkplain NotificationAction actions}), so a stored notification renders identically to a
 * flashed one. Immutable: {@link #markRead}/{@link #markUnread} return copies; the store persists
 * the new state.
 *
 * @param id the notification id (store-assigned)
 * @param recipient the recipient user id this notification is scoped to
 * @param data the rendered notification content (title/body/icon/color/actions...)
 * @param readAt when the recipient read it, or {@code null} while unread
 * @param createdAt when the notification was persisted
 */
public record DatabaseNotification(
        String id,
        String recipient,
        Map<String, Object> data,
        @Nullable Instant readAt,
        Instant createdAt) {

    /** Compact constructor: defends the collaborators and copies the data map. */
    public DatabaseNotification {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(recipient, "recipient");
        Objects.requireNonNull(createdAt, "createdAt");
        data = Map.copyOf(data);
    }

    /** @return whether the recipient has not yet read this notification */
    public boolean isUnread() {
        return readAt == null;
    }

    /** @return whether the recipient has read this notification */
    public boolean isRead() {
        return readAt != null;
    }

    /**
     * @param at the read timestamp
     * @return a copy marked read at the given instant (a no-op-equivalent copy if already read)
     */
    public DatabaseNotification markRead(Instant at) {
        return new DatabaseNotification(id, recipient, data, Objects.requireNonNull(at, "at"), createdAt);
    }

    /** @return a copy marked unread (clears {@link #readAt}) */
    public DatabaseNotification markUnread() {
        return new DatabaseNotification(id, recipient, data, null, createdAt);
    }
}
