/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitProperty;
import dev.lievit.Wire;

/**
 * {@code collapsible}: the server-first WIRE replacement for the {@code <lv-collapsible>} Lit
 * island (ADR-0012). A single trigger expands / collapses one content region; the open/closed
 * state lives here in typed Java, not in client memory, and the server re-renders the template
 * on each {@link #toggle()} (the client morphs the result, preserving focus + scroll).
 *
 * <p>WHY server-state: the island held {@code open} in a Lit reactive property and projected the
 * body through a native {@code <slot>}, which is inert in light DOM, so the body silently never
 * rendered (the bug ADR-0012 was written to kill). Here {@code open} is a {@code @Wire} boolean
 * round-tripped in the signed snapshot, and the body is plain server-rendered JTE: it cannot fail
 * to project.
 *
 * <p>Convention (blueprint 1.b): state is {@code @Wire public} fields; the action is a
 * {@code @LievitAction} method; the disclosure a11y (WAI-ARIA APG, Radix Collapsible source) lives
 * in the template. {@code label} + {@code open} round-trip; {@code disabled} is locked so a client
 * cannot enable a server-disabled trigger.
 *
 * <p>Copied in by {@code lievit add collapsible}: the adopter OWNS this class (rename it, move the
 * package, add server-side conditions on the toggle) AND the {@code collapsible.jte} template.
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
