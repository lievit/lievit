/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.test.harness;

import java.util.ArrayList;
import java.util.List;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitMount;
import io.lievit.LievitProperty;
import io.lievit.Wire;

/**
 * A second component used only to test the harness itself (not a walking-skeleton tracer-bullet): it
 * has an unlocked {@code @Wire name} the client can model-update, a locked {@code owner}, and a
 * {@code greetings} list so the harness's {@code .size} navigation and {@code assertWireMatches} can
 * be exercised. {@code greet()} pushes "Hello, {name}" onto the list.
 */
@LievitComponent(template = "greeter")
public class GreeterComponent {

    @Wire String name = "";

    @Wire @LievitProperty(locked = true) String owner = "server";

    @Wire List<String> greetings = new ArrayList<>();

    @LievitMount
    void seed() {
        this.name = "world";
    }

    @LievitAction
    void greet() {
        this.greetings.add("Hello, " + name);
    }
}
