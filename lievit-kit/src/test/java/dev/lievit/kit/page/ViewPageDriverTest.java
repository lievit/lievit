/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import dev.lievit.kit.AdminAuthorizer;
import dev.lievit.kit.AdminOperation;
import dev.lievit.kit.AdminViewView;
import dev.lievit.kit.RecordRepository;
import dev.lievit.kit.Resource;
import dev.lievit.kit.ResourcePages;
import dev.lievit.kit.Table;
import dev.lievit.kit.TextColumn;
import dev.lievit.kit.schema.infolist.Infolist;
import dev.lievit.kit.schema.infolist.TextEntry;

/**
 * Specifies {@link ViewPageDriver}'s head-less resolution (the View page logic without the runtime):
 * it loads a record by id, resolves the resource's {@link Infolist} against the record's attributes
 * under VIEW, and produces the {@link AdminViewView} with its header actions, branching to
 * not-found / forbidden instead of throwing.
 */
class ViewPageDriverTest {

    /** A minimal record row for the driver, a plain Java record so the default recordAttributes reflects it. */
    record Person(long id, String name, String city) {}

    /** A two-row in-memory repository over {@link Person}. */
    static final class PersonRepository implements RecordRepository<Person> {
        private final List<Person> rows =
                List.of(new Person(1, "Ada", "Parma"), new Person(2, "Bob", "Reggio"));

        @Override
        public Page<Person> page(Query query) {
            return Page.of(rows, rows.size());
        }

        @Override
        public Optional<Person> findById(String id) {
            return rows.stream().filter(p -> String.valueOf(p.id()).equals(id)).findFirst();
        }

        @Override
        public Person create(Person record) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Person update(String id, Person record) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void delete(String id) {
            throw new UnsupportedOperationException();
        }
    }

    /** A resource declaring an infolist (name + city) and an editable page set (so Edit surfaces). */
    static final class PersonResource extends Resource<Person> {
        PersonResource() {
            super(new PersonRepository());
        }

        @Override
        public String slug() {
            return "people";
        }

        @Override
        public String label() {
            return "People";
        }

        @Override
        public Table<Person> table() {
            return Table.<Person>create().id(p -> String.valueOf(p.id())).column("Name", Person::name);
        }

        @Override
        public Optional<Infolist> infolist() {
            return Optional.of(
                    Infolist.make().schema(TextEntry.make("name"), TextEntry.make("city")).columns(2));
        }

        @Override
        public Optional<ResourcePages> pages() {
            // Editable: the driver derives an Edit header action. The classes are irrelevant to the
            // head-less driver (it only reads isEditable()), so reuse this resource's own class.
            return Optional.of(
                    ResourcePages.of(
                            PersonResource.class,
                            PersonResource.class,
                            PersonResource.class,
                            PersonResource.class));
        }
    }

    private final PersonResource resource = new PersonResource();

    /**
     * @spec.given a view driver over a resource with an infolist and an editable page set
     * @spec.when  it resolves an existing record's detail by id
     * @spec.then  it is FOUND with the heading, the resolved entries (the projected values), the
     *     column layout, and the Edit (primary, bare-id+/edit) + Back (secondary, list) header actions
     */
    @Test
    void resolves_an_existing_record_into_a_view_model() {
        ViewPageDriver<Person> driver =
                new ViewPageDriver<>(resource, "admin", AdminAuthorizer.permitAll());

        ViewPageDriver.Resolution resolution = driver.view("1");

        assertThat(resolution.isFound()).isTrue();
        AdminViewView view = resolution.view();
        assertThat(view.recordId()).isEqualTo("1");
        assertThat(view.heading()).isEqualTo("People");
        assertThat(view.entries())
                .containsEntry("Name", "Ada")
                .containsEntry("City", "Parma");
        assertThat(view.sections()).singleElement().satisfies(s -> assertThat(s.columns()).isEqualTo(2));
        assertThat(view.headerActions())
                .extracting(AdminViewView.HeaderAction::label, AdminViewView.HeaderAction::url)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("Edit", "/admin/people/1/edit"),
                        org.assertj.core.groups.Tuple.tuple("Back", "/admin/people"));
    }

    /**
     * @spec.given a view driver
     * @spec.when  it resolves a non-existent id (and a blank id)
     * @spec.then  both are NOT_FOUND with no view-model, never an exception
     */
    @Test
    void resolves_a_missing_or_blank_id_to_not_found() {
        ViewPageDriver<Person> driver =
                new ViewPageDriver<>(resource, "admin", AdminAuthorizer.permitAll());

        assertThat(driver.view("999").status()).isEqualTo(ViewPageDriver.Resolution.Status.NOT_FOUND);
        assertThat(driver.view("").status()).isEqualTo(ViewPageDriver.Resolution.Status.NOT_FOUND);
    }

    /**
     * @spec.given a view driver whose authorizer denies the read (VIEW_LIST) of the record
     * @spec.when  it resolves an existing id
     * @spec.then  it is FORBIDDEN with no view-model (the read is gated at the boundary, not the view)
     */
    @Test
    void gates_the_read_through_the_authorizer() {
        AdminAuthorizer denyAll = (operation, res, record) -> false;
        ViewPageDriver<Person> driver = new ViewPageDriver<>(resource, "admin", denyAll);

        ViewPageDriver.Resolution resolution = driver.view("1");

        assertThat(resolution.status()).isEqualTo(ViewPageDriver.Resolution.Status.FORBIDDEN);
        assertThat(resolution.view()).isNull();
    }

    /**
     * @spec.given a view driver gating the read under the VIEW_LIST read operation
     * @spec.when  an authorizer allowing only that operation is used
     * @spec.then  the read is allowed (proving viewing a record reuses the existing read gate, no new
     *     AdminOperation constant)
     */
    @Test
    void uses_the_view_list_read_operation_to_gate() {
        AdminAuthorizer onlyRead =
                (operation, res, record) -> operation == AdminOperation.VIEW_LIST;
        ViewPageDriver<Person> driver = new ViewPageDriver<>(resource, "admin", onlyRead);

        assertThat(driver.view("1").isFound()).isTrue();
    }

    /**
     * @spec.given a resource that declares NO infolist
     * @spec.when  a view driver is constructed over it
     * @spec.then  it fails fast (a View page needs an infolist to render)
     */
    @Test
    void rejects_a_resource_without_an_infolist() {
        Resource<Person> noInfolist =
                new Resource<>(new PersonRepository()) {
                    @Override
                    public String slug() {
                        return "people";
                    }

                    @Override
                    public String label() {
                        return "People";
                    }

                    @Override
                    public Table<Person> table() {
                        return Table.<Person>create().column(TextColumn.make("Name", Person::name));
                    }
                };

        assertThatThrownBy(
                        () -> new ViewPageDriver<>(noInfolist, "admin", AdminAuthorizer.permitAll()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("infolist");
    }
}
