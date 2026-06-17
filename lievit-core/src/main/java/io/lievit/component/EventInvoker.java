/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * Resolves an {@link InboundEvent} against a component's {@link EventListenerMetadata} and invokes
 * the matching {@code @LievitOn} handler with the event payload (ADR-0030). Pure reflection, zero
 * Spring (ADR-0007). Used by the {@link WireDispatcher} during the CALL phase of a wire call that
 * carries inbound events.
 *
 * <p>Payload binding mirrors Livewire: when the detail is a map, each handler parameter is bound by
 * name (the parameter name must be retained at compile time, {@code -parameters}); a single-parameter
 * handler with a non-map detail receives the detail as-is. A bare signal event (null detail)
 * invokes a no-arg handler. A class-level {@code $refresh} listener has a {@code null} handler: the
 * event matched, the component re-renders, no method runs.
 */
public final class EventInvoker {

    private EventInvoker() {}

    /**
     * Invokes every handler whose resolved {@code @LievitOn} name matches the inbound event.
     *
     * @param metadata the listening component's event metadata
     * @param instance the component instance (read for placeholder resolution, written by the handler)
     * @param event the inbound event
     * @return true if at least one listener matched (so the caller re-renders even with a null
     *     handler, the class-level {@code $refresh} case); false if no listener matched
     */
    public static boolean invokeMatching(
            EventListenerMetadata metadata, Object instance, InboundEvent event) {
        if (metadata.isEmpty()) {
            return false;
        }
        Map<String, @Nullable Method> resolved = metadata.resolve(instance);
        boolean matched = false;
        for (Map.Entry<String, @Nullable Method> entry : resolved.entrySet()) {
            if (!entry.getKey().equals(event.name())) {
                continue;
            }
            matched = true;
            Method handler = entry.getValue();
            if (handler != null) {
                invoke(handler, instance, event.detail());
            }
            // null handler = class-level $refresh listener: match (re-render), no method.
        }
        return matched;
    }

    private static void invoke(Method handler, Object instance, @Nullable Map<String, Object> detail) {
        Object[] args = bindArgs(handler, detail);
        try {
            handler.invoke(instance, args);
        } catch (IllegalAccessException e) {
            throw new IllegalStateException("cannot invoke @LievitOn handler " + handler.getName(), e);
        } catch (InvocationTargetException e) {
            Throwable cause = e.getCause();
            if (cause instanceof RuntimeException re) {
                throw re;
            }
            throw new IllegalStateException("@LievitOn handler threw a checked exception", cause);
        }
    }

    /**
     * Binds the event detail to the handler's parameters: by name when the detail is a map, as the
     * single argument when the handler takes one parameter and the detail is a scalar, or no args for
     * a no-arg handler. An unbound parameter gets {@code null} (or the primitive default).
     */
    private static Object[] bindArgs(Method handler, @Nullable Map<String, Object> detail) {
        Parameter[] params = handler.getParameters();
        if (params.length == 0) {
            return new Object[0];
        }
        Object[] args = new Object[params.length];
        if (detail == null) {
            return args;
        }
        if (params.length == 1 && !looksLikeNamedBinding(params, detail)) {
            // Single parameter, detail is not a name-keyed map for it: pass the whole detail (or, if
            // the detail has exactly one value and the param is a scalar, that value).
            args[0] = singleArg(detail);
            return args;
        }
        for (int i = 0; i < params.length; i++) {
            args[i] = detail.get(params[i].getName());
        }
        return args;
    }

    /** True if every handler parameter name is a key in the detail map (a named-binding payload). */
    private static boolean looksLikeNamedBinding(Parameter[] params, Map<String, Object> detail) {
        for (Parameter p : params) {
            if (!detail.containsKey(p.getName())) {
                return false;
            }
        }
        return true;
    }

    private static @Nullable Object singleArg(Map<String, Object> detail) {
        if (detail.size() == 1) {
            return List.copyOf(detail.values()).get(0);
        }
        return detail;
    }
}
