/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.counter;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitMount;
import io.lievit.LievitProperty;
import io.lievit.Wire;

/**
 * The walking-skeleton tracer-bullet: a counter with one {@code @Wire int count} and one
 * {@code @LievitAction increment}, rendered by the JTE {@code counter} template. It is the single
 * end-to-end path that proves mount -&gt; render -&gt; {@code l:click} -&gt; re-render works
 * (ADR-0001, the golden roundtrip of ADR-0007).
 *
 * <p>{@code startedAt} is a locked {@code @LievitProperty}: it demonstrates the ADR-0001 amendment
 * (Livewire {@code #[Locked]} parity). The server seeds it; a client {@code _updates} entry for it
 * is rejected with a 403, even though the snapshot itself is validly signed.
 */
@LievitComponent(template = "counter")
public class CounterComponent {

    @Wire int count;

    @Wire @LievitProperty(locked = true) String label = "server-set";

    @LievitMount
    void seed() {
        this.count = 0;
    }

    @LievitAction
    void increment() {
        this.count++;
    }

    /**
     * An action that throws, to exercise the fail-closed error path (ADR-0014): the message names a
     * fake internal class so the leak-free assertion can prove it never reaches the client.
     */
    @LievitAction
    void boom() {
        throw new IllegalStateException(
                "internal failure in io.lievit.secret.GadgetChain at row 42");
    }
}
