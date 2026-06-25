/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * The slot proxy a child component reads during its render to access the content the parent passed
 * into it (issue #91, Livewire {@code SupportSlots} parity): the default (unnamed) slot via
 * {@link #slot()}, a named slot via {@link #get(String)}, and presence via {@link #has(String)}.
 *
 * <p>Slot content is <strong>parent-owned</strong>: the parent rendered it in the parent's scope, so
 * a button inside a slot mutates the parent's state, not the child's. The child only positions the
 * content (it decides <em>where</em> the slot renders, via the placeholder this proxy returns); it
 * does not own it. This mirrors Livewire v4 slots, where the slot's closure runs against the parent
 * component.
 *
 * <p>Like {@link LievitChildren} / {@link LievitEffects}, it is a request-scoped {@link ThreadLocal}
 * bound for the duration of one child render and cleared after, so nothing survives between the
 * stateless requests of ADR-0001. A child with no slots bound reads an empty proxy (every
 * {@link #get} returns {@code null}, {@link #has} returns false), so a slotless child render is
 * unaffected.
 *
 * <p>The content is emitted into the child markup as a placeholder comment ({@code <!--lievit:slot:
 * name-->}) which the web layer substitutes with the parent-rendered HTML, exactly like a child
 * placeholder. The substitution keeps the slot fragment a distinct, independently-morphable region
 * so a child re-render does not discard the parent's slot content.
 */
public final class LievitSlots {

    /** The conventional name of the unnamed (default) slot. */
    public static final String DEFAULT = "default";

    private static final ThreadLocal<LievitSlots> CURRENT = new ThreadLocal<>();

    private final Map<String, String> slots;

    private LievitSlots(Map<String, String> slots) {
        this.slots = slots;
    }

    /**
     * @return the slot proxy for the current child render
     * @throws IllegalStateException if called outside a child render (no proxy bound)
     */
    public static LievitSlots current() {
        LievitSlots slots = CURRENT.get();
        if (slots == null) {
            throw new IllegalStateException(
                    "LievitSlots.current() called outside a child render: no slot proxy is bound");
        }
        return slots;
    }

    /**
     * Binds {@code slots} as the proxy for the current thread, called by the web layer's child mount
     * driver immediately before a child render (the slot content is supplied by the parent, outside
     * the core dispatcher, so the binding is a web-layer responsibility, unlike {@link LievitChildren}
     * which the dispatcher binds itself).
     *
     * @param slots the parent-rendered slot content by name (may be {@code null}/empty)
     */
    public static void bindFor(@Nullable Map<String, String> slots) {
        CURRENT.set(new LievitSlots(slots == null ? Map.of() : slots));
    }

    /** Clears the bound proxy for the current thread (called by the mount driver in a finally). */
    public static void clearFor() {
        CURRENT.remove();
    }

    /**
     * Positions a named slot: returns the placeholder the child's markup renders where the slot
     * content belongs; the web layer substitutes the parent-rendered HTML for it. An absent slot
     * yields an empty placeholder that substitutes to nothing.
     *
     * @param name the slot name
     * @return the placeholder token for that slot
     */
    public String get(String name) {
        return placeholderFor(name);
    }

    /**
     * Positions the default (unnamed) slot.
     *
     * @return the placeholder token for the default slot
     */
    public String slot() {
        return get(DEFAULT);
    }

    /**
     * @param name the slot name
     * @return true if the parent supplied content for that slot
     */
    public boolean has(String name) {
        return slots.containsKey(name) && slots.get(name) != null;
    }

    /**
     * @return true if the parent supplied default-slot content
     */
    public boolean hasDefault() {
        return has(DEFAULT);
    }

    /**
     * @param name the slot name
     * @return the parent-rendered HTML for that slot, or {@code null} if absent (used by the web layer
     *     for substitution; a child reads it indirectly via {@link #get})
     */
    @Nullable String content(String name) {
        return slots.get(name);
    }

    /**
     * The placeholder token a child renders for a slot; the web layer replaces it with the parent's
     * slot HTML. It carries only the slot name, no state, so it is safe in the HTML stream until
     * substitution (the slot peer of {@link LievitChildren#placeholderFor}).
     *
     * @param name the slot name
     * @return the placeholder token (e.g. {@code <!--lievit:slot:header-->})
     */
    public static String placeholderFor(String name) {
        return "<!--lievit:slot:" + name + "-->";
    }
}
