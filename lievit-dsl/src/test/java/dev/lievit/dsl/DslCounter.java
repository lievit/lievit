/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.dsl;

import static dev.lievit.dsl.H.button;
import static dev.lievit.dsl.H.div;
import static dev.lievit.dsl.H.span;
import static dev.lievit.dsl.H.text;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitMount;
import dev.lievit.LievitRender;
import dev.lievit.Wire;

/**
 * A single-file DSL counter test fixture (ADR-0003/0018): no template, an {@code @LievitRender}
 * method returning a typed {@link Html} tree. The same counter the README sketches, used to prove
 * the DSL adapter renders it through the core lifecycle.
 */
@LievitComponent
public class DslCounter {

    @Wire int count;

    @LievitMount
    void seed() {
        this.count = 0;
    }

    @LievitAction
    void increment() {
        this.count++;
    }

    @LievitRender
    Html view() {
        return div(
                button(text("-")).wireClick("decrement"),
                span(text(count)),
                button(text("+")).wireClick("increment"));
    }
}
