/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.List;

import org.jspecify.annotations.Nullable;

/**
 * The outcome of running an {@link AdminAction}. Four shapes:
 *
 * <ul>
 *   <li><strong>completed</strong>: the action ran (and emitted its flash + redirect effects); the
 *       page component need do nothing more.
 *   <li><strong>navigate</strong>: the action is a pure navigation (the Filament {@code Action::url()}):
 *       it wrote nothing and asks the host to go to {@link #redirect()} (open a detail page, the
 *       calendar on a date, an external link). The navigation effect is queued onto the sink like a
 *       completed redirect, but the shape stays distinct so the host can branch (e.g. open in a new
 *       tab) without inspecting the URL.
 *   <li><strong>invalid</strong>: a save was blocked by submit-time validation; the page re-renders
 *       the form with {@link #errors()} (no redirect).
 *   <li><strong>forbidden</strong>: the {@link AdminAuthorizer} denied the operation; the page shows
 *       a forbidden notice (no write happened).
 * </ul>
 *
 * @param status which of the four shapes this is
 * @param errors the validation errors when {@code status == INVALID}; empty otherwise
 * @param redirect the redirect/navigation URL the action emitted (informational; the effect is
 *     already queued), or {@code null}
 * @param newTab whether a {@code NAVIGATE} outcome opens in a new browser tab ({@code false} for the
 *     other shapes)
 */
public record AdminActionResult(
        Status status, List<FieldError> errors, @Nullable String redirect, boolean newTab) {

    /** The four outcome shapes. */
    public enum Status {
        /** The action ran to completion (effects emitted). */
        COMPLETED,
        /** The action is a pure navigation to {@code redirect()} (the Filament {@code Action::url()}). */
        NAVIGATE,
        /** A save was blocked by validation (re-render the form with the errors). */
        INVALID,
        /** The authorizer denied the operation. */
        FORBIDDEN,
        /** A {@code before()} hook (or the body) halted the action: no write, no redirect. */
        HALTED
    }

    /** Compact constructor: defends the error list. */
    public AdminActionResult {
        errors = List.copyOf(errors);
    }

    /**
     * Back-compat 3-arg constructor (same tab): a non-navigation result, or a same-tab navigation.
     *
     * @param status the outcome shape
     * @param errors the validation errors (for {@code INVALID})
     * @param redirect the redirect/navigation URL, or {@code null}
     */
    public AdminActionResult(Status status, List<FieldError> errors, @Nullable String redirect) {
        this(status, errors, redirect, false);
    }

    /**
     * @param redirect the redirect URL emitted on completion
     * @return a completed result
     */
    public static AdminActionResult completed(@Nullable String redirect) {
        return new AdminActionResult(Status.COMPLETED, List.of(), redirect);
    }

    /**
     * A pure navigation outcome (the Filament {@code Action::url()}): the host navigates to
     * {@code url} in the same tab. No write happened.
     *
     * @param url the navigation target (must be non-blank)
     * @return a navigate result
     */
    public static AdminActionResult navigate(String url) {
        return navigate(url, false);
    }

    /**
     * A pure navigation outcome that may open in a new tab (the Filament
     * {@code Action::url($url, shouldOpenInNewTab: true)}).
     *
     * @param url the navigation target (must be non-blank)
     * @param newTab whether the host opens the URL in a new browser tab
     * @return a navigate result
     */
    public static AdminActionResult navigate(String url, boolean newTab) {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("a NAVIGATE result must carry a non-blank url");
        }
        return new AdminActionResult(Status.NAVIGATE, List.of(), url, newTab);
    }

    /**
     * @param errors the validation errors that blocked the save (non-empty)
     * @return an invalid result
     */
    public static AdminActionResult invalid(List<FieldError> errors) {
        if (errors.isEmpty()) {
            throw new IllegalArgumentException("an INVALID result must carry at least one error");
        }
        return new AdminActionResult(Status.INVALID, errors, null);
    }

    /**
     * @return a forbidden result
     */
    public static AdminActionResult forbidden() {
        return new AdminActionResult(Status.FORBIDDEN, List.of(), null);
    }

    /**
     * A halted result (the Filament {@code $action->halt()}): a {@code before()} hook (or the body)
     * stopped the action before it wrote or redirected.
     *
     * @return a halted result
     */
    public static AdminActionResult halted() {
        return new AdminActionResult(Status.HALTED, List.of(), null);
    }

    /** @return whether a hook (or the body) halted the action */
    public boolean isHalted() {
        return status == Status.HALTED;
    }

    /** @return whether the action ran to completion */
    public boolean isCompleted() {
        return status == Status.COMPLETED;
    }

    /** @return whether the action is a pure navigation (the Filament {@code Action::url()}) */
    public boolean isNavigation() {
        return status == Status.NAVIGATE;
    }
}
