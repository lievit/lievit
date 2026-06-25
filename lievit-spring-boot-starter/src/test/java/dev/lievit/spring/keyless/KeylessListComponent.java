/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.keyless;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitMount;
import dev.lievit.LievitRender;
import dev.lievit.Wire;
import dev.lievit.component.LievitChildren;
import dev.lievit.spring.nested.RowComponent;

/**
 * A parent that declares its row children <strong>without an explicit {@code @key}</strong>
 * (ADR-0023, issue #175): each {@code children.child(RowComponent.class, ...)} call gets a
 * deterministic {@code lw-<crc32(template)>-<counter>} key from the bound {@link
 * dev.lievit.component.DeterministicKeyScope} the dispatcher binds (with the compiler's crc32
 * generator wired by the starter). The render captures the returned placeholder tokens so the
 * template can emit them in order. This is the {@code <lievit:row/>}-in-a-loop case lowered to the
 * runtime sink: the generated keys are the morph anchor, so a re-render reuses the right DOM node
 * instead of bleeding one row's state into the next.
 */
@LievitComponent(template = "keyless/list")
public class KeylessListComponent {

    @Wire int rows;

    // Not serialized into the snapshot: a per-render view-only list of the placeholder tokens the
    // template emits (state has one owner, the server; this is derived ephemeral view state).
    private final List<String> placeholders = new ArrayList<>();

    @LievitMount
    void seed() {
        this.rows = 3;
    }

    @LievitAction
    void addRow() {
        this.rows++;
    }

    @LievitRender
    void renderChildren() {
        LievitChildren children = LievitChildren.current();
        placeholders.clear();
        for (int i = 0; i < rows; i++) {
            // Keyless: the deterministic key is generated; we never write "row-" + i.
            placeholders.add(children.child(RowComponent.class, Map.of("label", "row " + i)));
        }
    }

    /**
     * @return the placeholder tokens for this render, in order (the template emits each)
     */
    public List<String> placeholders() {
        return placeholders;
    }
}
