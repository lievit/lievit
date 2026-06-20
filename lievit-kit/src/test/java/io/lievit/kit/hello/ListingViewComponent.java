/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.hello;

import org.jspecify.annotations.Nullable;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitProperty;
import io.lievit.Wire;
import io.lievit.kit.AdminAuthorizer;
import io.lievit.kit.AdminViewView;
import io.lievit.kit.page.ViewPageDriver;

/**
 * The worked-example <strong>View</strong> (detail) page component: a concrete
 * {@code @LievitComponent} that declares its own wire fields + actions (the lievit core binds only
 * members declared on the component class itself) and delegates the logic to {@link ViewPageDriver}.
 *
 * <p>It is the read-only peer of {@link ListingEditComponent}: the host controller seeds
 * {@link #recordId} from the {@code /{id}} detail path before mount; in a head-less wire test the id
 * rides the first {@code _updates} (it is a settable {@code @Wire} field) and {@code load} resolves
 * the {@link AdminViewView} (the resolved infolist sections + the header actions) which the
 * {@code admin/listing-view} template paints.
 */
@LievitComponent(template = "admin/listing-view")
public class ListingViewComponent {

    private final ViewPageDriver<Listing> driver;

    @Wire String recordId = "";
    // Server-derived view-model: NOT serialized (a complex record cannot round-trip the generic-Map
    // snapshot codec; it is rebuilt from the repository on load instead).
    @Wire @LievitProperty(serialize = false) @Nullable AdminViewView view;
    @Wire boolean notFound = false;
    @Wire boolean forbidden = false;

    /**
     * @param resource the listings resource, injected by Spring
     */
    public ListingViewComponent(ListingResource resource) {
        this.driver = new ViewPageDriver<>(resource, "admin", AdminAuthorizer.permitAll());
    }

    /** Resolves the detail view-model for {@link #recordId}: found / not-found / forbidden. */
    @LievitAction
    void load() {
        ViewPageDriver.Resolution resolution = driver.view(recordId);
        this.notFound = resolution.status() == ViewPageDriver.Resolution.Status.NOT_FOUND;
        this.forbidden = resolution.status() == ViewPageDriver.Resolution.Status.FORBIDDEN;
        this.view = resolution.view();
    }

    /**
     * @return the resolved detail view-model, or {@code null} before {@code load} (or when the record
     *     was not found / forbidden); read off the live instance because a complex record cannot
     *     round-trip the snapshot codec
     */
    public @Nullable AdminViewView view() {
        return view;
    }

    /** @return whether the last load found no record */
    public boolean notFound() {
        return notFound;
    }

    /** @return whether the last load was forbidden */
    public boolean forbidden() {
        return forbidden;
    }
}
