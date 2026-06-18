/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import io.lievit.spring.broadcast.BroadcastChannel;
import io.lievit.spring.broadcast.BroadcastEvent;

/**
 * Specifies live-push notifications (the Filament {@code BroadcastNotification} +
 * {@code DatabaseNotificationsSent}, issue #304): {@link BroadcastNotification} pushes a toast event
 * to a recipient's clients over the {@link BroadcastChannel} and a bell-refresh event targeted at the
 * bell component, and {@code sendAndBroadcast} persists the durable copy AND pushes the live one. The
 * toast rides the same {@code lievit-admin-notify} substrate as a flashed notification.
 */
class BroadcastNotificationTest {

    private static final Clock FIXED = Clock.fixed(Instant.parse("2026-06-18T10:00:00Z"), ZoneOffset.UTC);

    /** A fake channel that records every (recipient, event) it is pushed. */
    private static final class RecordingChannel implements BroadcastChannel {
        final List<String> recipients = new ArrayList<>();
        final List<BroadcastEvent> events = new ArrayList<>();

        @Override
        public void push(String recipient, BroadcastEvent event) {
            recipients.add(recipient);
            events.add(event);
        }

        @Override
        public int connectionCount(String recipient) {
            return 0;
        }
    }

    /**
     * @spec.given a broadcast channel and a notification
     * @spec.when  it is broadcast to a recipient
     * @spec.then  the recipient's channel receives a lievit-admin-notify toast event with the content
     */
    @Test
    void broadcast_pushes_a_live_toast_to_a_recipient() {
        RecordingChannel channel = new RecordingChannel();

        new BroadcastNotification(channel)
                .broadcast("u1", AdminNotification.success("Assigned to you").body("Task #42"));

        assertThat(channel.recipients).containsExactly("u1");
        BroadcastEvent event = channel.events.get(0);
        assertThat(event.name()).isEqualTo(AdminNotification.EVENT);
        assertThat(event.detail()).containsEntry("title", "Assigned to you").containsEntry("body", "Task #42");
        assertThat(event.to()).isNull(); // a global toast (the layout listener renders it)
    }

    /**
     * @spec.given a broadcast channel
     * @spec.when  a bell refresh is pushed to a recipient
     * @spec.then  the channel receives a refresh event targeted at the bell component only
     */
    @Test
    void refresh_bell_targets_the_bell_component() {
        RecordingChannel channel = new RecordingChannel();

        new BroadcastNotification(channel).refreshBell("u1");

        BroadcastEvent event = channel.events.get(0);
        assertThat(event.name()).isEqualTo(BroadcastNotification.BELL_REFRESH_EVENT);
        assertThat(event.to()).isEqualTo(BroadcastNotification.BELL_COMPONENT);
    }

    /**
     * @spec.given a notification store and a broadcast channel
     * @spec.when  sendAndBroadcast is called for a recipient
     * @spec.then  the notification is persisted (the durable copy) AND a live toast + bell refresh are
     *     pushed (the recipient sees it now if online, and on next bell load regardless)
     */
    @Test
    void send_and_broadcast_persists_and_pushes_live() {
        DatabaseNotificationStore store = new InMemoryDatabaseNotificationStore(FIXED);
        RecordingChannel channel = new RecordingChannel();

        DatabaseNotification saved =
                new BroadcastNotification(channel)
                        .sendAndBroadcast(store, "u1", AdminNotification.info("New lead"));

        // Durable copy persisted.
        assertThat(saved.recipient()).isEqualTo("u1");
        assertThat(store.unreadCount("u1")).isEqualTo(1);
        // Live: a toast then a bell refresh, both to u1.
        assertThat(channel.recipients).containsExactly("u1", "u1");
        assertThat(channel.events.get(0).name()).isEqualTo(AdminNotification.EVENT);
        assertThat(channel.events.get(1).name()).isEqualTo(BroadcastNotification.BELL_REFRESH_EVENT);
    }
}
