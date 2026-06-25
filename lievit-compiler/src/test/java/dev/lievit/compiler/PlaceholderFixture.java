/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler;

import dev.lievit.LievitComponent;
import dev.lievit.LievitRender;
import dev.lievit.Wire;

/**
 * A single-file component fixture (ADR-0023, issue #173) with a colocated placeholder resource
 * ({@code PlaceholderFixture.placeholder.html} next to this class) and a colocated script/style, used
 * to prove {@link ComponentCompiler} discovers the side artifacts by convention.
 */
@LievitComponent
public class PlaceholderFixture {

    @Wire int items;

    @LievitRender
    Object view() {
        return null;
    }
}
