/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.wire;

import java.util.ArrayList;
import java.util.List;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitProperty;
import dev.lievit.LievitRender;
import dev.lievit.Wire;

/**
 * In-repo proof copy of the shipped {@code registry:wire} accordion component (ADR-0012, Wave 2).
 *
 * <p>This is the same source {@code lievit add accordion} copies from
 * {@code lievit-ui/registry/wire/accordion/AccordionComponent.java}, vendored into the kit test tree
 * (package adjusted to {@code dev.lievit.kit.wire}) so {@link AccordionComponentIT} can drive it
 * through the REAL lievit runtime (codec + registry + dispatcher + JTE adapter) and assert both the
 * server-side open-set transition and the rendered HTML. The "never-executed-equals-wannabe" rule:
 * a wire component is not done until one real instance mounts, toggles, and renders through the
 * runtime.
 *
 * <p>Convention (blueprint 1.b): state in {@code @Wire public} fields, the toggle a
 * {@code @LievitAction} (the clicked item armed into {@link #toggleId} via {@code $set}, since a
 * regular action takes no forwarded args), the accordion a11y in the template.
 */
@LievitComponent(template = "lievit/accordion")
public class AccordionComponent {

    /** Item ids in render order. Locked: the item set is server config. Paired with {@link #labels}. */
    @Wire
    @LievitProperty(locked = true)
    public List<String> itemIds = new ArrayList<>();

    /** Trigger labels, index-aligned with {@link #itemIds}. Locked alongside the ids. */
    @Wire
    @LievitProperty(locked = true)
    public List<String> labels = new ArrayList<>();

    /** The currently open item ids: the disclosure state, held server-side, round-tripped as JSON. */
    @Wire
    public List<String> open = new ArrayList<>();

    /** {@code "single"} (at most one open) or {@code "multiple"}. Locked: server policy. */
    @Wire
    @LievitProperty(locked = true)
    public String mode = "single";

    /** The item a click armed (via {@code $set}); consumed + cleared on render. Never persists. */
    @Wire
    public String toggleId = "";

    /** Flips the armed item in the open set on every pre-render, then clears the arm (idempotent). */
    @LievitRender
    void applyToggle() {
        if (toggleId.isEmpty() || !itemIds.contains(toggleId)) {
            toggleId = "";
            return;
        }
        flip(toggleId);
        toggleId = "";
    }

    /** Explicit toggle of the armed item over the {@code @LievitAction} dispatch; clears the arm. */
    @LievitAction
    public void toggle() {
        if (!toggleId.isEmpty() && itemIds.contains(toggleId)) {
            flip(toggleId);
        }
        toggleId = "";
    }

    private void flip(String id) {
        if (open.contains(id)) {
            open.remove(id);
            return;
        }
        if ("single".equals(mode)) {
            open.clear();
        }
        open.add(id);
    }

    /**
     * @param id the item id
     * @return true when the item is in the open set
     */
    public boolean isOpen(String id) {
        return open.contains(id);
    }
}
