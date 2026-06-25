/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.lang.reflect.Method;

/**
 * The authorization seam the dispatcher consults before invoking a {@link dev.lievit.LievitAction}
 * (issue #57). Pure Java, zero Spring (ADR-0007): the core knows only "ask before you invoke"; the
 * starter binds a Spring-Security-backed implementation that evaluates {@link dev.lievit.LievitAuthorize}
 * and {@code @PreAuthorize}/{@code @PostAuthorize} SpEL against the current authentication.
 *
 * <p>The dispatcher calls {@link #authorize} immediately before {@code @LievitAction} dispatch and
 * before a matched {@code @LievitOn} event listener runs, on every wire call (never cached from
 * mount). A {@code false} verdict is fail-closed: the dispatcher raises a
 * {@link dev.lievit.wire.WireError#FORBIDDEN_ACTION} and the action body never executes.
 *
 * <p><strong>Default posture is permissive.</strong> {@link #permitAll()} (the dispatcher's default
 * when no authorizer is wired) allows everything, so a component with no authorization annotation
 * behaves exactly as before this seam existed. Authorization is enforced only where the host wires a
 * real authorizer AND the action carries an annotation; an un-annotated action always passes. This
 * keeps the seam backward-compatible: adding it to the classpath changes no existing behavior.
 */
@FunctionalInterface
public interface ActionAuthorizer {

    /**
     * Decides whether the current principal may invoke {@code action} on {@code component}.
     *
     * @param component the rehydrated component instance the action will run on (the SpEL root, so an
     *     expression may authorize against the component's own {@code @Wire} state)
     * @param action the {@code @LievitAction} (or {@code @LievitOn} listener) method about to run; it
     *     carries any {@link dev.lievit.LievitAuthorize} / {@code @PreAuthorize} annotations
     * @return {@code true} to allow the invocation, {@code false} to deny it (fail-closed)
     */
    boolean authorize(Object component, Method action);

    /**
     * @return an authorizer that permits every invocation: the dispatcher default and the backward-
     *     compatible posture (no annotation, no authorizer wired, current allow-behavior holds)
     */
    static ActionAuthorizer permitAll() {
        return (component, action) -> true;
    }
}
