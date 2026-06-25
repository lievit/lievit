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
 * Test-fixture copy of the lievit-ui {@code registry/wire/alert-dialog/AlertDialogComponent.java}
 * (ADR-0012, Wave 3), in the kit test wire package so {@link AlertDialogComponentIT} can drive it
 * through the REAL lievit runtime. The registry source is the copy-in original the adopter owns;
 * this mirror proves it mounts + transitions + renders end to end (the slot-bug lesson: a
 * render-asserting test through the real runtime, not a structural one).
 *
 * <p>{@code alert-dialog} is the {@code role="alertdialog"} confirm specialization of the dialog
 * wire: a server-held open-state, a title + description, and a destructive-or-primary confirm button
 * + a cancel button as real {@code l:click} actions. Keep in lockstep with the registry source.
 */
@LievitComponent(template = "lievit/alert-dialog")
public class AlertDialogComponent {

    /** Open state: the single piece of modal state, held server-side. */
    @Wire
    public boolean open = false;

    /** The prompt headline; wired to {@code aria-labelledby}. Round-trips. */
    @Wire
    public String title = "Are you sure?";

    /** The supporting explanation; wired to {@code aria-describedby}. Empty omits it. Round-trips. */
    @Wire
    public String description = "";

    /** The confirm button label. Round-trips. */
    @Wire
    public String actionLabel = "Confirm";

    /** The cancel button label. Round-trips. */
    @Wire
    public String cancelLabel = "Cancel";

    /**
     * When true the confirm button is the destructive (red) affordance + the title carries a
     * triangle-alert icon. Locked so a client cannot flip it by editing the snapshot payload.
     */
    @Wire
    @LievitProperty(locked = true)
    public boolean destructive = false;

    /**
     * Set true once {@link #confirm()} has run, false again on {@link #cancel()} / {@link #open()}.
     * The host page reads this after the round-trip to learn the outcome.
     */
    @Wire
    public boolean confirmed = false;

    /** Opens the prompt, clearing any prior outcome so a re-open starts unanswered. */
    @LievitAction
    public void open() {
        confirmed = false;
        open = true;
    }

    /** Confirms the prompt: records the outcome and closes. */
    @LievitAction
    public void confirm() {
        confirmed = true;
        open = false;
    }

    /** Cancels the prompt: clears the outcome and closes. */
    @LievitAction
    public void cancel() {
        confirmed = false;
        open = false;
    }
}
