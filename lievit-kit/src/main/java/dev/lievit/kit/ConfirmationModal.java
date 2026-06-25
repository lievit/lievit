/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The configuration of an action's confirmation modal (the Filament {@code CanRequireConfirmation}
 * modal defaults): heading, description, the submit and cancel button labels, and the modal icon.
 * Pure data the host renders as a real modal (a Lit island via the core's nested components); the
 * confirm button invokes the action, cancel closes the modal.
 *
 * @param heading the modal heading
 * @param description the modal description, or {@code null}
 * @param submitLabel the confirm button label
 * @param cancelLabel the cancel button label
 * @param icon the modal icon name
 */
public record ConfirmationModal(
        String heading,
        @Nullable String description,
        String submitLabel,
        String cancelLabel,
        String icon) {

    /** Compact constructor: defends the required labels. */
    public ConfirmationModal {
        Objects.requireNonNull(heading, "heading");
        Objects.requireNonNull(submitLabel, "submitLabel");
        Objects.requireNonNull(cancelLabel, "cancelLabel");
        Objects.requireNonNull(icon, "icon");
    }

    /**
     * @param newHeading the modal heading
     * @return a copy with the heading replaced
     */
    public ConfirmationModal heading(String newHeading) {
        return new ConfirmationModal(newHeading, description, submitLabel, cancelLabel, icon);
    }

    /**
     * @param newDescription the modal description
     * @return a copy with the description replaced
     */
    public ConfirmationModal description(@Nullable String newDescription) {
        return new ConfirmationModal(heading, newDescription, submitLabel, cancelLabel, icon);
    }

    /**
     * @param label the confirm button label
     * @return a copy with the submit label replaced
     */
    public ConfirmationModal submitLabel(String label) {
        return new ConfirmationModal(heading, description, label, cancelLabel, icon);
    }

    /**
     * @param iconName the modal icon name
     * @return a copy with the icon replaced
     */
    public ConfirmationModal icon(String iconName) {
        return new ConfirmationModal(heading, description, submitLabel, cancelLabel, iconName);
    }
}
