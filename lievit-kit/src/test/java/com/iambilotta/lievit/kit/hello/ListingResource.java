/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit.hello;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import com.iambilotta.lievit.kit.Form;
import com.iambilotta.lievit.kit.FormBinder;
import com.iambilotta.lievit.kit.FormValidator;
import com.iambilotta.lievit.kit.RecordRepository;
import com.iambilotta.lievit.kit.Resource;
import com.iambilotta.lievit.kit.ResourcePages;
import com.iambilotta.lievit.kit.Table;
import com.iambilotta.lievit.kit.TextField;

import jakarta.validation.Validator;

import org.jspecify.annotations.Nullable;

/**
 * The hello-admin worked example: one {@link Resource} for the {@link Listing} entity exercising the
 * whole CRUD spine end to end. Instance-based (it takes its repository + validator by constructor
 * injection) and persistence-agnostic (it never touches a DB directly).
 *
 * <p>The form declares a {@link FormBinder} (the typed state-to-record mapping) and a
 * {@link FormValidator} (submit-time Jakarta Bean Validation over {@link Listing}), and the resource
 * declares its three page components via {@link #pages()}.
 */
public final class ListingResource extends Resource<Listing> {

    private final Validator validator;

    /**
     * @param repository the adopter-supplied data port
     * @param validator the Jakarta validator (the autoconfigured bean in a Spring app)
     */
    public ListingResource(RecordRepository<Listing> repository, Validator validator) {
        super(repository);
        this.validator = validator;
    }

    @Override
    public String slug() {
        return "listings";
    }

    @Override
    public String label() {
        return "Listings";
    }

    @Override
    public Table<Listing> table() {
        return Table.<Listing>create()
                .heading("Listings")
                .id(l -> String.valueOf(l.ref()))
                .column("Ref", Listing::ref)
                .column("City", Listing::city);
    }

    @Override
    public Form<Listing> form() {
        return Form.<Listing>create()
                .heading("Listing")
                .field(TextField.make("city"))
                .binder(new ListingBinder())
                .validator(new FormValidator(validator));
    }

    @Override
    public Optional<ResourcePages> pages() {
        return Optional.of(
                ResourcePages.of(
                        ListingListComponent.class,
                        ListingCreateComponent.class,
                        ListingEditComponent.class));
    }

    /** Maps the form's {@code city} string field to and from a {@link Listing}. */
    static final class ListingBinder implements FormBinder<Listing> {
        @Override
        public Listing toRecord(@Nullable Listing existing, Map<String, String> state) {
            long ref = existing == null ? 0 : existing.ref();
            String city = state.getOrDefault("city", "").trim();
            return new Listing(ref, city);
        }

        @Override
        public Map<String, String> toState(Listing record) {
            Map<String, String> state = new LinkedHashMap<>();
            state.put("city", record.city());
            return state;
        }
    }
}
