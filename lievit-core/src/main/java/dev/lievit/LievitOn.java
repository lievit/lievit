/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Repeatable;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Declares a component method (or the component itself) as a listener for a named browser event,
 * the receiving half of the {@code dispatch} effect (ADR-0030, Livewire {@code #[On]} parity).
 *
 * <p>A component dispatches an event with {@code LievitEffects.current().dispatch("saved", detail)};
 * the client re-emits it as a DOM {@code CustomEvent} on {@code window} and routes it to every
 * component that listens for that name, which then makes a wire call naming the listener. On the
 * server, the dispatcher invokes the matching {@code @LievitOn} method with the event payload bound
 * to its parameters (by name when the detail is a map, positionally otherwise).
 *
 * <p><b>Method level:</b> {@code @LievitOn("saved") void onSaved(int id) { ... }} fires when a
 * {@code saved} event arrives. The method is invoked with the payload; like an {@code @LievitAction}
 * it may mutate {@code @Wire} state and the component re-renders after.
 *
 * <p><b>Class level:</b> {@code @LievitOn("refresh-list")} on the component class registers a bare
 * {@code $refresh} listener: the event triggers a re-render with no handler method (Livewire's
 * class-level {@code #[On]}).
 *
 * <p><b>Dynamic names:</b> a listener name may embed a {@code {dotted.path}} placeholder resolved
 * against the component's {@code @Wire} state at registration time, e.g.
 * {@code @LievitOn("post.{post.id}.saved")} resolves to {@code post.2.saved} when {@code post.id}
 * is 2. This lets a component listen for an event scoped to the entity it currently shows.
 *
 * <p>Repeatable: a single method may listen for more than one event name.
 *
 * <p><b>Security:</b> an {@code @LievitOn} method is NOT in the {@code @LievitAction} allowlist, so
 * the client cannot invoke it directly as an action; it is only reachable as the resolved target of
 * a dispatched event the framework routed. Calling it as a frontend action is an
 * {@code UNKNOWN_COMPONENT} like any other non-action method (ADR-0013).
 *
 * <p>The events annotation of the lievit public API (see the package taxonomy); adding it is
 * governed by ADR-0030.
 */
@Documented
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Repeatable(LievitOn.List.class)
public @interface LievitOn {

    /**
     * The event name(s) this listener fires on. A name may embed a {@code {dotted.path}} placeholder
     * resolved against component state.
     *
     * @return the event name(s)
     */
    String[] value();

    /**
     * The container for repeated {@link LievitOn} declarations on one element.
     */
    @Documented
    @Target({ElementType.METHOD, ElementType.TYPE})
    @Retention(RetentionPolicy.RUNTIME)
    @interface List {

        /**
         * @return the repeated {@link LievitOn} annotations
         */
        LievitOn[] value();
    }
}
