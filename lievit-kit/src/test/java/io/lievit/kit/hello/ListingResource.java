/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.hello;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import jakarta.validation.Validator;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.BadgeColumn;
import io.lievit.kit.Form;
import io.lievit.kit.FormBinder;
import io.lievit.kit.FormValidator;
import io.lievit.kit.IconColumn;
import io.lievit.kit.RecordRepository;
import io.lievit.kit.Resource;
import io.lievit.kit.ResourcePages;
import io.lievit.kit.Table;
import io.lievit.kit.TextColumn;
import io.lievit.kit.TextField;
import io.lievit.kit.schema.infolist.Infolist;
import io.lievit.kit.schema.infolist.TextEntry;

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
                // Ref deep-links to the row's edit page: a LinkCell -> real <a href>.
                .column(
                        TextColumn.make("Ref", Listing::ref)
                                .url(l -> "/admin/listings/" + l.ref() + "/edit"))
                .column("City", Listing::city)
                // A coloured badge derived from the city: a BadgeCell rendered by the server-first
                // badge partial as <span class="lv-badge lv-badge--<variant>"> (ADR-0012).
                .column(
                        BadgeColumn.<Listing>make(
                                        "Zone", l -> l.city().length() > 5 ? "large" : "small")
                                .color(zone -> "large".equals(zone) ? "info" : "gray"))
                // An icon derived from the city length: an IconCell rendered by the server-first
                // icon partial as an inline <svg> (ADR-0012), never an <lv-icon> island tag.
                .column(
                        IconColumn.<Listing>make("Big", l -> l.city().length() > 5)
                                .bool("check", "x")
                                .color(v -> Boolean.TRUE.equals(v) ? "success" : "muted"));
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
    public Optional<Infolist> infolist() {
        // The detail (View) page over one listing: ref + city, two columns. Resolved against the
        // Listing record's attributes (the default reflection-based recordAttributes) under VIEW.
        return Optional.of(
                Infolist.make()
                        .schema(
                                TextEntry.make("ref"),
                                TextEntry.make("city").placeholder("—"))
                        .columns(2));
    }

    @Override
    public Optional<ResourcePages> pages() {
        return Optional.of(
                ResourcePages.of(
                        ListingListComponent.class,
                        ListingCreateComponent.class,
                        ListingEditComponent.class,
                        ListingViewComponent.class));
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
