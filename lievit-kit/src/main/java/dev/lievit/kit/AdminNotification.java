/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import dev.lievit.component.LievitEffects;

/**
 * A notification an {@link AdminAction} raises (the Filament {@code Notification} content model),
 * expressed on the lievit {@link LievitEffects#dispatch effects substrate}: it rides the
 * {@code Lievit-Effects} header as a {@code lievit-admin-notify} browser event the admin layout's
 * client listener renders as a toast.
 *
 * <p>Beyond the original single message it carries Filament's full content shape: a separate
 * {@link #title()} and {@link #body()}, an {@link #icon()} and {@link #iconColor()} defaulted from
 * the {@link Level}, a {@link #color()}, a {@link #duration()} in milliseconds with a
 * {@link #isPersistent() persistent} skip-auto-close, and a toast {@link #position()}. The
 * status→default-icon and status→default-iconColor are pure functions (mirrored from Filament's
 * {@code HasIcon}/{@code HasIconColor}).
 *
 * <p>Immutable; build it with {@link #make(Level, String)} (or {@link #success}/{@link #info}/
 * {@link #warning}/{@link #danger}) and the {@code with*}-style methods, then
 * {@link #flashOnto(LievitEffects)}.
 */
public final class AdminNotification {

    /** The standard notification severities (named, so the client styles them deterministically). */
    public enum Level {
        /** A successful operation (create / edit saved, record deleted). */
        SUCCESS,
        /** An informational message. */
        INFO,
        /** A non-fatal warning. */
        WARNING,
        /** A failure the user must see. */
        DANGER
    }

    /** The browser event name the client listens on to render the toast. */
    public static final String EVENT = "lievit-admin-notify";

    /** The default auto-close duration in milliseconds (Filament's default). */
    public static final int DEFAULT_DURATION_MS = 6000;

    private final Level level;
    private final String title;
    private final @Nullable String body;
    private final @Nullable String icon;
    private final @Nullable String iconColor;
    private final @Nullable String color;
    private final int duration;
    private final boolean persistent;
    private final String position;
    private final List<NotificationAction> actions;

    private AdminNotification(
            Level level,
            String title,
            @Nullable String body,
            @Nullable String icon,
            @Nullable String iconColor,
            @Nullable String color,
            int duration,
            boolean persistent,
            String position) {
        this(level, title, body, icon, iconColor, color, duration, persistent, position, List.of());
    }

    private AdminNotification(
            Level level,
            String title,
            @Nullable String body,
            @Nullable String icon,
            @Nullable String iconColor,
            @Nullable String color,
            int duration,
            boolean persistent,
            String position,
            List<NotificationAction> actions) {
        this.level = Objects.requireNonNull(level, "level");
        this.title = Objects.requireNonNull(title, "title");
        this.body = body;
        this.icon = icon;
        this.iconColor = iconColor;
        this.color = color;
        this.duration = duration;
        this.persistent = persistent;
        this.position = position;
        this.actions = List.copyOf(actions);
    }

    /**
     * @param level the severity
     * @param title the title
     * @return a notification at the given level with default icon/iconColor/duration/position
     */
    public static AdminNotification make(Level level, String title) {
        return new AdminNotification(
                level, title, null, null, null, null, DEFAULT_DURATION_MS, false, "top-right");
    }

    /**
     * @param title the success title
     * @return a success-level notification
     */
    public static AdminNotification success(String title) {
        return make(Level.SUCCESS, title);
    }

    /**
     * @param title the info title
     * @return an info-level notification
     */
    public static AdminNotification info(String title) {
        return make(Level.INFO, title);
    }

    /**
     * @param title the warning title
     * @return a warning-level notification
     */
    public static AdminNotification warning(String title) {
        return make(Level.WARNING, title);
    }

    /**
     * @param title the danger title
     * @return a danger-level notification
     */
    public static AdminNotification danger(String title) {
        return make(Level.DANGER, title);
    }

    /**
     * @param text the body text
     * @return a copy with the body set
     */
    public AdminNotification body(String text) {
        return copy(level, title, text, icon, iconColor, color, duration, persistent, position);
    }

    /**
     * @param iconName the icon name
     * @return a copy with the icon overridden
     */
    public AdminNotification icon(String iconName) {
        return copy(level, title, body, iconName, iconColor, color, duration, persistent, position);
    }

    /**
     * @param colorName the icon colour name
     * @return a copy with the icon colour overridden
     */
    public AdminNotification iconColor(String colorName) {
        return copy(level, title, body, icon, colorName, color, duration, persistent, position);
    }

    /**
     * @param colorName the notification colour name
     * @return a copy with the colour set
     */
    public AdminNotification color(String colorName) {
        return copy(level, title, body, icon, iconColor, colorName, duration, persistent, position);
    }

    /**
     * @param ms the auto-close duration in milliseconds
     * @return a copy with the duration set (and persistent cleared)
     */
    public AdminNotification duration(int ms) {
        return copy(level, title, body, icon, iconColor, color, Math.max(0, ms), false, position);
    }

    /**
     * @param secs the auto-close duration in seconds
     * @return a copy with the duration set
     */
    public AdminNotification seconds(int secs) {
        return duration(secs * 1000);
    }

    /**
     * Makes the toast persistent (it does not auto-close; the user dismisses it).
     *
     * @return a copy marked persistent
     */
    public AdminNotification persistent() {
        return copy(level, title, body, icon, iconColor, color, duration, true, position);
    }

    /**
     * @param pos the toast position (e.g. {@code "top-right"}, {@code "bottom-center"})
     * @return a copy with the position set
     */
    public AdminNotification position(String pos) {
        return copy(level, title, body, icon, iconColor, color, duration, persistent, pos);
    }

    /**
     * Attaches action buttons to the notification (the Filament notifications {@code ->actions([...])}):
     * "Undo", "View record", "Retry" affordances rendered inside the toast / persistent notification.
     * The actions serialize into {@link #toMap()} so they survive a flash and a {@link #sendToDatabase}.
     *
     * @param notificationActions the actions, in render order
     * @return a copy carrying the actions
     */
    public AdminNotification actions(NotificationAction... notificationActions) {
        List<NotificationAction> list = new ArrayList<>(notificationActions.length);
        for (NotificationAction a : notificationActions) {
            list.add(Objects.requireNonNull(a, "action"));
        }
        return new AdminNotification(
                level, title, body, icon, iconColor, color, duration, persistent, position, list);
    }

    /** @return the attached actions, in render order (empty if none) */
    public List<NotificationAction> actions() {
        return actions;
    }

    /**
     * Persists this notification to a recipient through a {@link DatabaseNotificationStore} (the
     * Filament {@code ->sendToDatabase($user)}): the durable counterpart of {@link #flashOnto}. The
     * stored {@code data} is {@link #toMap()}, so the bell renders it identically to a flashed toast.
     *
     * @param store the notification store
     * @param recipient the recipient user id
     * @return the persisted notification
     */
    public DatabaseNotification sendToDatabase(DatabaseNotificationStore store, String recipient) {
        return Objects.requireNonNull(store, "store").send(recipient, this);
    }

    /** @return the severity */
    public Level level() {
        return level;
    }

    /** @return the title */
    public String title() {
        return title;
    }

    /** @return the body, or {@code null} */
    public @Nullable String body() {
        return body;
    }

    /** @return the icon name (the level default when not overridden) */
    public String icon() {
        return icon != null ? icon : defaultIcon(level);
    }

    /** @return the icon colour name (the level default when not overridden) */
    public String iconColor() {
        return iconColor != null ? iconColor : defaultIconColor(level);
    }

    /** @return the explicit colour, or {@code null} */
    public @Nullable String color() {
        return color;
    }

    /** @return the auto-close duration in milliseconds */
    public int duration() {
        return duration;
    }

    /** @return whether the toast is persistent (no auto-close) */
    public boolean isPersistent() {
        return persistent;
    }

    /** @return the toast position */
    public String position() {
        return position;
    }

    /**
     * The default icon for a level (mirror of Filament's {@code HasIcon} status defaults).
     *
     * @param level the severity
     * @return the default icon name
     */
    public static String defaultIcon(Level level) {
        return switch (level) {
            case SUCCESS -> "heroicon-o-check-circle";
            case INFO -> "heroicon-o-information-circle";
            case WARNING -> "heroicon-o-exclamation-triangle";
            case DANGER -> "heroicon-o-x-circle";
        };
    }

    /**
     * The default icon colour for a level (mirror of Filament's {@code HasIconColor} status
     * defaults).
     *
     * @param level the severity
     * @return the default semantic colour name
     */
    public static String defaultIconColor(Level level) {
        return switch (level) {
            case SUCCESS -> "success";
            case INFO -> "info";
            case WARNING -> "warning";
            case DANGER -> "danger";
        };
    }

    /**
     * The serialized shape of the notification (the {@code detail} of the browser event), the keys
     * the client toast reads.
     *
     * @return an ordered map of the notification fields
     */
    public Map<String, Object> toMap() {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("level", level.name().toLowerCase(Locale.ROOT));
        detail.put("title", title);
        if (body != null) {
            detail.put("body", body);
        }
        detail.put("icon", icon());
        detail.put("iconColor", iconColor());
        if (color != null) {
            detail.put("color", color);
        }
        detail.put("duration", duration);
        detail.put("persistent", persistent);
        detail.put("position", position);
        if (!actions.isEmpty()) {
            detail.put(
                    "actions",
                    actions.stream().map(NotificationAction::toMap).collect(java.util.stream.Collectors.toList()));
        }
        return detail;
    }

    /**
     * Queues this notification onto the given effects sink as a {@link #EVENT} dispatch.
     *
     * @param effects the per-call effects sink (from {@link LievitEffects#current()} in a wire call)
     */
    public void flashOnto(LievitEffects effects) {
        effects.dispatch(EVENT, toMap());
    }

    private AdminNotification copy(
            Level level,
            String title,
            @Nullable String body,
            @Nullable String icon,
            @Nullable String iconColor,
            @Nullable String color,
            int duration,
            boolean persistent,
            String position) {
        return new AdminNotification(
                level, title, body, icon, iconColor, color, duration, persistent, position, actions);
    }
}
