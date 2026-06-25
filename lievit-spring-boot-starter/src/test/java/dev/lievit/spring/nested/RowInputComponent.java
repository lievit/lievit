/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.nested;

import dev.lievit.LievitComponent;
import dev.lievit.LievitProperty;
import dev.lievit.Wire;

/**
 * A modelable child component (ADR-0016, Livewire {@code #[Modelable]} parity): its {@code value}
 * field two-way-binds to a property on the parent. The parent passes its value down as a prop and
 * names the bound property via the {@code _modelable} prop; the renderer stamps {@code lievit:
 * modelable} on this child's root so the client routes the child's change back up to the parent.
 */
@LievitComponent(template = "nested/row-input")
public class RowInputComponent {

    @Wire @LievitProperty(modelable = true) String value = "";
}
