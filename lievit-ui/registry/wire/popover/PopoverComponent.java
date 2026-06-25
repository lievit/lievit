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
 * {@code popover} (WIRE variant): the server-data-driven form of the popover overlay seam
 * (ADR-0012 blueprint R4). Use this when the popover's CONTENT depends on server state and the
 * open/close decision belongs server-side: the canonical case is gest's calendar-filter popover,
 * whose panel drives a server feed (the selected filters change what the calendar queries). For a
 * popover whose content is static, use the {@code popover} JTE PARTIAL instead (native
 * {@code popover} attribute + CSS Anchor Positioning, zero JS): this wire component is the heavier
 * tier, chosen only because the content + the open-state are server-held.
 *
 * <p>WHY server-state (vs the native-popover partial): the native {@code popover} attribute owns
 * show/hide purely client-side, which is perfect when the panel body is already in the DOM. But
 * when opening the popover must FETCH or RECOMPUTE the body from server state (the filtered feed,
 * a permission-gated form), the open-state has to live server-side so the {@link #toggle()} action
 * can re-render the panel with fresh content. Here {@code open} is a {@code @Wire} boolean
 * round-tripped in the signed snapshot; the panel + its content are conditionally server-rendered
 * ({@code @if(open)} in the template), so the body CANNOT fail to project (the light-DOM
 * {@code <slot>} bug ADR-0012 was written to kill: there is no slot, the body is owned markup).
 *
 * <p>Positioning stays the server-pure CSS path the partial documents (anchor-name on the trigger,
 * position-anchor + position-area + flip-block on the panel): zero {@code @floating-ui/dom}. The
 * panel still renders in normal flow anchored to the trigger; an adopter who needs the top-layer +
 * light-dismiss of the native popover can render the conditional panel with the {@code popover}
 * attribute and toggle it from {@link #render()} (documented seam, not the default).
 *
 * <p>Convention (blueprint 1.b): state is {@code @Wire public} fields; actions are
 * {@code @LievitAction} methods; the dialog-popover a11y (Radix Popover model) lives in the
 * template. {@code label} + {@code open} round-trip; {@code disabled} is locked so a client cannot
 * open a server-disabled popover by editing the snapshot.
 *
 * <p>Copied in by {@code lievit add popover-wire}: the adopter OWNS this class (rename it, move the
 * package, replace the toggle with a fetch-on-open, add server authz) AND the
 * {@code popover-wire.jte} template.
 */
@LievitComponent(template = "lievit/popover-wire")
public class PopoverComponent {

    /** Trigger label text. Client-editable, round-trips in the snapshot. */
    @Wire
    public String label = "";

    /** Open state: the single piece of disclosure state, held server-side so the panel content can
     * be (re)derived from server state on each open. */
    @Wire
    public boolean open = false;

    /**
     * Disables the trigger: blocks {@link #toggle()} / {@link #show()} and dims it. Locked so a
     * client cannot open a server-disabled popover by editing the snapshot payload.
     */
    @Wire
    @LievitProperty(locked = true)
    public boolean disabled = false;

    /**
     * Toggles the popover open/closed. A no-op while {@link #disabled}. On open, a real adopter
     * derives the panel content from server state here (fetch the filtered feed, build the form).
     */
    @LievitAction
    public void toggle() {
        if (disabled) {
            return;
        }
        open = !open;
    }

    /** Opens the popover (the trigger / a server flow). A no-op while {@link #disabled}. */
    @LievitAction
    public void show() {
        if (disabled) {
            return;
        }
        open = true;
    }

    /** Closes the popover (Escape / an outside click / a server flow). */
    @LievitAction
    public void close() {
        open = false;
    }
}
