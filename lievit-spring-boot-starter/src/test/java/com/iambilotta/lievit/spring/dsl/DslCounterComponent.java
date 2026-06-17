/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring.dsl;

import static com.iambilotta.lievit.dsl.H.button;
import static com.iambilotta.lievit.dsl.H.div;
import static com.iambilotta.lievit.dsl.H.span;
import static com.iambilotta.lievit.dsl.H.text;

import com.iambilotta.lievit.LievitAction;
import com.iambilotta.lievit.LievitComponent;
import com.iambilotta.lievit.LievitMount;
import com.iambilotta.lievit.Wire;
import com.iambilotta.lievit.dsl.Html;

/**
 * The single-file DSL counter (ADR-0003/0015): no JTE template, its view is a typed {@link Html} tree
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

    @com.iambilotta.lievit.LievitRender
    Html view() {
        return div(
                        span(text(count)).attr("data-lievit-count", ""),
                        button(text("+1")).wireClick("increment"))
                .attr("data-lievit-label", "dsl");
    }
}
