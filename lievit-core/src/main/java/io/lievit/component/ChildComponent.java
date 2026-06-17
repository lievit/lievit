/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.util.Map;

/**
 * One child a parent component mounted inside its render (ADR-0016, nested components). It names the
 * child {@code @LievitComponent} class, the stable {@code key} the client morph identifies it by
 * across re-renders, and the {@code props} the parent passed down (seeded onto the child's
 * {@code @Wire} fields before the child's {@code @LievitMount} runs).
 *
 * <p>A child is an <em>independent</em> component: it gets its own signed snapshot and its own
 * {@code cid}, so the statelessness invariant of ADR-0001 holds per component. The parent does not
 * carry the child's state; it carries only the declaration (class + key + props) needed to mount it.
 * This mirrors Livewire's parent/child model, where a child is a first-class component the parent
 * references by key, not a fragment of the parent's own snapshot.
 *
 * <p>{@code props} is plain JSON data (the {@link io.lievit.wire.PayloadGuard}
 * allowlist): a parent passing an opaque object down is the same gadget surface a client update is,
 * so props ride through the same shape check (ADR-0013, ADR-0016).
 *
 * @param key the stable identity within the parent's render (the {@code @key} equivalent); the
 *     client morph keys children by it so re-renders do not thrash the DOM or lose child state
 * @param className the fully-qualified {@code @LievitComponent} class name of the child
 * @param props the props the parent passed down, seeded onto the child's {@code @Wire} fields before
 *     mount; JSON-shaped, may be empty
 */
public record ChildComponent(String key, String className, Map<String, Object> props) {

    /**
     * @param key the stable child key (must be non-blank: the morph identity depends on it)
     * @param className the child component class name (must be non-blank)
     * @param props the parent-supplied props (defensively copied; never {@code null})
     */
    public ChildComponent {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("a child component needs a non-blank @key");
        }
        if (className == null || className.isBlank()) {
            throw new IllegalArgumentException("a child component needs a class name");
        }
        props = props == null ? Map.of() : Map.copyOf(props);
    }
}
