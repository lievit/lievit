/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.component.LievitEffects;

/**
 * Specifies the rich notification model (the Filament {@code Notification} content shape): a title +
 * body split, status→default icon/iconColor pure functions, duration/persistent, an added info
 * level, and the serialized event shape it flashes onto the effects substrate.
 */
class AdminNotificationTest {

    /**
     * @spec.given a success notification with a body, duration and position
     * @spec.when  it is serialized to the event detail
     * @spec.then  the map carries title, body, icon, iconColor, duration, persistent and position
     */
    @Test
    void serializes_the_full_content_shape() {
        Map<String, Object> detail =
                AdminNotification.success("Saved")
                        .body("The record was saved.")
                        .seconds(3)
                        .position("bottom-center")
                        .toMap();

        assertThat(detail.get("level")).isEqualTo("success");
        assertThat(detail.get("title")).isEqualTo("Saved");
        assertThat(detail.get("body")).isEqualTo("The record was saved.");
        assertThat(detail.get("icon")).isEqualTo("heroicon-o-check-circle");
        assertThat(detail.get("iconColor")).isEqualTo("success");
        assertThat(detail.get("duration")).isEqualTo(3000);
        assertThat(detail.get("persistent")).isEqualTo(false);
        assertThat(detail.get("position")).isEqualTo("bottom-center");
    }

    /**
     * @spec.given each notification level
     * @spec.when  its default icon and icon colour are read
     * @spec.then  they match Filament's status defaults
     */
    @Test
    void defaults_icon_and_color_from_the_level() {
        assertThat(AdminNotification.defaultIcon(AdminNotification.Level.DANGER))
                .isEqualTo("heroicon-o-x-circle");
        assertThat(AdminNotification.defaultIconColor(AdminNotification.Level.WARNING))
                .isEqualTo("warning");
        assertThat(AdminNotification.info("Heads up").icon())
                .isEqualTo("heroicon-o-information-circle");
    }

    /**
     * @spec.given a danger notification marked persistent
     * @spec.when  its flags are read
     * @spec.then  it is persistent (the toast does not auto-close)
     */
    @Test
    void a_persistent_notification_does_not_auto_close() {
        AdminNotification n = AdminNotification.danger("Failed").persistent();

        assertThat(n.isPersistent()).isTrue();
        assertThat(n.toMap().get("persistent")).isEqualTo(true);
    }

    /**
     * @spec.given a capturing effects sink
     * @spec.when  a notification is flashed onto it
     * @spec.then  the event is dispatched under the admin-notify event name with the detail
     */
    @Test
    void flashes_onto_the_effects_substrate() {
        LievitEffects effects = LievitEffects.capturing();

        AdminNotification.success("Done").flashOnto(effects);

        assertThat(effects.dispatched()).hasSize(1);
        assertThat(effects.dispatched().get(0).name()).isEqualTo(AdminNotification.EVENT);
    }
}
