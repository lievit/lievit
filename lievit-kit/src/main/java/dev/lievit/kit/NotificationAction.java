/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * An action button carried inside a notification (the Filament notifications {@code HasActions} +
 * the JS {@code Action} class): an "Undo", "View record" or "Retry" affordance rendered as a small
 * link/button inside a toast or a persistent notification. Distinct from {@link AdminAction} (a
 * server operation): a notification action is a lightweight client directive (open a url, close the
 * toast, dispatch an event), so it serializes fully into the notification {@code data} and rides the
 * flash event or the {@link DatabaseNotification} row unchanged.
 *
 * <p>Immutable; build with {@link #make(String, String)} and the {@code with}-style methods, then
 * read {@link #toMap()} (the kit folds it into {@link AdminNotification#toMap()}).
 */
public final class NotificationAction {

    private final String name;
    private final String label;
    private final @Nullable String color;
    private final @Nullable String icon;
    private final @Nullable String url;
    private final boolean openUrlInNewTab;
    private final boolean closesNotification;
    private final @Nullable String dispatch;

    private NotificationAction(
            String name,
            String label,
            @Nullable String color,
            @Nullable String icon,
            @Nullable String url,
            boolean openUrlInNewTab,
            boolean closesNotification,
            @Nullable String dispatch) {
        this.name = Objects.requireNonNull(name, "name");
        this.label = Objects.requireNonNull(label, "label");
        this.color = color;
        this.icon = icon;
        this.url = url;
        this.openUrlInNewTab = openUrlInNewTab;
        this.closesNotification = closesNotification;
        this.dispatch = dispatch;
    }

    /**
     * @param name the stable action name
     * @param label the button label
     * @return a notification action rendered as a link by default
     */
    public static NotificationAction make(String name, String label) {
        return new NotificationAction(name, label, null, null, null, false, false, null);
    }

    /**
     * @param colorName the semantic colour
     * @return a copy with the colour set
     */
    public NotificationAction color(String colorName) {
        return new NotificationAction(
                name, label, colorName, icon, url, openUrlInNewTab, closesNotification, dispatch);
    }

    /**
     * @param iconName the icon name
     * @return a copy with the icon set
     */
    public NotificationAction icon(String iconName) {
        return new NotificationAction(
                name, label, color, iconName, url, openUrlInNewTab, closesNotification, dispatch);
    }

    /**
     * Sets the link target opened in the same tab.
     *
     * @param target the url
     * @return a copy with the url set
     */
    public NotificationAction url(String target) {
        return url(target, false);
    }

    /**
     * Sets the link target.
     *
     * @param target the url
     * @param newTab whether to open it in a new tab
     * @return a copy with the url set
     */
    public NotificationAction url(String target, boolean newTab) {
        return new NotificationAction(
                name, label, color, icon, Objects.requireNonNull(target, "target"), newTab,
                closesNotification, dispatch);
    }

    /**
     * Dismisses the notification when the action is clicked (the JS {@code close()}).
     *
     * @return a copy that closes the notification on click
     */
    public NotificationAction close() {
        return new NotificationAction(
                name, label, color, icon, url, openUrlInNewTab, true, dispatch);
    }

    /**
     * Emits a browser event when the action is clicked (the JS {@code dispatch}).
     *
     * @param event the event name to dispatch
     * @return a copy that dispatches the event on click
     */
    public NotificationAction dispatch(String event) {
        return new NotificationAction(
                name, label, color, icon, url, openUrlInNewTab, closesNotification,
                Objects.requireNonNull(event, "event"));
    }

    /** @return the stable action name */
    public String name() {
        return name;
    }

    /** @return the button label */
    public String label() {
        return label;
    }

    /** @return the colour, or {@code null} */
    public @Nullable String color() {
        return color;
    }

    /** @return the icon, or {@code null} */
    public @Nullable String icon() {
        return icon;
    }

    /** @return the link url, or {@code null} */
    public @Nullable String url() {
        return url;
    }

    /** @return whether the url opens in a new tab */
    public boolean opensUrlInNewTab() {
        return openUrlInNewTab;
    }

    /** @return whether clicking the action dismisses the notification */
    public boolean closesNotification() {
        return closesNotification;
    }

    /** @return the dispatched event name, or {@code null} */
    public @Nullable String dispatch() {
        return dispatch;
    }

    /**
     * @return the serialized shape (folded into the notification {@code data} so the client renders
     *     and wires the button identically for a flash and a persisted notification)
     */
    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("label", label);
        if (color != null) {
            m.put("color", color);
        }
        if (icon != null) {
            m.put("icon", icon);
        }
        if (url != null) {
            m.put("url", url);
            m.put("openUrlInNewTab", openUrlInNewTab);
        }
        if (closesNotification) {
            m.put("close", true);
        }
        if (dispatch != null) {
            m.put("dispatch", dispatch);
        }
        return m;
    }
}
