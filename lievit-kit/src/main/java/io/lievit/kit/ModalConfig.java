/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The modal configuration of an action (the Filament {@code CanOpenModal}): heading, description,
 * width, slide-over vs centred, the submit and cancel labels, and the close-on-click-away / escape
 * affordances. Custom content above and below the (optional) schema is carried as opaque view
 * fragment names the host renders.
 *
 * <p>The host (a Lit island via the core's nested components) reads this to render the modal; the
 * kit holds the intent.
 *
 * @param heading the modal heading, or {@code null}
 * @param description the modal description, or {@code null}
 * @param width the modal width token (e.g. {@code "md"}, {@code "lg"}, {@code "xl"})
 * @param slideOver whether the modal slides over from the side rather than centring
 * @param submitLabel the submit button label
 * @param cancelLabel the cancel button label
 * @param closeByClickingAway whether clicking the backdrop closes the modal
 * @param closeByEscaping whether the escape key closes the modal
 */
public record ModalConfig(
        @Nullable String heading,
        @Nullable String description,
        String width,
        boolean slideOver,
        String submitLabel,
        String cancelLabel,
        boolean closeByClickingAway,
        boolean closeByEscaping) {

    /** Compact constructor: defends the required tokens. */
    public ModalConfig {
        Objects.requireNonNull(width, "width");
        Objects.requireNonNull(submitLabel, "submitLabel");
        Objects.requireNonNull(cancelLabel, "cancelLabel");
    }

    /**
     * @return the default modal config (medium, centred, close-on-away/escape, Submit/Cancel)
     */
    public static ModalConfig defaults() {
        return new ModalConfig(null, null, "md", false, "Submit", "Cancel", true, true);
    }

    /**
     * @param value the modal heading
     * @return a copy with the heading set
     */
    public ModalConfig heading(String value) {
        return new ModalConfig(
                value, description, width, slideOver, submitLabel, cancelLabel,
                closeByClickingAway, closeByEscaping);
    }

    /**
     * @param value the modal description
     * @return a copy with the description set
     */
    public ModalConfig description(String value) {
        return new ModalConfig(
                heading, value, width, slideOver, submitLabel, cancelLabel,
                closeByClickingAway, closeByEscaping);
    }

    /**
     * @param value the width token
     * @return a copy with the width set
     */
    public ModalConfig width(String value) {
        return new ModalConfig(
                heading, description, value, slideOver, submitLabel, cancelLabel,
                closeByClickingAway, closeByEscaping);
    }

    /**
     * @return a copy that slides over from the side
     */
    public ModalConfig asSlideOver() {
        return new ModalConfig(
                heading, description, width, true, submitLabel, cancelLabel,
                closeByClickingAway, closeByEscaping);
    }

    /**
     * @param submit the submit button label
     * @param cancel the cancel button label
     * @return a copy with the footer labels set
     */
    public ModalConfig footer(String submit, String cancel) {
        return new ModalConfig(
                heading, description, width, slideOver, submit, cancel,
                closeByClickingAway, closeByEscaping);
    }
}
