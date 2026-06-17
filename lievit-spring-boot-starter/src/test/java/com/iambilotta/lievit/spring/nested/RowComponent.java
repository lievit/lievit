/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring.nested;

import com.iambilotta.lievit.LievitComponent;
import com.iambilotta.lievit.Wire;

/**
 * A leaf child component (ADR-0016): a single row whose {@code label} is a {@code @Wire} field the
 * parent seeds as a prop. It proves prop pass-down (parent → child) and that a child carries its own
 * independent snapshot.
 */
@LievitComponent(template = "nested/row")
public class RowComponent {

    @Wire String label = "";
}
