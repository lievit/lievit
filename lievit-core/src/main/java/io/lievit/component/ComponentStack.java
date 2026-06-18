/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.util.ArrayDeque;
import java.util.Deque;

import org.jspecify.annotations.Nullable;

/**
 * The current-component stack (issue #183, Livewire's {@code HandleComponents} {@code componentStack}
 * push/pop): a request-scoped record of which component is rendering right now and which mounted it,
 * so {@code $parent} resolution and nested-children tracking know the parent without threading it
 * through every call. Bound around a render/mount exactly as {@link LievitChildren},
 * {@link LievitEffects}, and {@link DeterministicKeyScope} are (a {@link ThreadLocal}, cleared in a
 * {@code finally}), so nothing survives between stateless wire calls (the ADR-0001 invariant).
 *
 * <p>A frame is the pair {@code (name, id)}: the dotted component name and the instance id. The top
 * of the stack is the component currently rendering; the frame beneath it is its parent. A root
 * component (mounted directly by a route or the wire endpoint) has no parent, so {@link #parent()}
 * is {@code null} for it.
 */
public final class ComponentStack {

    private static final ThreadLocal<@Nullable ComponentStack> CURRENT = new ThreadLocal<>();

    private final Deque<Frame> frames = new ArrayDeque<>();

    /**
     * @return the stack bound to the current thread, or {@code null} if none is bound (no render is
     *     in flight)
     */
    public static @Nullable ComponentStack current() {
        return CURRENT.get();
    }

    /** Binds {@code stack} as the component stack for the current thread (called by the render binder). */
    public static void bind(ComponentStack stack) {
        CURRENT.set(stack);
    }

    /** Clears the bound stack for the current thread (called by the binder in a finally). */
    public static void clear() {
        CURRENT.remove();
    }

    /**
     * Pushes the component about to render onto the stack: it becomes {@link #currentFrame()} and the
     * previous top becomes its parent.
     *
     * @param name the dotted component name
     * @param id the component instance id
     * @return the pushed frame
     */
    public Frame push(String name, String id) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("a component frame needs a non-blank name");
        }
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("a component frame needs a non-blank id");
        }
        Frame frame = new Frame(name, id);
        frames.push(frame);
        return frame;
    }

    /**
     * Pops the current component off the stack when its render/mount completes.
     *
     * @return the popped frame
     * @throws IllegalStateException if the stack is empty (a pop with no matching push)
     */
    public Frame pop() {
        if (frames.isEmpty()) {
            throw new IllegalStateException("component stack pop with no matching push");
        }
        return frames.pop();
    }

    /**
     * @return the frame currently rendering (top of the stack), or {@code null} if the stack is empty
     */
    public @Nullable Frame currentFrame() {
        return frames.peek();
    }

    /**
     * @return the parent of the component currently rendering (the frame beneath the top), or
     *     {@code null} for a root component (no parent)
     */
    public @Nullable Frame parent() {
        if (frames.size() < 2) {
            return null;
        }
        var it = frames.iterator();
        it.next(); // skip the current top
        return it.next();
    }

    /**
     * @return the current nesting depth (0 when empty, 1 for a root render, deeper inside children)
     */
    public int depth() {
        return frames.size();
    }

    /**
     * One stack frame: the dotted name + instance id of a component currently in the render path.
     *
     * @param name the dotted component name
     * @param id the component instance id
     */
    public record Frame(String name, String id) {}
}
