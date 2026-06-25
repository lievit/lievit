/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.relationselect;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Function;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

import dev.lievit.kit.BelongsToField;
import dev.lievit.kit.RecordRepository;

/**
 * The K5 IT harness: a Spring Boot app that wires the rich-select Combobox to a kit
 * {@link BelongsToField} over a large {@code persone} relation, as a prototype-scoped
 * {@link RelationSelectComponent} bean (the stateless-wire-call contract; the snapshot is the only
 * state carrier). It proves the K5 wiring through the REAL lievit runtime: preload, lazy server
 * search, and multiple are selected per test by the locked {@code preload} / {@code multiple} props
 * seeded at mount.
 *
 * <p>The {@code persone} repository is a large fixture (50 people) whose {@code search} counts its
 * calls and honours the {@code LIMIT}: a real adopter overrides {@code search} with a
 * {@code WHERE name ILIKE ? LIMIT ?} query; here the counting variant proves the lazy hook fires and
 * the limit reaches the read (not an all-rows render).
 */
@SpringBootApplication
public class RelationSelectTestApp {

    /** A related row: a person with an id, a name, and a role used as the rich subtext. */
    public record Person(String id, String name, String role) {}

    /** The lazy-search page size the field caps the read at (proves the LIMIT reaches the repo). */
    public static final int SEARCH_LIMIT = 5;

    /**
     * A large {@code persone} fixture (50 rows) so the lazy path is meaningful. Its {@code search}
     * counts its calls and honours the {@code LIMIT}, standing in for the adopter's
     * {@code WHERE name ILIKE ? LIMIT ?} query.
     */
    public static final class CountingPersonRepository implements RecordRepository<Person> {
        private final List<Person> people = new ArrayList<>();
        /** How many times the lazy {@code search} hook has been invoked (proves the lazy read). */
        public int searchCalls = 0;
        /** The last limit passed to {@code search} (proves the LIMIT reaches the read). */
        public int lastSearchLimit = -1;

        /** Seeds 50 people: two distinctive names plus Person 01..48 for the search assertions. */
        public CountingPersonRepository() {
            people.add(new Person("p-bianchi", "Mario Bianchi", "Agent"));
            people.add(new Person("p-rossi", "Luca Rossi", "Manager"));
            for (int i = 1; i <= 48; i++) {
                String n = String.format(Locale.ROOT, "Person %02d", i);
                people.add(new Person("p-" + i, n, "Staff"));
            }
        }

        @Override
        public Page<Person> page(Query query) {
            return Page.of(people, people.size());
        }

        @Override
        public Optional<Person> findById(String id) {
            return people.stream().filter(p -> p.id().equals(id)).findFirst();
        }

        @Override
        public List<Person> findAll() {
            return List.copyOf(people);
        }

        @Override
        public List<Person> search(String term, int limit, Function<Person, String> label) {
            searchCalls++;
            lastSearchLimit = limit;
            String needle = term == null ? "" : term.trim().toLowerCase(Locale.ROOT);
            List<Person> matched = new ArrayList<>();
            for (Person p : people) {
                if (needle.isEmpty() || label.apply(p).toLowerCase(Locale.ROOT).contains(needle)) {
                    matched.add(p);
                    if (matched.size() >= limit) {
                        break;
                    }
                }
            }
            return List.copyOf(matched);
        }

        @Override
        public Person create(Person record) {
            throw new UnsupportedOperationException("read-only fixture");
        }

        @Override
        public Person update(String id, Person record) {
            throw new UnsupportedOperationException("read-only fixture");
        }

        @Override
        public void delete(String id) {
            throw new UnsupportedOperationException("read-only fixture");
        }
    }

    /** The large relation repository, shared so a test can assert the search-call count. */
    @Bean
    CountingPersonRepository personRepository() {
        return new CountingPersonRepository();
    }

    /**
     * The relation Combobox wired to the {@code persone} field: searchable, capped at
     * {@link #SEARCH_LIMIT}, with the person's role as the rich subtext and a {@code user} icon. The
     * component's locked {@code preload} / {@code multiple} props (seeded per test at mount) select
     * the eager-vs-lazy and single-vs-multi behaviour over this one field.
     *
     * @param repo the large relation repository
     * @return a fresh relation-select component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    RelationSelectComponent relationSelectComponent(CountingPersonRepository repo) {
        BelongsToField<Person> field =
                BelongsToField.make("personId", "Person", repo, Person::id, Person::name)
                        .searchable()
                        .searchLimit(SEARCH_LIMIT)
                        .icon(p -> "user")
                        .subtext(Person::role);
        RelationSelectComponent c = new RelationSelectComponent();
        c.wire(field);
        return c;
    }
}
