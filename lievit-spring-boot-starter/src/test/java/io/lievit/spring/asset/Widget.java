/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.asset;

import static io.lievit.dsl.H.button;
import static io.lievit.dsl.H.div;
import static io.lievit.dsl.H.span;
import static io.lievit.dsl.H.text;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitRender;
import io.lievit.Wire;
import io.lievit.dsl.Html;

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
