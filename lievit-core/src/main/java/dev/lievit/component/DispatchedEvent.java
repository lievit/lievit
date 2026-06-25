/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * One event an action queued for the client, the unit of the {@code dispatch} effect (ADR-0012,
 * ADR-0030, Livewire {@code dispatch()} / {@code dispatchTo()} / {@code dispatchSelf()} parity). The
 * client re-emits it as a DOM {@code CustomEvent} on {@code window} (the cross-component bus) and
 * routes it to the targeted listeners.
 *
 * <p>{@code target} expresses where the client routes the event (the server decides, the client
 * delivers):
 *
 * <ul>
 *   <li>{@link Target#GLOBAL} (the default, {@code dispatch}) — every component listening for the
 *       name receives it.
 *   <li>{@link Target#SELF} ({@code dispatchSelf}) — only the dispatching component's own listeners.
 *   <li>{@link Target#TO_COMPONENT} ({@code dispatchTo}) — only components of the named type;
 *       {@code targetName} is the component name.
 * </ul>
 *
 * @param name the event name (the {@code CustomEvent} type the client dispatches)
 * @param detail the event payload, JSON-shaped, carried as the {@code CustomEvent.detail}; may be
 *     {@code null} for a bare signal event
 * @param target the routing target (never {@code null}; defaults to {@link Target#GLOBAL})
 * @param targetName the target component name for {@link Target#TO_COMPONENT}, else {@code null}
 */
public record DispatchedEvent(
        String name,
        @Nullable Map<String, Object> detail,
        Target target,
        @Nullable String targetName) {

    /** Where the client routes a dispatched event (ADR-0030). */
    public enum Target {
        /** Every listening component (the {@code dispatch} default). */
        GLOBAL,
        /** Only the dispatching component's own listeners ({@code dispatchSelf}). */
        SELF,
        /** Only components of a named type ({@code dispatchTo}). */
        TO_COMPONENT
    }

    /**
     * @param name the event name (must be non-blank)
     */
    public DispatchedEvent {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("a dispatched event needs a non-blank name");
        }
        if (target == null) {
            target = Target.GLOBAL;
        }
        if (target == Target.TO_COMPONENT && (targetName == null || targetName.isBlank())) {
            throw new IllegalArgumentException("dispatchTo needs a target component name");
        }
    }

    /**
     * A global dispatch (the common case), keeping the original two-argument call sites intact.
     *
     * @param name the event name
     * @param detail the payload, or {@code null} for a bare signal
     */
    public DispatchedEvent(String name, @Nullable Map<String, Object> detail) {
        this(name, detail, Target.GLOBAL, null);
    }
}
