/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

import dev.lievit.kit.AdminNotification;
import dev.lievit.kit.NotificationAction;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * The render-time bundle the kit toast template ({@code kit/notification/toast.jte}) reads: a flashed
 * {@link AdminNotification} PLUS the one render-only fact the pure notification model deliberately does
 * not carry, the mapping of the model's {@link AdminNotification.Level} onto the lievit-ui
 * {@code toast} partial's {@code variant} token.
 *
 * <p>The split mirrors {@link KitTableView}: {@link AdminNotification} stays a pure, UI-agnostic
 * content model (a {@code Level} the client styles deterministically, a serializable
 * {@link AdminNotification#toMap() detail}), while this view gives the template ONE typed object that
 * already speaks the toast partial's vocabulary. The level→variant map is the lievit-ui contract: the
 * toast derives its severity colour, its live-region role (assertive {@code alert} vs polite
 * {@code status}) and its leading glyph from that variant, so the heroicon-style
 * {@link AdminNotification#icon()} is intentionally NOT forwarded (it is not in the lievit Lucide
 * set); the variant carries the icon decision.
 *
 * @param notification the flashed notification (title / body / level / duration / persistent /
 *     position / actions)
 */
public record KitToastView(AdminNotification notification) {

    /** Compact constructor: defends the notification. */
    public KitToastView {
        Objects.requireNonNull(notification, "notification");
    }

    /**
     * @param notification the flashed notification
     * @return the render bundle
     */
    public static KitToastView of(AdminNotification notification) {
        return new KitToastView(notification);
    }

    /**
     * The lievit-ui {@code toast} variant for the notification's level (the level→variant map). Each
     * {@link AdminNotification.Level} maps to the matching lowercase sonner severity the toast partial
     * understands ({@code success} | {@code info} | {@code warning} | {@code danger}).
     *
     * @return the toast variant token
     */
    public String variant() {
        return notification.level().name().toLowerCase(Locale.ROOT);
    }

    /** @return the notification title (the toast heading) */
    public String title() {
        return notification.title();
    }

    /** @return the notification body, or empty when none */
    public String body() {
        String body = notification.body();
        return body == null ? "" : body;
    }

    /** @return whether the notification carries a body line */
    public boolean hasBody() {
        return notification.body() != null && !notification.body().isBlank();
    }

    /** @return whether the toast is persistent (no auto-dismiss; the template renders duration 0) */
    public boolean isPersistent() {
        return notification.isPersistent();
    }

    /** @return the auto-dismiss duration in milliseconds (the toast enhancer timer) */
    public int duration() {
        return notification.duration();
    }

    /** @return the toast corner position (one of the six sonner corners) */
    public String position() {
        return notification.position();
    }

    /** @return the notification's action affordances, in render order (empty if none) */
    public List<NotificationAction> actions() {
        return notification.actions();
    }

    /** @return whether the notification carries any action affordance */
    public boolean hasActions() {
        return !notification.actions().isEmpty();
    }
}
