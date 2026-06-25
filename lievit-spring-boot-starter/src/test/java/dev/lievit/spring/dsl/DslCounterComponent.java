/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.dsl;

import static dev.lievit.dsl.H.button;
import static dev.lievit.dsl.H.div;
import static dev.lievit.dsl.H.span;
import static dev.lievit.dsl.H.text;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitMount;
import dev.lievit.Wire;
import dev.lievit.dsl.Html;

/**
 * The single-file DSL counter (ADR-0003/0018): no JTE template, its view is a typed {@link Html} tree
 * returned from {@code @LievitRender}. It is the DSL sibling of the {@code CounterComponent} walking
 * skeleton: the end-to-end proof that a single-file-DSL component mounts, takes an
 * {@code l:click} action over the real signed wire, and re-renders, through the same dispatcher,
 * codec, registry, and HTTP edge as a template component (only the {@code TemplateAdapter} differs).
 */
@LievitComponent
public class DslCounterComponent {

    @Wire int count;

    @LievitMount
    void seed() {
        this.count = 0;
    }

    @LievitAction
    void increment() {
        this.count++;
    }

    @dev.lievit.LievitRender
    Html view() {
        return div(
                        span(text(count)).attr("data-lievit-count", ""),
                        button(text("+1")).wireClick("increment"))
                .attr("data-lievit-label", "dsl");
    }
}
