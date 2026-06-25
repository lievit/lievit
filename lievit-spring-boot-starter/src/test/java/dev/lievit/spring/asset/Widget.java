/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.asset;

import static dev.lievit.dsl.H.button;
import static dev.lievit.dsl.H.div;
import static dev.lievit.dsl.H.span;
import static dev.lievit.dsl.H.text;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitRender;
import dev.lievit.Wire;
import dev.lievit.dsl.Html;

/**
 * A single-file DSL component fixture (issue #171/#119/#129) colocating a script module
 * ({@code Widget.lievit.ts}), scoped CSS ({@code Widget.lievit.css}), and {@code @assets} head tags
 * ({@code Widget.lievit.assets}) on the test classpath, used to prove the asset emitter ships the
 * page-level assets on a wire update and the asset controller serves them.
 */
@LievitComponent
public class Widget {

    @Wire int value;

    @LievitAction
    void bump() {
        this.value++;
    }

    @LievitRender
    Html view() {
        return div(span(text(value)), button(text("+")).wireClick("bump"));
    }
}
