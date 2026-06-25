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
 * {@code drawer}: the server-first WIRE replacement for the {@code <lv-drawer>} Lit island
 * (ADR-0012). A modal side panel anchored to one viewport edge whose open/closed state lives here
 * in typed Java, not in client memory; the server re-renders the template on each {@link #open()} /
 * {@link #close()} and the client morphs the result.
 *
 * <p>It is the same modal-dialog model as {@link DialogComponent} (open-state server, body owned in
 * the template, focus-trap + Escape a typed-TS enhancement), presented as an edge-anchored sheet
 * rather than a centred modal. {@link SheetComponent} is the richer four-side generalisation with a
 * structured header / description / footer; the drawer keeps the minimal heading + body shape.
 *
 * <p>WHY server-state: the island held {@code open} in a Lit reactive property and projected the
 * body through a native {@code <slot>}, inert in light DOM, so the body silently never rendered (the
 * bug ADR-0012 was written to kill). Here {@code open} is a {@code @Wire} boolean round-tripped in
 * the signed snapshot and the body is plain server-rendered JTE: it cannot fail to project.
 *
 * <p>Convention (blueprint 1.b): state in {@code @Wire public} fields; the actions
 * {@code @LievitAction} methods; the modal a11y (WAI-ARIA APG dialog) in the template. {@code side}
 * + {@code heading} + {@code open} round-trip; {@code dismissible} is locked so a client cannot turn
 * a server-mandated (non-dismissible) drawer into a dismissible one by editing the snapshot.
 *
 * <p>Copied in by {@code lievit add drawer}: the adopter OWNS this class AND the {@code drawer.jte}
 * template (the body region is theirs to fill).
 */
@LievitComponent(template = "lievit/drawer")
public class DrawerComponent {

    /** Open state: the single piece of modal state, held server-side. */
    @Wire
    public boolean open = false;

    /** Which edge the drawer slides in from: {@code "right" | "left" | "top" | "bottom"}. */
    @Wire
    public String side = "right";

    /** Panel title; wired to {@code aria-labelledby}. Empty hides the header. Round-trips. */
    @Wire
    public String heading = "";

    /**
     * When true a backdrop click / Escape closes the drawer. Locked so a client cannot flip a
     * server-mandated (non-dismissible) drawer to dismissible by editing the snapshot payload.
     */
    @Wire
    @LievitProperty(locked = true)
    public boolean dismissible = true;

    /** Opens the drawer. */
    @LievitAction
    public void open() {
        open = true;
    }

    /** Closes the drawer. Unconditional server-side so the server stays the single owner. */
    @LievitAction
    public void close() {
        open = false;
    }
}
