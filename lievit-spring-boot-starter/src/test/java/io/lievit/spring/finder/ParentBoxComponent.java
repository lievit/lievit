/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.finder;

import java.util.Map;

import io.lievit.LievitComponent;
import io.lievit.LievitRender;
import io.lievit.Wire;
import io.lievit.component.LievitChildren;

/**
 * The parent for the Finder/Factory IT (issue #183): it mounts one {@link ChildLeafComponent}, so a
 * nested mount happens and the child can record this parent via the {@code ComponentStack}. Its
 * declared template {@code finder/parent} drives its dotted name {@code finder.parent}.
 */
@LievitComponent(template = "finder/parent")
public class ParentBoxComponent {

    @Wire String title = "box";

    @LievitRender
    void renderChildren() {
        LievitChildren.current().child("leaf", ChildLeafComponent.class, Map.of());
    }
}
