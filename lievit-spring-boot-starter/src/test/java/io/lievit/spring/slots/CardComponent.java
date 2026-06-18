/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.slots;

import io.lievit.LievitComponent;

/**
 * A wrapper child component (issue #91): its JTE template ({@code slots/card}) renders the card chrome
 * and positions the parent-supplied slots via the {@link io.lievit.component.LievitSlots} proxy, a
 * named {@code header} slot (rendered only when present) and the default body slot. The child does
 * NOT own the slot content; it only decides where the parent's content renders.
 */
@LievitComponent(template = "slots/card")
public class CardComponent {
}
