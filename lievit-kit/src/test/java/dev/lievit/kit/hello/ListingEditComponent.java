/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.hello;

import java.util.LinkedHashMap;
import java.util.Map;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitProperty;
import dev.lievit.Wire;
import dev.lievit.component.LievitEffects;
import dev.lievit.kit.AdminAuthorizer;
import dev.lievit.kit.AdminFormView;
import dev.lievit.kit.DeleteAction;
import dev.lievit.kit.page.FormPageDriver;
import dev.lievit.kit.page.ListPageDriver;

/**
 * The worked-example <strong>Edit</strong> page component: prefilled from the record by id, with the
 * save (edit) action and the header delete action. Declares its own wire fields + actions and
 * delegates to {@link FormPageDriver} (save) and {@link ListPageDriver} (delete).
 *
 * <p>The host controller seeds {@link #recordId} from the {@code /{id}/edit} path before mount; in a
 * head-less wire test the id rides the first {@code _updates} (it is a settable {@code @Wire} field)
 * and {@code load} prefills.
 */
@LievitComponent(template = "admin/listing-form")
public class ListingEditComponent implements FormPage {

    private final FormPageDriver<Listing> formDriver;
    private final ListPageDriver<Listing> listDriver;

    @Wire String recordId = "";
    @Wire Map<String, String> state = new LinkedHashMap<>();
    // Server-derived view-model: NOT serialized (complex record; rebuilt each call).
    @Wire @LievitProperty(serialize = false) AdminFormView view;
    @Wire @LievitProperty(locked = true) String listUrl;
    @Wire @LievitProperty(locked = true) boolean editing = true;

    /**
     * @param resource the listings resource, injected by Spring
     */
    public ListingEditComponent(ListingResource resource) {
        AdminAuthorizer authorizer = AdminAuthorizer.permitAll();
        this.formDriver = new FormPageDriver<>(resource, "admin", authorizer);
        this.listDriver = new ListPageDriver<>(resource, "admin", authorizer);
        this.view = formDriver.createView();
        this.listUrl = formDriver.routes().list();
    }

    /** Prefills the form from the record named by {@link #recordId}. */
    @LievitAction
    void load() {
        FormPageDriver.Prefill prefill = formDriver.editPrefill(recordId);
        this.state = new LinkedHashMap<>(prefill.state());
        this.view = prefill.view();
    }

    @LievitAction
    void save() {
        FormPageDriver.Outcome outcome = formDriver.submitEdit(recordId, state, LievitEffects.current());
        if (!outcome.isCompleted() && outcome.reRender() != null) {
            this.view = outcome.reRender();
        }
    }

    /** The header {@link DeleteAction}: deletes this record and redirects to the list. */
    @LievitAction
    void delete() {
        listDriver.delete(recordId, LievitEffects.current());
    }

    @Override
    public AdminFormView view() {
        return view;
    }
}
