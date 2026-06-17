/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.nested;

import java.util.Map;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitMount;
import io.lievit.LievitRender;
import io.lievit.Wire;
import io.lievit.component.LievitChildren;

/**
 * The parent component (ADR-0016): it renders {@code rows} keyed {@link RowComponent} children, each
 * with a stable {@code @key} and a {@code label} prop passed down, plus one modelable
 * {@link RowInputComponent} two-way-bound to {@code draft}. {@code addRow} grows the list (proving a
 * re-render re-declares children key-stably).
 *
 * <p>The parent declares its children in {@link #renderChildren()} via the {@link LievitChildren}
 * sink: a runtime API, not an eighth annotation (ADR-0002 cap held). The keys are stable
 * ({@code row-0}, {@code row-1}, ...) so the client morph identifies a child across re-renders and
 * does not thrash its DOM.
 */
@LievitComponent(template = "nested/list")
public class ListComponent {

    @Wire int rows;
    @Wire String draft = "";

    @LievitMount
    void seed() {
        this.rows = 2;
        this.draft = "hello";
    }

    @LievitAction
    void addRow() {
        this.rows++;
    }

    @LievitRender
    void renderChildren() {
        LievitChildren children = LievitChildren.current();
        for (int i = 0; i < rows; i++) {
            children.child("row-" + i, RowComponent.class, Map.of("label", "row " + i));
        }
        // The modelable two-way bind: pass draft down as the child's value, and name the parent
        // property (draft) the child writes back to via the _modelable prop.
        children.child(
                "draft-input",
                RowInputComponent.class,
                Map.of("value", draft, "_modelable", "draft"));
    }
}
