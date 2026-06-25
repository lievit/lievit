/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.wire;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitProperty;
import dev.lievit.Wire;

/**
 * In-repo proof copy of the shipped {@code registry:wire} collapsible component (ADR-0012, Wave 0).
 *
 * <p>This is the same source {@code lievit add collapsible} copies from
 * {@code lievit-ui/registry/wire/collapsible/CollapsibleComponent.java}, vendored into the kit test
 * tree so {@link CollapsibleComponentIT} can drive it through the REAL lievit runtime (codec +
 * registry + dispatcher + JTE adapter) and assert both the server state transition and the rendered
 * HTML. The "never-executed-equals-wannabe" rule: the wire mechanism is not done until one real
 * component mounts, toggles, and renders through the runtime.
 *
 * <p>Convention (blueprint 1.b): state in {@code @Wire public} fields, the toggle a
 * {@code @LievitAction}, disclosure a11y in the template. {@code disabled} is locked so a client
 * cannot enable a server-disabled trigger.
 */
@LievitComponent(template = "lievit/collapsible")
public class CollapsibleComponent {

    /** Trigger label text. Client-editable, round-trips in the snapshot. */
    @Wire
    public String label = "";

    /** Open state: the single piece of disclosure state, held server-side. */
    @Wire
    public boolean open = false;

    /**
     * Disables the trigger: blocks {@link #toggle()} and dims it. Locked so a client cannot flip a
     * server-disabled trigger to enabled by editing the snapshot payload.
     */
    @Wire
    @LievitProperty(locked = true)
    public boolean disabled = false;

    /**
     * Toggles the disclosure open/closed. A no-op while {@link #disabled}, so the server stays the
     * single owner of the state even if a disabled trigger is somehow invoked.
     */
    @LievitAction
    public void toggle() {
        if (disabled) {
            return;
        }
        open = !open;
    }
}
