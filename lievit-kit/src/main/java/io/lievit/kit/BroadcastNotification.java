/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Collection;
import java.util.Objects;

import io.lievit.spring.broadcast.BroadcastChannel;
import io.lievit.spring.broadcast.BroadcastEvent;

/**
 * Live-push notifications (the Filament {@code BroadcastNotification} + {@code DatabaseNotificationsSent}
 * port, issue #304): pushes an {@link AdminNotification} to a recipient's connected clients in real
 * time over the {@link BroadcastChannel}, so a toast lands without a page load ("someone assigned you
 * a task now") and the persistent-notification {@link NotificationBell bell} live-refreshes instead of
 * waiting for its poll.
 *
 * <p>It rides the same substrate as a flashed notification: the toast is the {@link
 * AdminNotification#EVENT lievit-admin-notify} event (same {@link AdminNotification#toMap() detail}, so
 * a pushed toast renders identically to a flashed one), and the bell refresh is a
 * {@link #BELL_REFRESH_EVENT} event targeted at the {@code NotificationBell} component so only the bell
 * re-runs. The client receives both over the SSE channel and routes them exactly as wire-call
 * dispatched events (the echo bridge of #45).
 *
 * <p>Pairs with {@link AdminNotification#sendToDatabase}: persist the durable copy, then broadcast the
 * live one. {@link #sendAndBroadcast} does both in one call — the bell shows it on its next load even
 * for a recipient who was offline at the moment of the push (best-effort live, durable persist).
 */
public final class BroadcastNotification {

    /**
     * The event the bell listens on to live-refresh its badge + list (the {@code DatabaseNotificationsSent}
     * analogue). Targeted at the bell component so a refresh re-runs only the bell, not the whole page.
     */
    public static final String BELL_REFRESH_EVENT = "lievit-notifications-refresh";

    /** The component name the bell refresh is routed to (the kit's notification-bell component). */
    public static final String BELL_COMPONENT = "io.lievit.kit.NotificationBell";

    private final BroadcastChannel channel;

    /**
     * @param channel the live-push channel (the starter's SSE channel by default)
     */
    public BroadcastNotification(BroadcastChannel channel) {
        this.channel = Objects.requireNonNull(channel, "channel");
    }

    /**
     * Pushes a notification as a live toast to one recipient's connected clients (the Filament
     * {@code Notification::make()->broadcast($user)}). Best-effort: a recipient with no open
     * connection receives nothing live (use {@link #sendAndBroadcast} to also persist the durable copy).
     *
     * @param recipient the recipient user id
     * @param notification the notification to push
     */
    public void broadcast(String recipient, AdminNotification notification) {
        Objects.requireNonNull(notification, "notification");
        channel.push(
                Objects.requireNonNull(recipient, "recipient"),
                BroadcastEvent.of(AdminNotification.EVENT, notification.toMap()));
    }

    /**
     * Pushes a notification live to several recipients at once (a per-user channel each).
     *
     * @param recipients the recipient user ids
     * @param notification the notification to push
     */
    public void broadcast(Collection<String> recipients, AdminNotification notification) {
        Objects.requireNonNull(recipients, "recipients");
        for (String recipient : recipients) {
            broadcast(recipient, notification);
        }
    }

    /**
     * Pushes a bell-refresh signal to a recipient's clients: the bell re-runs its read (badge count +
     * list) without a poll wait. Use after persisting a notification to a recipient who has the bell
     * open. The event is targeted at the {@link #BELL_COMPONENT bell component} so only it refreshes.
     *
     * @param recipient the recipient user id
     */
    public void refreshBell(String recipient) {
        channel.push(
                Objects.requireNonNull(recipient, "recipient"),
                BroadcastEvent.to(BELL_COMPONENT, BELL_REFRESH_EVENT, null));
    }

    /**
     * Persists a notification to a recipient AND pushes it live (the durable + live combination): the
     * {@code sendToDatabase} for the bell's next load, the toast for the live moment, and a bell
     * refresh so an open bell reflects the new unread count at once. The recipient sees it now if a
     * client is open, and on next load regardless.
     *
     * @param store the notification store (the durable copy)
     * @param recipient the recipient user id
     * @param notification the notification to persist + push
     * @return the persisted notification
     */
    public DatabaseNotification sendAndBroadcast(
            DatabaseNotificationStore store, String recipient, AdminNotification notification) {
        Objects.requireNonNull(store, "store");
        DatabaseNotification persisted = store.send(recipient, notification);
        broadcast(recipient, notification);
        refreshBell(recipient);
        return persisted;
    }
}
