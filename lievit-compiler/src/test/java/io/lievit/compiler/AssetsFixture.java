/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.compiler;

import io.lievit.LievitComponent;
import io.lievit.LievitRender;
import io.lievit.Wire;

/**
 * A single-file component fixture (issue #119) with a colocated {@code AssetsFixture.lievit.assets}
 * resource declaring {@code @assets} head tags, used to prove {@link ComponentCompiler} captures them
 * once-per-page with a deterministic key.
 */
@LievitComponent
public class AssetsFixture {

    @Wire int n;

    @LievitRender
    Object view() {
        return null;
    }
}
