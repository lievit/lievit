/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit.hello;

import java.util.LinkedHashMap;
import java.util.Map;

import com.iambilotta.lievit.LievitAction;
import com.iambilotta.lievit.LievitComponent;
import com.iambilotta.lievit.LievitProperty;
import com.iambilotta.lievit.Wire;
import com.iambilotta.lievit.component.LievitEffects;
import com.iambilotta.lievit.kit.AdminAuthorizer;
import com.iambilotta.lievit.kit.AdminFormView;
import com.iambilotta.lievit.kit.page.FormPageDriver;

/**
 * The worked-example <strong>Create</strong> page component: declares its own wire fields + actions
 * and delegates to {@link FormPageDriver}. The {@code state} map holds the submitted field values
 * ({@code l:model="state.city"}); {@code save} validates + persists, flashing + redirecting on
 * success and re-rendering with field errors on a validation failure.
 */
@LievitComponent(template = "admin/listing-form")
public class ListingCreateComponent implements FormPage {

    private final FormPageDriver<Listing> driver;

    @Wire Map<String, String> state = new LinkedHashMap<>();
    // Server-derived view-model: NOT serialized (a complex record cannot round-trip the generic-Map
    // codec; rebuilt each call from the form + submitted state instead).
    @Wire @LievitProperty(serialize = false) AdminFormView view;
    @Wire @LievitProperty(locked = true) String listUrl;
    // Mirror the edit component's shape so both pages share one form template.
    @Wire @LievitProperty(locked = true) String recordId = "";
    @Wire @LievitProperty(locked = true) boolean editing = false;

    /**
     * @param resource the listings resource, injected by Spring
     */
    public ListingCreateComponent(ListingResource resource) {
        this.driver = new FormPageDriver<>(resource, "admin", AdminAuthorizer.permitAll());
        this.view = driver.createView();
        this.listUrl = driver.routes().list();
    }

    @LievitAction
    void save() {
        FormPageDriver.Outcome outcome = driver.submitCreate(state, LievitEffects.current());
        if (!outcome.isCompleted() && outcome.reRender() != null) {
            this.view = outcome.reRender();
        }
    }

    @Override
    public AdminFormView view() {
        return view;
    }
}
