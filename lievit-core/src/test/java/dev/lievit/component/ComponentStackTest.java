/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * Pins the current-component stack (issue #183, the Livewire {@code componentStack} push/pop): the
 * top is the component rendering now, the frame beneath it is its parent, a root has no parent, and
 * push/pop nest so a sibling sees the right parent. Bound like the other request-scoped sinks.
 */
class ComponentStackTest {

    @AfterEach
    void unbind() {
        ComponentStack.clear();
    }

    /**
     * @spec.given a freshly bound, empty component stack
     * @spec.when  the current frame and parent are read
     * @spec.then  both are null and the depth is 0 (no render is in flight)
     * @spec.adr   ADR-0023
     * @spec.us    US-183-component-finder
     */
    @Test
    void an_empty_stack_has_no_current_or_parent() {
        ComponentStack stack = new ComponentStack();
        assertThat(stack.currentFrame()).isNull();
        assertThat(stack.parent()).isNull();
        assertThat(stack.depth()).isZero();
    }

    /**
     * @spec.given a stack with a pushed root, then a pushed child
     * @spec.when  the current frame and parent are read at each level
     * @spec.then  the root has no parent; after pushing the child, the child is current and the root
     *     is its parent; popping the child restores the root as current
     * @spec.adr   ADR-0023
     * @spec.us    US-183-component-finder
     */
    @Test
    void push_records_the_parent_and_pop_restores_it() {
        ComponentStack stack = new ComponentStack();
        stack.push("admin.users", "cid-root");
        assertThat(stack.currentFrame()).isEqualTo(new ComponentStack.Frame("admin.users", "cid-root"));
        assertThat(stack.parent()).isNull();

        stack.push("admin.users.row", "cid-child");
        assertThat(stack.currentFrame())
                .isEqualTo(new ComponentStack.Frame("admin.users.row", "cid-child"));
        assertThat(stack.parent()).isEqualTo(new ComponentStack.Frame("admin.users", "cid-root"));
        assertThat(stack.depth()).isEqualTo(2);

        stack.pop();
        assertThat(stack.currentFrame()).isEqualTo(new ComponentStack.Frame("admin.users", "cid-root"));
        assertThat(stack.parent()).isNull();
    }

    /**
     * @spec.given an empty stack
     * @spec.when  pop is called with no matching push, or a blank name/id is pushed
     * @spec.then  each fails loudly (a pop with no push is a bug; a frame needs a real name + id)
     * @spec.adr   ADR-0023
     */
    @Test
    void guards_reject_an_unbalanced_pop_and_blank_frames() {
        ComponentStack stack = new ComponentStack();
        assertThatThrownBy(stack::pop).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> stack.push("  ", "id")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> stack.push("name", " ")).isInstanceOf(IllegalArgumentException.class);
    }

    /**
     * @spec.given a stack bound to the current thread
     * @spec.when  ComponentStack.current() reads it, then clear() unbinds
     * @spec.then  current() returns the bound stack, then null after clear (nothing survives the call)
     * @spec.adr   ADR-0001
     */
    @Test
    void binds_and_clears_per_thread() {
        ComponentStack stack = new ComponentStack();
        ComponentStack.bind(stack);
        assertThat(ComponentStack.current()).isSameAs(stack);
        ComponentStack.clear();
        assertThat(ComponentStack.current()).isNull();
    }
}
