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
 * {@code dialog}: the server-first WIRE replacement for the {@code <lv-dialog>} Lit island
 * (ADR-0012). An accessible modal dialog whose open/closed state lives here in typed Java, not in
 * client memory; the server re-renders the template on each {@link #open()} / {@link #close()} and
 * the client morphs the result.
 *
 * <p>WHY server-state: the island held {@code open} in a Lit reactive property and projected the
 * body through native {@code <slot>}s, which are inert in light DOM, so the body silently never
 * rendered (the bug ADR-0012 was written to kill). Here {@code open} is a {@code @Wire} boolean
 * round-tripped in the signed snapshot, and the body + footer are plain server-rendered JTE regions
 * OWNED by the template: they cannot fail to project.
 *
 * <p>Convention (blueprint 1.b): state is {@code @Wire public} fields; the actions are
 * {@code @LievitAction} methods; the modal a11y (WAI-ARIA APG dialog: {@code role=dialog},
 * {@code aria-modal}, {@code aria-labelledby} / {@code aria-describedby}) lives in the template.
 * {@code heading} + {@code description} + {@code open} round-trip; {@code dismissible} is locked so
 * a client cannot turn a server-locked (non-dismissible) dialog into a dismissible one by editing
 * the snapshot payload.
 *
 * <p>Focus-trap + Escape + return-focus are a CSP-clean Stimulus controller (the {@code lv-modal}
 * controller from lievit-ui's runtime), keyed off the rendered {@code data-lv-modal-open-value} the
 * wire morph rewrites: the open-state itself stays server-owned (wire), only the focus mechanics are
 * client. Escape fires the {@code close} action via {@code data-lv-wire-close}; the backdrop + close
 * button fire it via their own {@code l:click}.
 *
 * <p>Copied in by {@code lievit add dialog}: the adopter OWNS this class (rename it, move the
 * package, gate {@link #open()} on a server-side condition) AND the {@code dialog.jte} template
 * (the body + footer regions are theirs to fill).
 */
@LievitComponent(template = "lievit/dialog")
public class DialogComponent {

    /** Open state: the single piece of modal state, held server-side. */
    @Wire
    public boolean open = false;

    /** Dialog title; wired to {@code aria-labelledby}. Empty hides the header. Round-trips. */
    @Wire
    public String heading = "";

    /** Optional supporting line; wired to {@code aria-describedby}. Round-trips. */
    @Wire
    public String description = "";

    /**
     * When true a backdrop click / Escape closes the dialog. Locked so a client cannot flip a
     * server-mandated (non-dismissible) dialog to dismissible by editing the snapshot payload.
     */
    @Wire
    @LievitProperty(locked = true)
    public boolean dismissible = true;

    /** Opens the dialog. */
    @LievitAction
    public void open() {
        open = true;
    }

    /**
     * Closes the dialog. The backdrop / Escape paths route here only when {@link #dismissible}; the
     * explicit close button always closes. Closing is unconditional server-side so the server stays
     * the single owner of the state.
     */
    @LievitAction
    public void close() {
        open = false;
    }
}
