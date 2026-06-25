/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.hello;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import jakarta.validation.Validator;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.BadgeColumn;
import dev.lievit.kit.Form;
import dev.lievit.kit.FormBinder;
import dev.lievit.kit.FormValidator;
import dev.lievit.kit.IconColumn;
import dev.lievit.kit.RecordRepository;
import dev.lievit.kit.Resource;
import dev.lievit.kit.ResourcePages;
import dev.lievit.kit.Table;
import dev.lievit.kit.TextColumn;
import dev.lievit.kit.TextField;
import dev.lievit.kit.schema.infolist.Infolist;
import dev.lievit.kit.schema.infolist.TextEntry;

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
                // A header column group (Filament ColumnGroup): "Location" arches over City + Zone as
                // a spanning super-header. The member columns stay real table columns.
                .columnGroup(
                        dev.lievit.kit.ColumnGroup.make(
                                "Location",
                                dev.lievit.kit.TextColumn.<Listing>make("City", Listing::city),
                                // A coloured badge derived from the city: a BadgeCell rendered by the
                                // server-first badge partial as <span class="lv-badge ..."> (ADR-0012).
                                BadgeColumn.<Listing>make(
                                                "Zone", l -> l.city().length() > 5 ? "large" : "small")
                                        .color(zone -> "large".equals(zone) ? "info" : "gray")))
                // A ViewColumn escape hatch (Filament ViewColumn): an arbitrary trusted HTML fragment
                // the adopter renders from the row, stamped raw in the cell (a mini progress bar).
                .column(
                        dev.lievit.kit.ViewColumn.<Listing>make(
                                "Score",
                                l ->
                                        "<div data-score-bar style=\"width:"
                                                + Math.min(100, l.city().length() * 10)
                                                + "%\">"
                                                + l.city().length() * 10
                                                + "</div>"))
                // An icon derived from the city length: an IconCell rendered by the server-first
                // icon partial as an inline <svg> (ADR-0012), never an <lv-icon> island tag.
                .column(
                        IconColumn.<Listing>make("Big", l -> l.city().length() > 5)
                                .bool("check", "x")
                                .color(v -> Boolean.TRUE.equals(v) ? "success" : "muted"))
                // K4: a TagsColumn with overflow. The tags are the city's words/letters (derived, no
                // schema change): limit(2) renders the first 2 chips + a "+K" badge for the rest.
                .column(
                        dev.lievit.kit.TagsColumn.<Listing>make("Tags", l -> letters(l.city()))
                                .limit(2))
                // K4: an AvatarStackColumn with overflow. The people are derived initials from the
                // city letters: limit(2) renders 2 avatars + a "+K" badge linking to the row detail.
                .column(
                        dev.lievit.kit.AvatarStackColumn.<Listing>make("People", l -> letters(l.city()))
                                .label(o -> String.valueOf(o))
                                .limit(2)
                                .url(l -> "/admin/listings/" + l.ref() + "/edit")
                                .overflowTitle(l -> letters(l.city()).size() + " people"))
                // Filters panel (Filament HasFilters): a SelectFilter over the city, a fully-configured
                // TernaryFilter (per-state labels + attribute + query closure), the layout pinned above
                // the content and persisted in session, with a default-active filter.
                .filters(
                        dev.lievit.kit.SelectFilter.make("city")
                                .options(
                                        new java.util.LinkedHashMap<>(
                                                java.util.Map.of(
                                                        "Parma", "Parma",
                                                        "Reggio Emilia", "Reggio Emilia"))),
                        dev.lievit.kit.TernaryFilter.make("big")
                                .trueLabel("Big cities")
                                .falseLabel("Small cities")
                                .placeholder("Any size")
                                .attribute("city_is_big")
                                .query(big -> dev.lievit.kit.FilterState.EMPTY.with(
                                        "city_is_big", big ? "true" : "false")))
                .filtersLayout(dev.lievit.kit.FiltersLayout.ABOVE_CONTENT)
                .persistFiltersInSession()
                .defaultFilters(dev.lievit.kit.FilterState.EMPTY.with("big", "true"));
    }

    /** Derives a per-row list of single-letter "tags"/"people" from the city (test fixture data). */
    private static java.util.List<String> letters(String city) {
        java.util.List<String> out = new java.util.ArrayList<>();
        for (char c : city.replace(" ", "").toCharArray()) {
            out.add(String.valueOf(Character.toUpperCase(c)));
        }
        return out;
    }

    @Override
    public java.util.List<dev.lievit.kit.AdminAction<Listing>> headerActions() {
        // A HEADER/toolbar URL-navigation action (the Filament header Action::url()): "Open calendar"
        // opens a page, no per-row record involved. Proves K3's header placement + url navigation.
        return java.util.List.of(
                dev.lievit.kit.UrlAction.<Listing>make(
                                "open-calendar", "Open calendar", "/admin/calendar")
                        .icon("heroicon-o-calendar"));
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
