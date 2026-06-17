/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * One event an action queued for the client, the unit of the {@code dispatch} effect (ADR-0012,
 * Livewire {@code dispatch()} parity). The client re-emits each as a DOM {@code CustomEvent} on
 * {@code window}, the cross-component message bus.
 *
 * @param name the event name (the {@code CustomEvent} type the client dispatches)
 * @param detail the event payload, JSON-shaped, carried as the {@code CustomEvent.detail}; may be
 *     {@code null} for a bare signal event
 */
public record DispatchedEvent(String name, @Nullable Map<String, Object> detail) {

    /**
     * @param name the event name (must be non-null)
     */
    public DispatchedEvent {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("a dispatched event needs a non-blank name");
        }
    }
}
