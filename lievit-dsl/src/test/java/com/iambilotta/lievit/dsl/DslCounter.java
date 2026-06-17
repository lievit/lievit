/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.dsl;

import static com.iambilotta.lievit.dsl.H.button;
import static com.iambilotta.lievit.dsl.H.div;
import static com.iambilotta.lievit.dsl.H.span;
import static com.iambilotta.lievit.dsl.H.text;

import com.iambilotta.lievit.LievitAction;
import com.iambilotta.lievit.LievitComponent;
import com.iambilotta.lievit.LievitMount;
import com.iambilotta.lievit.LievitRender;
import com.iambilotta.lievit.Wire;

/**
 * A single-file DSL counter test fixture (ADR-0003/0015): no template, an {@code @LievitRender}
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
