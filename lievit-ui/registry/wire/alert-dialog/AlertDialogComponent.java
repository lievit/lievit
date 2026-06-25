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
 * {@code alert-dialog}: the server-first WIRE confirm-modal, the {@code role="alertdialog"}
 * specialization of the dialog wire (ADR-0012, Wave 3). It is the interruptive prompt that demands
 * a response (delete this? discard changes?): a title, a description, a destructive-or-primary
 * confirm button and a cancel button, whose open-state lives here in typed Java, not in client
 * memory. The server re-renders the template on {@link #open()} / {@link #confirm()} /
 * {@link #cancel()} and the client morphs the result.
 *
 * <p>WHY a separate component and not the plain {@link DialogComponent}: WAI-ARIA distinguishes
 * {@code role="dialog"} (general) from {@code role="alertdialog"} (an interruptive prompt requiring
 * a response). A confirm is the alertdialog case, so the template sets {@code role="alertdialog"}
 * and the footer is NOT an owned free-form region but two real, named buttons (the destructive
 * action + cancel) wired with {@code l:click}. It builds ON the dialog wire's model (the same
 * server-held open-state + the owned-body finding from Wave 2), specialized for the confirm shape.
 *
 * <p>WHY it composes the dialog wire's STRUCTURE rather than the dialog COMPONENT: a wire template
 * is rendered with ONLY its own {@code @Wire} fields + {@code _component} (JteTemplateAdapter, the
 * Wave 0 finding), so one wire component cannot render another wire component as a nested live
 * instance with a fresh snapshot. The server-first equivalent of "compose the dialog" is therefore
 * to render the dialog's overlay/panel STRUCTURE (the {@code role}, the {@code aria-modal}, the
 * {@code hidden}-when-closed overlay, the title/description header) inside this component's own
 * owned template, specialized to {@code role="alertdialog"} with the confirm footer. The result is
 * a single self-contained wire component with no {@code <lv-dialog>} reference anywhere.
 *
 * <p>Convention (blueprint 1.b): state is {@code @Wire public} fields; the actions are
 * {@code @LievitAction} methods; the modal a11y (WAI-ARIA APG alertdialog: {@code role=alertdialog},
 * {@code aria-modal}, {@code aria-labelledby} -> the title, {@code aria-describedby} -> the
 * description) lives in the template. {@code title} + {@code description} + the button labels +
 * {@code open} round-trip; {@code destructive} is locked so a client cannot downgrade a
 * server-mandated destructive confirm to a benign one (or vice-versa) by editing the snapshot.
 *
 * <p>WHAT happens on confirm is the adopter's: {@link #confirmed} is a wire flag the host page reads
 * after the round-trip (or the adopter overrides {@link #confirm()} to run the destructive operation
 * server-side, with authz, before closing). Either way the server stays the single owner of the
 * outcome; the client only fires the action.
 *
 * <p>Copied in by {@code lievit add alert-dialog}: the adopter OWNS this class (rename it, move the
 * package, do the real work in {@link #confirm()} with server-side authz) AND the
 * {@code alert-dialog.jte} template.
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
     * triangle-alert icon. Locked so a client cannot flip a server-mandated destructive confirm to a
     * benign one (or vice-versa) by editing the snapshot payload.
     */
    @Wire
    @LievitProperty(locked = true)
    public boolean destructive = false;

    /**
     * Set true once {@link #confirm()} has run, false again on {@link #cancel()} / {@link #open()}.
     * The host page reads this after the round-trip to learn the outcome; an adopter that does the
     * destructive work directly in {@link #confirm()} can ignore it.
     */
    @Wire
    public boolean confirmed = false;

    /** Opens the prompt, clearing any prior outcome so a re-open starts unanswered. */
    @LievitAction
    public void open() {
        confirmed = false;
        open = true;
    }

    /**
     * Confirms the prompt: records the outcome and closes. The adopter overrides this to run the
     * destructive operation server-side (with authz) before it closes; doing it here keeps the
     * server the single owner of the outcome.
     */
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
