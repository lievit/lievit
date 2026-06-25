/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.finder;

import dev.lievit.LievitComponent;
import dev.lievit.LievitMount;
import dev.lievit.Wire;
import dev.lievit.component.ComponentStack;

/**
 * The child for the Finder/Factory IT (issue #183): during its mount it reads
 * {@link ComponentStack#parent()} and stores the parent's dotted name into a {@code @Wire} field, so
 * the rendered HTML proves the nested mount recorded its parent ({@code finder.parent}). Its declared
 * template {@code finder/leaf} drives its dotted name {@code finder.leaf}.
 */
@LievitComponent(template = "finder/leaf")
public class ChildLeafComponent {

    @Wire String parentName = "none";

    @LievitMount
    void recordParent() {
        ComponentStack stack = ComponentStack.current();
        ComponentStack.Frame parent = stack == null ? null : stack.parent();
        this.parentName = parent == null ? "none" : parent.name();
    }
}
