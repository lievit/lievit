/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The default {@link DatabaseNotificationStore}: an in-memory, thread-safe store for tests and small
 * single-instance deployments (a production deployment swaps in a JDBC-backed one). It keeps the
 * recipient scoping invariant of the port: every read and mutation filters by recipient, so one
 * user can never see or change another's notifications.
 */
public final class InMemoryDatabaseNotificationStore implements DatabaseNotificationStore {

    private final Map<String, DatabaseNotification> byId = new ConcurrentHashMap<>();
    private final Clock clock;

    /** Builds a store on the system clock. */
    public InMemoryDatabaseNotificationStore() {
        this(Clock.systemUTC());
    }

    /**
     * Builds a store on a given clock (a fixed clock makes the timestamps deterministic in tests).
     *
     * @param clock the clock the timestamps read
     */
    public InMemoryDatabaseNotificationStore(Clock clock) {
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @Override
    public DatabaseNotification send(String recipient, AdminNotification notification) {
        Objects.requireNonNull(recipient, "recipient");
        Map<String, Object> data = notification.toMap();
        DatabaseNotification stored =
                new DatabaseNotification(
                        UUID.randomUUID().toString(), recipient, data, null, clock.instant());
        byId.put(stored.id(), stored);
        return stored;
    }

    @Override
    public List<DatabaseNotification> list(String recipient, int offset, int limit) {
        int safeOffset = Math.max(0, offset);
        int safeLimit = Math.max(1, limit);
        List<DatabaseNotification> mine =
                byId.values().stream()
                        .filter(n -> n.recipient().equals(recipient))
                        .sorted(Comparator.comparing(DatabaseNotification::createdAt).reversed())
                        .toList();
        if (safeOffset >= mine.size()) {
            return List.of();
        }
        return new ArrayList<>(mine.subList(safeOffset, Math.min(safeOffset + safeLimit, mine.size())));
    }

    @Override
    public long unreadCount(String recipient) {
        return byId.values().stream()
                .filter(n -> n.recipient().equals(recipient))
                .filter(DatabaseNotification::isUnread)
                .count();
    }

    @Override
    public void markRead(String recipient, String id) {
        mutate(recipient, id, n -> n.markRead(clock.instant()));
    }

    @Override
    public void markUnread(String recipient, String id) {
        mutate(recipient, id, DatabaseNotification::markUnread);
    }

    @Override
    public void markAllRead(String recipient) {
        byId.replaceAll(
                (id, n) ->
                        n.recipient().equals(recipient) && n.isUnread()
                                ? n.markRead(clock.instant())
                                : n);
    }

    @Override
    public void delete(String recipient, String id) {
        DatabaseNotification n = byId.get(id);
        if (n != null && n.recipient().equals(recipient)) {
            byId.remove(id);
        }
    }

    @Override
    public void clearAll(String recipient) {
        byId.values().removeIf(n -> n.recipient().equals(recipient));
    }

    private void mutate(
            String recipient,
            String id,
            java.util.function.UnaryOperator<DatabaseNotification> op) {
        byId.computeIfPresent(
                id, (k, n) -> n.recipient().equals(recipient) ? op.apply(n) : n);
    }
}
