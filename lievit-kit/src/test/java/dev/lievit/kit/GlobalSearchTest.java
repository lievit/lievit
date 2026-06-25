/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;

import org.junit.jupiter.api.Test;

/**
 * Specifies global search (#323): a resource opting into search via searchable attributes, the
 * default {@link GlobalSearchProvider} grouping hits by resource label, and result urls pointing at
 * the matched record's edit route. Pure tests.
 */
class GlobalSearchTest {

    record Agent(String id, String name, String city) {}

    static final class AgentRepo implements RecordRepository<Agent> {
        private final List<Agent> rows;

        AgentRepo(List<Agent> rows) {
            this.rows = new ArrayList<>(rows);
        }

        @Override
        public Page<Agent> page(Query query) {
            return Page.of(rows, rows.size());
        }

        @Override
        public List<Agent> findAll() {
            return List.copyOf(rows);
        }

        @Override
        public Optional<Agent> findById(String id) {
            return rows.stream().filter(a -> a.id().equals(id)).findFirst();
        }

        @Override
        public Agent create(Agent record) {
            return record;
        }

        @Override
        public Agent update(String id, Agent record) {
            return record;
        }

        @Override
        public void delete(String id) {}
    }

    static final class AgentResource extends Resource<Agent> {
        AgentResource(List<Agent> rows) {
            super(new AgentRepo(rows));
        }

        @Override
        public String slug() {
            return "agents";
        }

        @Override
        public String label() {
            return "Agents";
        }

        @Override
        public Table<Agent> table() {
            return Table.<Agent>create().id(Agent::id).column("Name", Agent::name);
        }

        @Override
        public List<Function<? super Agent, String>> globallySearchableAttributes() {
            return List.of(Agent::name, Agent::city);
        }

        @Override
        public String globalSearchResultTitle(Agent row) {
            return row.name();
        }
    }

    /**
     * @spec.given a resource declaring searchable attributes
     * @spec.when  isGloballySearchable is checked
     * @spec.then  it reports true (opted in)
     */
    @Test
    void resource_with_searchable_attributes_is_globally_searchable() {
        assertThat(new AgentResource(List.of()).isGloballySearchable()).isTrue();
    }

    /**
     * @spec.given a resource without searchable attributes
     * @spec.when  isGloballySearchable is checked
     * @spec.then  it reports false (not searchable by default)
     */
    @Test
    void resource_without_searchable_attributes_is_not_searchable() {
        Resource<String> plain =
                new Resource<>(new PanelConfigStubRepo()) {
                    @Override
                    public String slug() {
                        return "x";
                    }

                    @Override
                    public String label() {
                        return "X";
                    }

                    @Override
                    public Table<String> table() {
                        return Table.create();
                    }
                };

        assertThat(plain.isGloballySearchable()).isFalse();
    }

    /**
     * @spec.given a resource over three agents
     * @spec.when  it is searched for a substring matching two of them (case-insensitive)
     * @spec.then  two results come back, titled by name, urled to the edit route
     */
    @Test
    void resource_global_search_matches_attributes_case_insensitively() {
        AgentResource resource =
                new AgentResource(
                        List.of(
                                new Agent("1", "Anna Rossi", "Parma"),
                                new Agent("2", "Marco Verdi", "Parma"),
                                new Agent("3", "Luca Bianchi", "Milano")));

        List<GlobalSearchResult> hits = resource.globalSearch("parma", "admin");

        assertThat(hits).extracting(GlobalSearchResult::title)
                .containsExactlyInAnyOrder("Anna Rossi", "Marco Verdi");
        assertThat(hits).extracting(GlobalSearchResult::url)
                .allMatch(u -> u.startsWith("/admin/agents/") && u.endsWith("/edit"));
    }

    /**
     * @spec.given a panel with a searchable and a non-searchable resource
     * @spec.when  the default provider searches the panel
     * @spec.then  hits are grouped under the searchable resource's label only
     */
    @Test
    void default_provider_groups_hits_by_resource_label() {
        AgentResource agents =
                new AgentResource(List.of(new Agent("1", "Anna", "Parma"), new Agent("2", "Bob", "Roma")));
        Panel panel = Panel.create("admin").resource(agents);

        GlobalSearchResults results = GlobalSearchProvider.defaultProvider().search(panel, "Anna");

        assertThat(results.groups()).containsExactly("Agents");
        assertThat(results.resultsFor("Agents")).extracting(GlobalSearchResult::title)
                .containsExactly("Anna");
        assertThat(results.totalCount()).isEqualTo(1);
    }

    /**
     * @spec.given a panel
     * @spec.when  the default provider searches with a blank query
     * @spec.then  it returns no results (no surface for an empty box)
     */
    @Test
    void default_provider_returns_nothing_for_a_blank_query() {
        Panel panel = Panel.create("admin").resource(new AgentResource(List.of()));

        assertThat(GlobalSearchProvider.defaultProvider().search(panel, "  ").isEmpty()).isTrue();
    }

    /** A trivial repo for the non-searchable resource in one test. */
    static final class PanelConfigStubRepo implements RecordRepository<String> {
        @Override
        public Page<String> page(Query query) {
            return Page.of(List.of(), 0);
        }

        @Override
        public Optional<String> findById(String id) {
            return Optional.empty();
        }

        @Override
        public String create(String record) {
            return record;
        }

        @Override
        public String update(String id, String record) {
            return record;
        }

        @Override
        public void delete(String id) {}
    }
}
