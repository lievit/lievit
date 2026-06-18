/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Specifies notification actions (the Filament notifications {@code HasActions} + the JS
 * {@code Action}): a notification carries action buttons with label/color/icon, a url (optionally
 * new-tab), a close-on-click flag and a dispatch event, and those actions serialize into the
 * notification {@code data} so they survive both a flash and a {@link DatabaseNotification}.
 */
class NotificationActionTest {

    /**
     * @spec.given a notification carrying a "View" link action and an "Undo" close+dispatch action
     * @spec.when  the actions are read back
     * @spec.then  the notification carries both in render order
     */
    @Test
    void a_notification_carries_action_buttons() {
        AdminNotification n =
                AdminNotification.success("Saved")
                        .actions(
                                NotificationAction.make("view", "View").url("/admin/posts/1"),
                                NotificationAction.make("undo", "Undo").close().dispatch("undo-save"));

        assertThat(n.actions()).extracting(NotificationAction::name).containsExactly("view", "undo");
    }

    /**
     * @spec.given a notification action with a new-tab url, a close flag and a dispatch
     * @spec.when  it is serialized to its map
     * @spec.then  the url/new-tab, close and dispatch keys are present
     */
    @Test
    void an_action_serializes_url_close_and_dispatch() {
        Map<String, Object> map =
                NotificationAction.make("open", "Open")
                        .url("https://example.test", true)
                        .close()
                        .dispatch("opened")
                        .color("primary")
                        .toMap();

        assertThat(map)
                .containsEntry("label", "Open")
                .containsEntry("url", "https://example.test")
                .containsEntry("openUrlInNewTab", true)
                .containsEntry("close", true)
                .containsEntry("dispatch", "opened")
                .containsEntry("color", "primary");
    }

    /**
     * @spec.given a notification with one action
     * @spec.when  the notification is serialized (the shape that flashes and persists)
     * @spec.then  the actions ride the notification data as a list of action maps
     */
    @Test
    void actions_ride_the_notification_data() {
        AdminNotification n =
                AdminNotification.info("Report ready")
                        .actions(NotificationAction.make("download", "Download").url("/report.csv"));

        Map<String, Object> data = n.toMap();

        assertThat(data).containsKey("actions");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> actions = (List<Map<String, Object>>) data.get("actions");
        assertThat(actions).hasSize(1);
        assertThat(actions.get(0)).containsEntry("label", "Download").containsEntry("url", "/report.csv");
    }

    /**
     * @spec.given a notification with actions
     * @spec.when  it is persisted to a database notification
     * @spec.then  the stored data carries the actions (they survive persistence)
     */
    @Test
    void actions_survive_persistence_to_the_database() {
        InMemoryDatabaseNotificationStore store = new InMemoryDatabaseNotificationStore();
        DatabaseNotification saved =
                AdminNotification.warning("Retry?")
                        .actions(NotificationAction.make("retry", "Retry").dispatch("retry-job"))
                        .sendToDatabase(store, "u1");

        assertThat(saved.data()).containsKey("actions");
    }

    /**
     * @spec.given a notification with no actions
     * @spec.when  it is serialized
     * @spec.then  no actions key is emitted (kept lean for the common case)
     */
    @Test
    void a_notification_without_actions_omits_the_key() {
        assertThat(AdminNotification.info("plain").toMap()).doesNotContainKey("actions");
    }
}
