/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.component;

import java.util.Objects;

import io.lievit.kit.support.Width;

/**
 * The modal view-model (the Filament {@code ModalComponent} carried over): the shared modal shell
 * every action modal, confirmation, and view modal renders through. It honors the Filament close
 * affordances explicitly: a close button, close-by-clicking-away, close-by-escaping, and autofocus,
 * each a flag the JTE modal partial reads.
 *
 * <p>This is the presentation shell only; the action-level modal config (heading + footer labels +
 * slide-over) lives on {@link io.lievit.kit.ModalConfig}, which an action carries. {@link
 * ComponentViews#forModalConfig} bridges the two so an action's modal renders through this shell.
 */
public final class ModalView {

    private final String heading;
    private Width width = Width.MEDIUM;
    private boolean closeButton = true;
    private boolean closeByClickingAway = true;
    private boolean closeByEscaping = true;
    private boolean autofocus = true;

    private ModalView(String heading) {
        this.heading = Objects.requireNonNull(heading, "heading");
    }

    /**
     * @param heading the modal heading
     * @return a modal view with the default affordances (all close paths on, autofocus on)
     */
    public static ModalView make(String heading) {
        return new ModalView(heading);
    }

    /**
     * @param w the modal width
     * @return this view
     */
    public ModalView width(Width w) {
        this.width = Objects.requireNonNull(w, "w");
        return this;
    }

    /**
     * @param value whether the modal shows an explicit close button
     * @return this view
     */
    public ModalView closeButton(boolean value) {
        this.closeButton = value;
        return this;
    }

    /**
     * @param value whether clicking the backdrop closes the modal
     * @return this view
     */
    public ModalView closeByClickingAway(boolean value) {
        this.closeByClickingAway = value;
        return this;
    }

    /**
     * @param value whether the escape key closes the modal
     * @return this view
     */
    public ModalView closeByEscaping(boolean value) {
        this.closeByEscaping = value;
        return this;
    }

    /**
     * @param value whether the modal autofocuses its first focusable element on open
     * @return this view
     */
    public ModalView autofocus(boolean value) {
        this.autofocus = value;
        return this;
    }

    /** @return the modal heading */
    public String heading() {
        return heading;
    }

    /** @return the modal width */
    public Width width() {
        return width;
    }

    /** @return whether the modal shows a close button */
    public boolean hasCloseButton() {
        return closeButton;
    }

    /** @return whether clicking the backdrop closes the modal */
    public boolean closesByClickingAway() {
        return closeByClickingAway;
    }

    /** @return whether escape closes the modal */
    public boolean closesByEscaping() {
        return closeByEscaping;
    }

    /** @return whether the modal autofocuses on open */
    public boolean autofocuses() {
        return autofocus;
    }
}
