/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * A pure <strong>URL-navigation</strong> action (the Filament {@code Action::make(...)->url(...)} with
 * no body): running it navigates the host to a URL rather than mutating the domain. The "quick action
 * that opens X" Francesco wants: open a record's detail page, open the calendar on a given date, open
 * an external link.
 *
 * <p>It is the natural shape for a {@link ActionPlacement#HEADER header/toolbar} action whose target
 * is a page ("New", "Open calendar", "Export") and for a per-row "open detail" affordance. The URL is
 * derived through the inherited {@link AdminAction#url(Function) url mapper}; this class only nails the
 * factory so a caller does not have to subclass {@link AdminAction} for the common case. Authorization
 * still runs (under the declared {@link AdminOperation}); the outcome is
 * {@link AdminActionResult#navigate(String)}.
 *
 * @param <T> the resource row type
 */
public final class UrlAction<T> extends AdminAction<T> {

    private UrlAction(String name, String label, AdminOperation operation) {
        super(name, label, operation);
    }

    /**
     * Builds a URL-navigation action to a record-derived URL, gated as a {@code VIEW_LIST} read (the
     * common "open X" case is a read affordance).
     *
     * @param name the stable action name
     * @param label the human button label
     * @param urlMapper maps the (nullable) record to the navigation URL
     * @param <T> the row type
     * @return a new URL-navigation action
     */
    public static <T> UrlAction<T> make(
            String name, String label, Function<@Nullable Object, @Nullable String> urlMapper) {
        UrlAction<T> action = new UrlAction<>(name, label, AdminOperation.VIEW_LIST);
        action.url(Objects.requireNonNull(urlMapper, "urlMapper"));
        return action;
    }

    /**
     * Builds a URL-navigation action to a static URL (a header "Open calendar"/"Export" toolbar
     * button, or a row action whose target ignores the row).
     *
     * @param name the stable action name
     * @param label the human button label
     * @param staticUrl the navigation URL (must be non-blank)
     * @param <T> the row type
     * @return a new URL-navigation action
     */
    public static <T> UrlAction<T> make(String name, String label, String staticUrl) {
        UrlAction<T> action = new UrlAction<>(name, label, AdminOperation.VIEW_LIST);
        action.url(staticUrl);
        return action;
    }

    @Override
    protected @Nullable String defaultColor() {
        return "gray";
    }

    @Override
    protected AdminActionResult perform(AdminActionContext<T> context) {
        // Unreachable in practice: run() short-circuits a url-bearing action before perform().
        // Defends the case where the url mapper yielded null/blank (urlFor empty) for this record.
        throw new IllegalStateException(
                "a UrlAction needs a url; set it with UrlAction.make(name, label, urlMapper)");
    }
}
