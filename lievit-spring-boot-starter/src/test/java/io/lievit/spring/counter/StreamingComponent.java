/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.counter;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.Wire;
import io.lievit.component.LievitStream;

/**
 * Exercises the streaming SSE endpoint end-to-end (issue #153, ADR-0035): the {@code generate} action
 * streams a sequence of chunks into the {@code l:stream="out"} target (appending), then a falsy empty
 * chunk and a final replace chunk into {@code status}, proving the chunks flush incrementally over the
 * SSE response and falsy content streams correctly.
 */
@LievitComponent(template = "streaming")
public class StreamingComponent {

    @Wire int turns;

    @LievitAction
    void generate() {
        this.turns++;
        LievitStream stream = LievitStream.current();
        stream.stream("out", "Hello ");
        stream.stream("out", "world");
        stream.stream("out", ""); // falsy content is a valid chunk
        stream.stream("status", "done", true);
    }
}
