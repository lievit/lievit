/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit.hello;

import java.util.List;

import com.iambilotta.lievit.LievitComponent;
import com.iambilotta.lievit.LievitMount;
import com.iambilotta.lievit.LievitProperty;
import com.iambilotta.lievit.Wire;

/**
 * The hello-admin list component: a {@code @LievitComponent} that renders the {@link ListingResource}
 * list view through the real lievit runtime and the JTE adapter. It is the single end-to-end
 * tracer-bullet the kit skeleton exists to prove: an {@link com.iambilotta.lievit.kit.AdminResource}
 * -&gt; its data port -&gt; an {@link AdminListView} -&gt; HTML, mounted over the wire service.
 *
 * <p>The three {@code @Wire} fields are locked: they are derived server-side from the resource in
 * {@link #build()} and a client must never overwrite the rendered table state (Livewire
 * {@code #[Locked]} parity, the ADR-0001 amendment).
 */
@LievitComponent(template = "admin/listing-list")
public class ListingAdminListComponent {

    private final ListingResource resource;

    @Wire @LievitProperty(locked = true) String heading = "";
    @Wire @LievitProperty(locked = true) List<String> headers = List.of();
    @Wire @LievitProperty(locked = true) List<AdminListView.Row> rows = List.of();

    /**
     * @param resource the admin resource, injected by Spring
     */
    public ListingAdminListComponent(ListingResource resource) {
        this.resource = resource;
    }

    @LievitMount
    void build() {
        AdminListView view = AdminListView.of(resource);
        this.heading = view.heading();
        this.headers = view.headers();
        this.rows = view.rows();
    }
}
