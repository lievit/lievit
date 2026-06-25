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
 * {@code sheet}: the server-first WIRE replacement for the {@code <lv-sheet>} Lit island
 * (ADR-0012). A modal side panel that slides in from any of the four viewport edges, the
 * shadcn-shaped four-side generalisation of {@link DrawerComponent}: identical open-state-server
 * model, but with a structured header / description / footer + a built-in close button. The open /
 * closed state lives here in typed Java, not in client memory; the server re-renders on each
 * {@link #open()} / {@link #close()} and the client morphs the result.
 *
 * <p>Relationship: drawer is the minimal heading + body edge panel; sheet is the richer
 * composition. Both share the WAI-ARIA APG dialog pattern (role=dialog, aria-modal,
 * aria-labelledby / aria-describedby) and the same server-owned open-state; neither supersedes the
 * other (each is its own copy-in component the adopter chooses between).
 *
 * <p>WHY server-state: the island held {@code open} in a Lit reactive property and projected the
 * body + header + footer through native {@code <slot>}s, inert in light DOM, so they silently never
 * rendered (the bug ADR-0012 was written to kill). Here {@code open} is a {@code @Wire} boolean
 * round-tripped in the signed snapshot and the regions are plain server-rendered JTE: they cannot
 * fail to project.
 *
 * <p>Convention (blueprint 1.b): state in {@code @Wire public} fields; the actions
 * {@code @LievitAction} methods; the modal a11y in the template. {@code side} + {@code heading} +
 * {@code description} + {@code showClose} + {@code open} round-trip; {@code dismissible} is locked
 * so a client cannot turn a server-mandated (non-dismissible) sheet into a dismissible one.
 *
 * <p>Copied in by {@code lievit add sheet}: the adopter OWNS this class AND the {@code sheet.jte}
 * template (the body + footer regions are theirs to fill).
 */
@LievitComponent(template = "lievit/sheet")
public class SheetComponent {

    /** Open state: the single piece of modal state, held server-side. */
    @Wire
    public boolean open = false;

    /** Which edge the sheet slides in from: {@code "right" | "left" | "top" | "bottom"}. */
    @Wire
    public String side = "right";

    /** Panel title; wired to {@code aria-labelledby}. Empty hides the title. Round-trips. */
    @Wire
    public String heading = "";

    /** Panel description; wired to {@code aria-describedby}. Empty omits it. Round-trips. */
    @Wire
    public String description = "";

    /** Render the top-right close button. Round-trips. */
    @Wire
    public boolean showClose = true;

    /**
     * When true a backdrop click / Escape closes the sheet. Locked so a client cannot flip a
     * server-mandated (non-dismissible) sheet to dismissible by editing the snapshot payload.
     */
    @Wire
    @LievitProperty(locked = true)
    public boolean dismissible = true;

    /** Opens the sheet. */
    @LievitAction
    public void open() {
        open = true;
    }

    /** Closes the sheet. Unconditional server-side so the server stays the single owner. */
    @LievitAction
    public void close() {
        open = false;
    }
}
