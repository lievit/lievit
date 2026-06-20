/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The modal configuration of an action (the Filament {@code CanOpenModal}): heading, description,
 * width (a {@link ModalWidth} enum), slide-over vs centred, an icon with its colour and a
 * heading/footer alignment, the submit and cancel labels, the close-on-click-away / escape
 * affordances and a close-button toggle, sticky header / footer, opaque {@code modalContent}
 * fragments above and below the schema, and extra footer-action labels beside Submit/Cancel.
 *
 * <p>The host (a Lit island via the core's nested components) reads this to render the modal; the
 * kit holds the intent. Custom content above/below the (optional) schema is carried as opaque view
 * fragment names the host renders ({@link #contentAbove} / {@link #contentBelow}).
 *
 * @param heading the modal heading, or {@code null}
 * @param description the modal description, or {@code null}
 * @param width the modal width (a closed {@link ModalWidth} enum)
 * @param slideOver whether the modal slides over from the side rather than centring
 * @param icon the modal heading icon name, or {@code null}
 * @param iconColor the modal icon colour (e.g. {@code "danger"}), or {@code null} for the default
 * @param alignment the heading/footer alignment ({@code "start"} / {@code "center"})
 * @param submitLabel the submit button label
 * @param cancelLabel the cancel button label
 * @param closeByClickingAway whether clicking the backdrop closes the modal
 * @param closeByEscaping whether the escape key closes the modal
 * @param closeButton whether the modal renders an explicit close (x) button
 * @param stickyHeader whether the header stays pinned while the body scrolls
 * @param stickyFooter whether the footer stays pinned while the body scrolls
 * @param contentAbove an opaque content fragment name rendered above the schema, or {@code null}
 * @param contentBelow an opaque content fragment name rendered below the schema, or {@code null}
 * @param extraFooterActions extra footer-action labels rendered beside Submit/Cancel, in order
 */
public record ModalConfig(
        @Nullable String heading,
        @Nullable String description,
        ModalWidth width,
        boolean slideOver,
        @Nullable String icon,
        @Nullable String iconColor,
        String alignment,
        String submitLabel,
        String cancelLabel,
        boolean closeByClickingAway,
        boolean closeByEscaping,
        boolean closeButton,
        boolean stickyHeader,
        boolean stickyFooter,
        @Nullable String contentAbove,
        @Nullable String contentBelow,
        List<String> extraFooterActions) {

    /** Compact constructor: defends the required tokens and copies the footer-action list. */
    public ModalConfig {
        Objects.requireNonNull(width, "width");
        Objects.requireNonNull(alignment, "alignment");
        Objects.requireNonNull(submitLabel, "submitLabel");
        Objects.requireNonNull(cancelLabel, "cancelLabel");
        extraFooterActions = List.copyOf(extraFooterActions);
    }

    /**
     * @return the default modal config (medium, centred, close-on-away/escape, a close button,
     *     start-aligned, Submit/Cancel)
     */
    public static ModalConfig defaults() {
        return new ModalConfig(
                null, null, ModalWidth.MEDIUM, false, null, null, "start", "Submit", "Cancel",
                true, true, true, false, false, null, null, List.of());
    }

    /**
     * @param value the modal heading
     * @return a copy with the heading set
     */
    public ModalConfig heading(String value) {
        return new ModalConfig(
                value, description, width, slideOver, icon, iconColor, alignment, submitLabel,
                cancelLabel, closeByClickingAway, closeByEscaping, closeButton, stickyHeader,
                stickyFooter, contentAbove, contentBelow, extraFooterActions);
    }

    /**
     * @param value the modal description
     * @return a copy with the description set
     */
    public ModalConfig description(String value) {
        return new ModalConfig(
                heading, value, width, slideOver, icon, iconColor, alignment, submitLabel,
                cancelLabel, closeByClickingAway, closeByEscaping, closeButton, stickyHeader,
                stickyFooter, contentAbove, contentBelow, extraFooterActions);
    }

    /**
     * Sets the modal width from the closed {@link ModalWidth} enum (the Filament
     * {@code modalWidth(MaxWidth::...)} parity).
     *
     * @param value the width
     * @return a copy with the width set
     */
    public ModalConfig width(ModalWidth value) {
        return new ModalConfig(
                heading, description, Objects.requireNonNull(value, "value"), slideOver, icon,
                iconColor, alignment, submitLabel, cancelLabel, closeByClickingAway, closeByEscaping,
                closeButton, stickyHeader, stickyFooter, contentAbove, contentBelow,
                extraFooterActions);
    }

    /**
     * Back-compat string width: resolves the token to a {@link ModalWidth} (unknown tokens default
     * to medium).
     *
     * @param token the width token (e.g. {@code "lg"})
     * @return a copy with the width set
     */
    public ModalConfig width(String token) {
        return width(ModalWidth.fromToken(token));
    }

    /**
     * @return a copy that slides over from the side (and defaults the width to full-screen, the
     *     filament slide-over default, unless already widened)
     */
    public ModalConfig asSlideOver() {
        return new ModalConfig(
                heading, description, width, true, icon, iconColor, alignment, submitLabel,
                cancelLabel, closeByClickingAway, closeByEscaping, closeButton, stickyHeader,
                stickyFooter, contentAbove, contentBelow, extraFooterActions);
    }

    /**
     * Sets the modal heading icon and its colour (the Filament {@code modalIcon()} /
     * {@code modalIconColor()}).
     *
     * @param iconName the icon name
     * @param color the icon colour (e.g. {@code "danger"})
     * @return a copy with the icon set
     */
    public ModalConfig icon(String iconName, String color) {
        return new ModalConfig(
                heading, description, width, slideOver, Objects.requireNonNull(iconName, "iconName"),
                Objects.requireNonNull(color, "color"), alignment, submitLabel, cancelLabel,
                closeByClickingAway, closeByEscaping, closeButton, stickyHeader, stickyFooter,
                contentAbove, contentBelow, extraFooterActions);
    }

    /**
     * Sets the heading/footer alignment (the Filament {@code modalAlignment()}): {@code "start"} or
     * {@code "center"}.
     *
     * @param value the alignment
     * @return a copy with the alignment set
     */
    public ModalConfig alignment(String value) {
        return new ModalConfig(
                heading, description, width, slideOver, icon, iconColor,
                Objects.requireNonNull(value, "value"), submitLabel, cancelLabel,
                closeByClickingAway, closeByEscaping, closeButton, stickyHeader, stickyFooter,
                contentAbove, contentBelow, extraFooterActions);
    }

    /**
     * @param submit the submit button label
     * @param cancel the cancel button label
     * @return a copy with the footer labels set
     */
    public ModalConfig footer(String submit, String cancel) {
        return new ModalConfig(
                heading, description, width, slideOver, icon, iconColor, alignment, submit, cancel,
                closeByClickingAway, closeByEscaping, closeButton, stickyHeader, stickyFooter,
                contentAbove, contentBelow, extraFooterActions);
    }

    /**
     * Hides the explicit close (x) button (the Filament {@code modalCloseButton(false)}).
     *
     * @return a copy with the close button hidden
     */
    public ModalConfig withoutCloseButton() {
        return new ModalConfig(
                heading, description, width, slideOver, icon, iconColor, alignment, submitLabel,
                cancelLabel, closeByClickingAway, closeByEscaping, false, stickyHeader, stickyFooter,
                contentAbove, contentBelow, extraFooterActions);
    }

    /**
     * Pins the header and footer while the body scrolls (the Filament {@code stickyModalHeader()} /
     * {@code stickyModalFooter()}).
     *
     * @return a copy with sticky header + footer
     */
    public ModalConfig sticky() {
        return new ModalConfig(
                heading, description, width, slideOver, icon, iconColor, alignment, submitLabel,
                cancelLabel, closeByClickingAway, closeByEscaping, closeButton, true, true,
                contentAbove, contentBelow, extraFooterActions);
    }

    /**
     * Sets opaque content-fragment names rendered above and below the schema (the Filament
     * {@code modalContent()} / {@code modalContentFooter()}).
     *
     * @param above the fragment name above the schema, or {@code null}
     * @param below the fragment name below the schema, or {@code null}
     * @return a copy with the content fragments set
     */
    public ModalConfig content(@Nullable String above, @Nullable String below) {
        return new ModalConfig(
                heading, description, width, slideOver, icon, iconColor, alignment, submitLabel,
                cancelLabel, closeByClickingAway, closeByEscaping, closeButton, stickyHeader,
                stickyFooter, above, below, extraFooterActions);
    }

    /**
     * Adds extra footer-action labels rendered beside Submit/Cancel (the Filament
     * {@code extraModalFooterActions()}).
     *
     * @param labels the extra footer-action labels, in order
     * @return a copy with the extra footer actions set
     */
    public ModalConfig extraFooterActions(List<String> labels) {
        return new ModalConfig(
                heading, description, width, slideOver, icon, iconColor, alignment, submitLabel,
                cancelLabel, closeByClickingAway, closeByEscaping, closeButton, stickyHeader,
                stickyFooter, contentAbove, contentBelow, labels);
    }

    /** @return the width token the rendered modal stamps (delegates to the enum) */
    public String widthToken() {
        return width.token();
    }
}
