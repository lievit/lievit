/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * The per-call effects sink: the server-side, request-scoped collector of side effects an
 * {@code @LievitAction} produces (ADR-0012). An action reads the sink for the current call via
 * {@link #current()} and queues a redirect, an event dispatch, or lets its return value be captured
 * as the {@code returns} effect. The sink is serialized into the {@code Lievit-Effects} response
 * header by the web layer.
 *
 * <p>Real-time validation also writes here (via {@link #setValidationErrors}), set by the
 * dispatcher when the {@link FieldValidator} finds constraint violations: the {@code errors} effect
 * carries per-field messages to the client. Actions are skipped when validation fails; the client
 * renders the errors inline, without a full submit.
 *
 * <p>Lifecycle invariant (ADR-0001 statelessness): the sink is bound to the {@link
 * io.lievit.component.WireDispatcher} call via a {@link ThreadLocal} and reset for every
 * call. Nothing survives between calls; an action on a fresh instance starts with an empty sink.
 * Reading {@link #current()} outside a wire call is a programming error (no sink is bound).
 *
 * <p>This is a runtime API, not an annotation: it keeps the public surface at seven annotations
 * (ADR-0002) while giving components the Livewire {@code $this->redirect()} / {@code $this->dispatch()}
 * ergonomics.
 */
public final class LievitEffects {

    private static final ThreadLocal<LievitEffects> CURRENT = new ThreadLocal<>();

    private @Nullable String redirect;
    private final List<DispatchedEvent> dispatched = new ArrayList<>();
    private @Nullable Object returnValue;
    /** Null means "validation did not run or produced no errors": the {@code errors} key is omitted. */
    private @Nullable Map<String, List<String>> validationErrors;
    private @Nullable UrlEffect url;

    LievitEffects() {}

    /**
     * Creates a standalone, capturing effects sink, off the wire. The dispatcher binds its own sink
     * during a wire call (see {@link #current()}); this factory lets server-side code (e.g. the
     * admin kit's action testing helpers) build an action context and assert over the queued
     * {@link #redirect()} / {@link #dispatched()} effects without booting the wire.
     *
     * @return a fresh, unbound effects sink that captures the effects queued onto it
     */
    public static LievitEffects capturing() {
        return new LievitEffects();
    }

    /**
     * Returns the effects sink for the current wire call.
     *
     * @return the bound sink
     * @throws IllegalStateException if called outside a wire call (no sink is bound)
     */
    public static LievitEffects current() {
        LievitEffects effects = CURRENT.get();
        if (effects == null) {
            throw new IllegalStateException(
                    "LievitEffects.current() called outside a wire call: no effects sink is bound");
        }
        return effects;
    }

    /** Binds {@code effects} as the sink for the current thread (called by the dispatcher). */
    static void bind(LievitEffects effects) {
        CURRENT.set(effects);
    }

    /** Clears the bound sink for the current thread (called by the dispatcher in a finally). */
    static void clear() {
        CURRENT.remove();
    }

    /**
     * Queues a navigation as the {@code redirect} effect. The last call wins (a redirect is
     * terminal; an action that sets two has the second take effect, matching Livewire).
     *
     * @param location the URL or path to navigate to (must be non-blank)
     */
    public void redirect(String location) {
        if (location == null || location.isBlank()) {
            throw new IllegalArgumentException("redirect location must be non-blank");
        }
        this.redirect = location;
    }

    /**
     * Queues a browser event as part of the {@code dispatch} effect (the {@code CustomEvent} bus,
     * ADR-0012). May be called more than once; events are emitted in order.
     *
     * @param name the event name
     * @param detail the event payload (JSON-shaped); may be {@code null} for a bare signal
     */
    public void dispatch(String name, @Nullable Map<String, Object> detail) {
        dispatched.add(new DispatchedEvent(name, detail));
    }

    /**
     * Queues a bare browser event (no detail) as part of the {@code dispatch} effect.
     *
     * @param name the event name
     */
    public void dispatch(String name) {
        dispatch(name, null);
    }

    /**
     * Queues an event targeted only at the dispatching component's own listeners (Livewire
     * {@code dispatchSelf()}, ADR-0030). The client routes it to this component only.
     *
     * @param name the event name
     * @param detail the payload (JSON-shaped), or {@code null} for a bare signal
     */
    public void dispatchSelf(String name, @Nullable Map<String, Object> detail) {
        dispatched.add(new DispatchedEvent(name, detail, DispatchedEvent.Target.SELF, null));
    }

    /**
     * Queues an event targeted only at components of a named type (Livewire {@code dispatchTo()},
     * ADR-0030). The client routes it to every mounted component of that name.
     *
     * @param component the target component name
     * @param name the event name
     * @param detail the payload (JSON-shaped), or {@code null} for a bare signal
     */
    public void dispatchTo(String component, String name, @Nullable Map<String, Object> detail) {
        dispatched.add(
                new DispatchedEvent(name, detail, DispatchedEvent.Target.TO_COMPONENT, component));
    }

    /** Captures an action's return value as the {@code returns} effect (set by the dispatcher). */
    void captureReturn(@Nullable Object value) {
        if (value != null) {
            this.returnValue = value;
        }
    }

    /**
     * Records the per-field validation errors produced by the {@link FieldValidator}. Called by
     * the {@link WireDispatcher} when the validator returns a non-empty map; not called when
     * validation passes (so {@link #validationErrors()} stays {@code null} and the {@code errors}
     * key is omitted from the effects bag).
     *
     * <p>Only validation messages are surfaced: no internal class names, stack traces, or payload
     * content ever reach the client (ADR-0014 fail-closed posture).
     *
     * @param errors the field → messages map from the validator (must be non-null, non-empty)
     */
    void setValidationErrors(Map<String, List<String>> errors) {
        this.validationErrors = Map.copyOf(errors);
    }

    /**
     * Sets the {@code url} effect: the query string to reflect into the browser address bar (the
     * {@code @LievitUrl} feature, ADR-0012). Set by the dispatcher after a call when the component
     * has URL-bound fields; not part of the component author's API (a component declares
     * {@code @LievitUrl} on a field, it does not call this).
     *
     * @param urlEffect the query string + history mode the client must push/replace, or {@code null}
     *     to clear (no URL effect)
     */
    void url(@Nullable UrlEffect urlEffect) {
        this.url = urlEffect;
    }

    /**
     * @return the queued redirect location, or {@code null} if no redirect was requested
     */
    public @Nullable String redirect() {
        return redirect;
    }

    /**
     * @return the queued dispatched events in order (empty if none)
     */
    public List<DispatchedEvent> dispatched() {
        return List.copyOf(dispatched);
    }

    /**
     * @return the captured action return value, or {@code null} if none
     */
    public @Nullable Object returnValue() {
        return returnValue;
    }

    /**
     * @return the per-field validation errors, or {@code null} if validation passed (or did not run)
     */
    public @Nullable Map<String, List<String>> validationErrors() {
        return validationErrors;
    }

    /**
     * @return the {@code url} effect (the query string to reflect), or {@code null} if none
     */
    public @Nullable UrlEffect url() {
        return url;
    }

    /**
     * @return true if no effect was produced (so the {@code Lievit-Effects} header is omitted)
     */
    public boolean isEmpty() {
        return redirect == null && dispatched.isEmpty() && returnValue == null
                && validationErrors == null && url == null;
    }
}
