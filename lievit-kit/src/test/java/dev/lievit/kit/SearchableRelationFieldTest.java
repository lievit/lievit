/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Function;

import org.junit.jupiter.api.Test;

/**
 * Specifies the K5 searchable mode of {@link BelongsToField} and the
 * {@link RecordRepository#search} lazy hook: the field renders as a Combobox (preload or lazy server
 * search) instead of a static {@code <select>}, the lazy path queries the repository with a
 * {@code LIMIT}, and an option carries the record's rich label. Pure builders + a counting fake
 * repository; no Spring context.
 */
class SearchableRelationFieldTest {

    record Person(String id, String name, String role) {}

    /** A fake repository that counts {@code search} calls and records the limit + term it saw. */
    static final class FakeRepo implements RecordRepository<Person> {
        final List<Person> people = new ArrayList<>();
        int searchCalls = 0;
        int lastLimit = -1;
        String lastTerm = null;

        FakeRepo(int n) {
            for (int i = 1; i <= n; i++) {
                people.add(new Person("p-" + i, "Person " + i, "Staff"));
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
            lastLimit = limit;
            lastTerm = term;
            String needle = term == null ? "" : term.trim().toLowerCase(Locale.ROOT);
            List<Person> out = new ArrayList<>();
            for (Person p : people) {
                if (needle.isEmpty() || label.apply(p).toLowerCase(Locale.ROOT).contains(needle)) {
                    out.add(p);
                    if (out.size() >= limit) {
                        break;
                    }
                }
            }
            return List.copyOf(out);
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

    // ── default RecordRepository.search ──────────────────────────────────────

    /** A minimal repository that implements only {@code page}, so it inherits the default search. */
    static final class PageOnlyRepo implements RecordRepository<Person> {
        final List<Person> people;

        PageOnlyRepo(List<Person> people) {
            this.people = people;
        }

        @Override
        public Page<Person> page(Query query) {
            int from = Math.min(query.offset(), people.size());
            int to = Math.min(from + query.limit(), people.size());
            return Page.of(people.subList(from, to), people.size());
        }

        @Override
        public Optional<Person> findById(String id) {
            return people.stream().filter(p -> p.id().equals(id)).findFirst();
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

    /**
     * @spec.given a repository that implements only page() and so inherits the default search
     * @spec.when  search() is called with a term and a small limit over a larger matching set
     * @spec.then  it filters findAll() by a case-insensitive contains on the label and caps the
     *     result at the limit (the default narrowing keeps every existing repo working)
     */
    @Test
    void default_search_filters_by_label_and_caps_at_the_limit() {
        List<Person> people =
                List.of(
                        new Person("1", "Mario Bianchi", "x"),
                        new Person("2", "Luca Rossi", "x"),
                        new Person("3", "Marco Verdi", "x"),
                        new Person("4", "Maria Neri", "x"));
        PageOnlyRepo repo = new PageOnlyRepo(people);

        List<Person> hits = repo.search("MAR", 2, Person::name);

        // case-insensitive contains on the name: Mario, Marco, Maria match; capped at 2.
        assertThat(hits).hasSize(2).extracting(Person::name).containsExactly("Mario Bianchi", "Marco Verdi");
    }

    /**
     * @spec.given the default search with a blank term
     * @spec.when  search() is called with an empty term and a limit
     * @spec.then  it returns the first {@code limit} rows (the bounded head before the user types)
     */
    @Test
    void default_search_returns_the_bounded_head_for_a_blank_term() {
        PageOnlyRepo repo =
                new PageOnlyRepo(
                        List.of(
                                new Person("1", "A", "x"),
                                new Person("2", "B", "x"),
                                new Person("3", "C", "x")));

        assertThat(repo.search("", 2, Person::name)).hasSize(2);
    }

    // ── BelongsToField searchable mode ────────────────────────────────────────

    /**
     * @spec.given a plain BelongsToField (no searchable())
     * @spec.when  its mode flags are read
     * @spec.then  it is NOT searchable (back-compat: the default stays the plain <select>)
     */
    @Test
    void belongs_to_field_is_not_searchable_by_default() {
        BelongsToField<Person> field =
                BelongsToField.make("personId", new FakeRepo(3), Person::id, Person::name);

        assertThat(field.isSearchable()).isFalse();
        assertThat(field.isPreload()).isFalse();
        assertThat(field.isMultiple()).isFalse();
    }

    /**
     * @spec.given a BelongsToField marked preload()
     * @spec.when  its mode flags are read
     * @spec.then  it is both searchable and preload (preload implies the Combobox UI)
     */
    @Test
    void preload_implies_searchable() {
        BelongsToField<Person> field =
                BelongsToField.make("personId", new FakeRepo(3), Person::id, Person::name).preload();

        assertThat(field.isSearchable()).isTrue();
        assertThat(field.isPreload()).isTrue();
    }

    /**
     * @spec.given a preload BelongsToField with a subtext extractor
     * @spec.when  preloadOptions() is called
     * @spec.then  every related record maps to a ComboOption carrying its value, label and subtext
     *     (the eager full catalog, projected with the rich label)
     */
    @Test
    void preload_options_map_the_full_catalog_with_rich_labels() {
        BelongsToField<Person> field =
                BelongsToField.make("personId", new FakeRepo(2), Person::id, Person::name)
                        .preload()
                        .subtext(Person::role);

        List<BelongsToField.ComboOption> options = field.preloadOptions();

        assertThat(options).hasSize(2);
        assertThat(options.get(0).value()).isEqualTo("p-1");
        assertThat(options.get(0).label()).isEqualTo("Person 1");
        assertThat(options.get(0).subtext()).isEqualTo("Staff");
    }

    /**
     * @spec.given a lazy (searchable, non-preload) BelongsToField with a searchLimit
     * @spec.when  searchOptions(term) is called
     * @spec.then  it queries the repository search hook with that LIMIT and the field's label
     *     extractor, mapping the matches to ComboOptions (the lazy server-search path)
     */
    @Test
    void search_options_query_the_repository_hook_with_the_field_limit() {
        FakeRepo repo = new FakeRepo(40);
        BelongsToField<Person> field =
                BelongsToField.make("personId", repo, Person::id, Person::name)
                        .searchable()
                        .searchLimit(7);

        List<BelongsToField.ComboOption> options = field.searchOptions("Person 1");

        assertThat(repo.searchCalls).isEqualTo(1);
        assertThat(repo.lastLimit).isEqualTo(7);
        assertThat(repo.lastTerm).isEqualTo("Person 1");
        // "Person 1" matches Person 1, 10..19 (11 rows), capped at the limit of 7.
        assertThat(options).hasSize(7);
        assertThat(options).allSatisfy(o -> assertThat(o.label()).contains("Person 1"));
    }

    /**
     * @spec.given a searchable BelongsToField with no explicit searchLimit
     * @spec.when  searchOptions(term) is called
     * @spec.then  it uses the default search limit (the documented page size)
     */
    @Test
    void search_uses_the_default_limit_when_unset() {
        FakeRepo repo = new FakeRepo(200);
        BelongsToField<Person> field =
                BelongsToField.make("personId", repo, Person::id, Person::name).searchable();

        field.searchOptions("Person");

        assertThat(repo.lastLimit).isEqualTo(BelongsToField.DEFAULT_SEARCH_LIMIT);
    }

    /**
     * @spec.given a BelongsToField marked multiple()
     * @spec.when  isMultiple() is read
     * @spec.then  it is a multi-relation (the Combobox submits repeated values); back-compat builders
     *     still return a Field
     */
    @Test
    void multiple_marks_a_multi_relation() {
        BelongsToField<Person> field =
                BelongsToField.make("personIds", new FakeRepo(3), Person::id, Person::name)
                        .searchable()
                        .multiple();

        assertThat(field.isMultiple()).isTrue();
        assertThat(field).isInstanceOf(Field.class);
    }

    /**
     * @spec.given a ComboOption built with null rich fields
     * @spec.when  it is constructed
     * @spec.then  the optional fields default to empty strings (absent), never null
     */
    @Test
    void combo_option_defends_optional_fields() {
        BelongsToField.ComboOption opt =
                new BelongsToField.ComboOption("v", "L", null, null, null);

        assertThat(opt.subtext()).isEmpty();
        assertThat(opt.avatar()).isEmpty();
        assertThat(opt.icon()).isEmpty();
    }
}
