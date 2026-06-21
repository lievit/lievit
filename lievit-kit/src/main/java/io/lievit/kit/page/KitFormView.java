/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.page;

import io.lievit.kit.AdminFormView;

/**
 * The render-time bundle the kit form template ({@code kit/form.jte}) reads: the bounded
 * {@link AdminFormView} (the pure projection of heading / fields / record-errors the form builder
 * produces) PLUS the render-only facts that depend on the host's URL shape and the current request,
 * which the pure view-model deliberately does not know:
 *
 * <ul>
 *   <li>the {@link #action() POST action url} the native {@code <form>} submits to (the resource's
 *       create or update route), so the form posts JS-off with no wire runtime;
 *   <li>the {@link #cancelUrl() cancel href} the footer's secondary action links back to (the
 *       resource list), a real {@code <a href>};
 *   <li>the {@link #submitLabel() submit} / {@link #cancelLabel() cancel} button labels, so the
 *       footer action row reads correctly for create vs edit without the template deciding copy.
 * </ul>
 *
 * <p>This split keeps {@link AdminFormView} a pure, URL-agnostic projection (testable from the form
 * builder alone) while giving the template ONE typed object that carries everything the canonical
 * Filament form chrome needs. A host (a {@code @LievitComponent}, or {@link KitFormComponent}) builds
 * it with {@link #of(AdminFormView, String)} and layers on the host-specific facts through the
 * withers. It mirrors {@link KitTableView} exactly (the kit-render pattern).
 *
 * @param view the bounded form projection (heading, editing flag, fields, record-level errors)
 * @param action the native {@code <form>} POST action url (the resource's create / update route)
 * @param cancelUrl the cancel-action href back to the resource list; empty hides the cancel button
 * @param submitLabel the submit button label (e.g. {@code "Create"} / {@code "Save"})
 * @param cancelLabel the cancel button label (e.g. {@code "Cancel"})
 */
public record KitFormView(
        AdminFormView view,
        String action,
        String cancelUrl,
        String submitLabel,
        String cancelLabel) {

    /** Compact constructor: never-nulls every string. */
    public KitFormView {
        action = action == null ? "" : action;
        cancelUrl = cancelUrl == null ? "" : cancelUrl;
        submitLabel = submitLabel == null || submitLabel.isBlank() ? defaultSubmitLabel(view) : submitLabel;
        cancelLabel = cancelLabel == null || cancelLabel.isBlank() ? "Cancel" : cancelLabel;
    }

    /**
     * The minimal bundle: the projection plus the POST action, with the default submit / cancel
     * labels (derived from the editing flag) and no cancel href. The host layers the rest on with the
     * withers.
     *
     * @param view the bounded form projection
     * @param action the native {@code <form>} POST action url
     * @return the bundle
     */
    public static KitFormView of(AdminFormView view, String action) {
        return new KitFormView(view, action, "", defaultSubmitLabel(view), "Cancel");
    }

    /**
     * @param cancelUrl the cancel-action href back to the resource list
     * @return a copy carrying the cancel href
     */
    public KitFormView withCancelUrl(String cancelUrl) {
        return new KitFormView(view, action, cancelUrl, submitLabel, cancelLabel);
    }

    /**
     * @param submitLabel the submit button label
     * @return a copy carrying the submit label
     */
    public KitFormView withSubmitLabel(String submitLabel) {
        return new KitFormView(view, action, cancelUrl, submitLabel, cancelLabel);
    }

    /**
     * @param cancelLabel the cancel button label
     * @return a copy carrying the cancel label
     */
    public KitFormView withCancelLabel(String cancelLabel) {
        return new KitFormView(view, action, cancelUrl, submitLabel, cancelLabel);
    }

    /** @return whether a real cancel-action href renders (a cancel url is set) */
    public boolean hasCancelUrl() {
        return !cancelUrl.isBlank();
    }

    /** @return the default submit label for the editing flag ({@code "Save"} edit / {@code "Create"}) */
    private static String defaultSubmitLabel(AdminFormView view) {
        return view != null && view.editing() ? "Save" : "Create";
    }
}
