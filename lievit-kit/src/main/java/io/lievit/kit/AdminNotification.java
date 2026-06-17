/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import io.lievit.component.LievitEffects;

/**
 * A flash notification an {@link AdminAction} raises on success (the Filament
 * {@code Notification::make()->success()} parity), expressed on the lievit
 * {@link LievitEffects#dispatch effects substrate}: it rides the {@code Lievit-Effects} header as a
 * {@code lievit-admin-notify} browser event the admin layout's client listener renders as a toast.
 *
 * <p>Using {@code dispatch} (not new wire surface) keeps the kit on the existing substrate: the
 * notification survives the redirect because the client receives the event before it follows the
 * redirect effect (Livewire's flash-then-redirect ordering).
 *
 * @param level the severity (drives the toast styling on the client)
 * @param message the human message to show
 */
public record AdminNotification(Level level, String message) {

    /** The standard notification severities (named, so the client styles them deterministically). */
    public enum Level {
        /** A successful operation (create / edit saved, record deleted). */
        SUCCESS,
        /** A non-fatal warning. */
        WARNING,
        /** A failure the user must see. */
        DANGER
    }

    /** The browser event name the client listens on to render the toast. */
    public static final String EVENT = "lievit-admin-notify";

    /** Compact constructor: both components are required. */
    public AdminNotification {
        Objects.requireNonNull(level, "level");
        Objects.requireNonNull(message, "message");
    }

    /**
     * @param message the success message
     * @return a success-level notification
     */
    public static AdminNotification success(String message) {
        return new AdminNotification(Level.SUCCESS, message);
    }

    /**
     * @param message the danger message
     * @return a danger-level notification
     */
    public static AdminNotification danger(String message) {
        return new AdminNotification(Level.DANGER, message);
    }

    /**
     * Queues this notification onto the given effects sink as a {@link #EVENT} dispatch.
     *
     * @param effects the per-call effects sink (from {@link LievitEffects#current()} in a wire call)
     */
    public void flashOnto(LievitEffects effects) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("level", level.name().toLowerCase(java.util.Locale.ROOT));
        detail.put("message", message);
        effects.dispatch(EVENT, detail);
    }
}
