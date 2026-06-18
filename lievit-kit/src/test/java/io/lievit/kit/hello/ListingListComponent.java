/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.hello;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitProperty;
import io.lievit.LievitRender;
import io.lievit.Wire;
import io.lievit.component.LievitEffects;
import io.lievit.kit.AdminAuthorizer;
import io.lievit.kit.AdminListView;
import io.lievit.kit.page.ListPageDriver;

/**
 * The worked-example <strong>List</strong> page component: a concrete {@code @LievitComponent} that
 * declares its own wire fields + actions (the lievit core binds only members declared on the
 * component class itself) and delegates the logic to {@link ListPageDriver}.
 *
 * <p>It renders the {@link AdminListView} table with the create link, row delete (server-confirmed
 * two-step), and pagination over the wire.
 */
@LievitComponent(template = "admin/listing-list")
public class ListingListComponent {

    private final ListPageDriver<Listing> driver;

    // Server-derived view-model: NOT serialized (a complex record cannot round-trip through the
    // generic-Map snapshot codec; it is rebuilt from the repository on every call instead).
    @Wire @LievitProperty(serialize = false) AdminListView view;
    @Wire @LievitProperty(locked = true) String createUrl;
    @Wire int page = 1;
    @Wire String pendingDeleteId = "";

    /**
     * @param resource the listings resource, injected by Spring
     */
    public ListingListComponent(ListingResource resource) {
        this.driver = new ListPageDriver<>(resource, "admin", AdminAuthorizer.permitAll());
        this.view = driver.view(1);
        this.createUrl = driver.routes().create();
    }

    /**
     * Rebuilds the derived list view on EVERY render (initial mount AND every wire call), the
     * @LievitRender hook the dispatcher invokes at mount and before each call's re-render. NOT
     * @LievitMount: a @LievitProperty(serialize=false) field resets to its constructor default on each
     * stateless re-hydration, and @LievitMount runs ONLY on the first mount, so a re-render driven by
     * anything other than a rebuilding action (e.g. a $set row-arm, which runs no @LievitAction) would
     * render a stale view. Rebuilding here keeps it fresh; the actions only move page / arm the confirm.
     */
    @LievitRender
    void render() {
        this.view = driver.view(page);
        this.page = view.pagination().page(); // AdminListView clamps page to a real one
    }

    @LievitAction
    void next() {
        this.page = page + 1; // render() rebuilds the view; AdminListView clamps an over-run page
    }

    @LievitAction
    void prev() {
        this.page = page - 1;
    }

    @LievitAction
    void cancelDelete() {
        this.pendingDeleteId = "";
    }

    /** Runs the row delete against the armed id: flash + redirect to the list on success. */
    @LievitAction
    void confirmDelete() {
        driver.delete(pendingDeleteId, LievitEffects.current());
        this.pendingDeleteId = "";
    }

    /**
     * The current list view-model, read by the template from the live instance ({@code _instance}).
     * It is exposed as a getter (not via the wire) because a complex record cannot round-trip the
     * generic-Map snapshot codec; the template reads it off the freshly-built instance instead.
     *
     * @return the list view-model
     */
    public AdminListView view() {
        return view;
    }
}
