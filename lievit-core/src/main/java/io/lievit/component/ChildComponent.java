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
 * <p>{@code slots} (issue #91) is the parent-rendered content passed into the child: a map from slot
 * name ({@code "default"} for the unnamed slot) to the HTML the parent rendered <em>in its own
 * scope</em>. The child reads it via the {@link LievitSlots} proxy during its render; the content's
 * state and events stay owned by the parent (a button inside a slot mutates the parent, not the
 * child). Empty for a child mounted without slot content (the common case).
 *
 * @param key the stable identity within the parent's render (the {@code @key} equivalent); the
 *     client morph keys children by it so re-renders do not thrash the DOM or lose child state
 * @param className the fully-qualified {@code @LievitComponent} class name of the child
 * @param props the props the parent passed down, seeded onto the child's {@code @Wire} fields before
 *     mount; JSON-shaped, may be empty
 * @param slots the parent-rendered slot content by slot name ({@code "default"} = unnamed); empty
 *     when the child was mounted without slots
 */
public record ChildComponent(
        String key, String className, Map<String, Object> props, Map<String, String> slots) {

    /**
     * @param key the stable child key (must be non-blank: the morph identity depends on it)
     * @param className the child component class name (must be non-blank)
     * @param props the parent-supplied props (defensively copied; never {@code null})
     * @param slots the parent-rendered slot content (defensively copied; never {@code null})
     */
    public ChildComponent {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("a child component needs a non-blank @key");
        }
        if (className == null || className.isBlank()) {
            throw new IllegalArgumentException("a child component needs a class name");
        }
        props = props == null ? Map.of() : Map.copyOf(props);
        slots = slots == null ? Map.of() : Map.copyOf(slots);
    }

    /**
     * A child with no slot content (the common case): keeps the existing three-argument call sites
     * intact.
     *
     * @param key the stable child key
     * @param className the child component class name
     * @param props the parent-supplied props
     */
    public ChildComponent(String key, String className, Map<String, Object> props) {
        this(key, className, props, Map.of());
    }
}
