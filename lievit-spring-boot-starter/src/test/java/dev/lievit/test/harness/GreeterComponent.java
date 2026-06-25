/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.test.harness;

import java.util.ArrayList;
import java.util.List;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitMount;
import dev.lievit.LievitProperty;
import dev.lievit.Wire;
import dev.lievit.component.LievitEffects;

/**
 * A second component used only to test the harness itself (not a walking-skeleton tracer-bullet): it
 * has an unlocked {@code @Wire name} the client can model-update, a locked {@code owner}, and a
 * {@code greetings} list so the harness's {@code .size} navigation and {@code assertWireMatches} can
 * be exercised. {@code greet()} pushes "Hello, {name}" onto the list. {@code wave()} queues a
 * CSP-safe {@code $js} effect so the harness's {@code assertJs} / {@code assertNoJs} can be tested.
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

    @LievitAction
    void wave() {
        LievitEffects.current().js("highlight", name);
    }
}
