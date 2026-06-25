/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.relationselect;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import dev.lievit.kit.relationselect.RelationSelectTestApp.CountingPersonRepository;
import dev.lievit.spring.LievitWireService;
import dev.lievit.spring.WireCallResult;

/**
 * The K5 exit gate: the kit searchable relation field ({@link dev.lievit.kit.BelongsToField} in
 * {@code searchable} mode) wired to the rich-select Combobox, driven through the REAL lievit runtime
 * (codec + registry + dispatcher + JTE adapter). A render-asserting IT (the silent-slot lesson: it
 * asserts the RENDERED DOM, not structure).
 *
 * <p>Proves the K5 behaviours, all server-first: the relation renders the Combobox (a
 * {@code button[role=combobox]} + a {@code ul[role=listbox]}), NOT a plain {@code <select>}; preload
 * shows the catalog on mount; the lazy debounced search narrows the rendered options THROUGH the
 * repository {@code search} hook (which the field caps with a {@code LIMIT}); a rich option projects
 * its icon + subtext; and multiple mode toggles membership and submits repeated hidden inputs.
 *
 * <p>The locked mode flags ({@code preload} / {@code multiple}) are seeded server-side at mount via
 * {@link LievitWireService#mountStamped} (a prop targeting a locked field is honoured: locked stops
 * the client, not the owning server), so they round-trip in the snapshot for the follow-up calls.
 *
 * <p>It boots a Spring context, so it is an {@code *IT}.
 */
@SpringBootTest(classes = RelationSelectTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class RelationSelectComponentIT {

    @Autowired LievitWireService wireService;
    @Autowired CountingPersonRepository personRepository;

    private static final String COMPONENT = RelationSelectComponent.class.getName();

    /**
     * @spec.given a BelongsToField wired to the rich-select Combobox in preload mode
     * @spec.when  the relation field is mounted and rendered by JTE through the real runtime
     * @spec.then  it renders the Combobox (a combobox button + a listbox), NOT a plain {@code
     *     <select>}: the gap K5 closes (a relation no longer loads all options into a static select)
     */
    @Test
    void the_relation_renders_the_combobox_not_a_plain_select() {
        WireCallResult mounted = wireService.mountStamped(COMPONENT, Map.of("preload", true));

        assertThat(mounted.html())
                .contains("role=\"combobox\"")
                .contains("role=\"listbox\"")
                .contains("data-relation-select")
                .doesNotContain("<select");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a preload-mode relation Combobox over the related repository
     * @spec.when  it renders on mount with no query
     * @spec.then  the catalog renders eagerly (the SMALL-set path): the related records are present
     *     as options, projected from the repository, without any search
     */
    @Test
    void preload_shows_the_catalog_options_on_mount() {
        WireCallResult mounted = wireService.mountStamped(COMPONENT, Map.of("preload", true));

        assertThat(mounted.html())
                .contains("data-relation-select-option=\"p-bianchi\"")
                .contains(">Mario Bianchi</span>")
                .contains("data-relation-select-option=\"p-rossi\"")
                .doesNotContain("data-relation-select-empty");
    }

    /**
     * @spec.given a preload-mode relation Combobox with a rich field (icon + subtext from the record)
     * @spec.when  the listbox renders on mount
     * @spec.then  an option projects its rich label: the leading icon and the role subtext both
     *     render (the record's rich label flows through the field into the Combobox)
     */
    @Test
    void a_rich_relation_option_renders_its_icon_and_subtext() {
        WireCallResult mounted = wireService.mountStamped(COMPONENT, Map.of("preload", true));

        assertThat(mounted.html())
                .contains("data-relation-select-option-icon")
                .contains("data-icon=\"user\"")
                .contains("data-relation-select-option-subtext")
                .contains(">Agent</span>");
    }

    /**
     * @spec.given a lazy-mode relation Combobox over a large repository (no preload)
     * @spec.when  the debounced query is set over the wire ("rossi"), filtering through the backend
     * @spec.then  the rendered listbox NARROWS to only the matching option, and the narrowing went
     *     THROUGH the repository {@code search} hook capped at the field's LIMIT (the LARGE-set path:
     *     no all-rows render): Luca Rossi stays, the rest are gone, search was called with the limit
     */
    @Test
    void lazy_search_narrows_the_options_through_the_repository_hook() {
        WireCallResult mounted = wireService.mountStamped(COMPONENT, Map.of("preload", false));
        int callsAfterMount = personRepository.searchCalls;

        WireCallResult filtered =
                wireService.call(
                        mounted.snapshot(), Map.of("query", "rossi"), List.of(), "test-client");

        assertThat(filtered.html())
                .contains("data-relation-select-option=\"p-rossi\"")
                .doesNotContain("data-relation-select-option=\"p-bianchi\"")
                .doesNotContain("data-relation-select-option=\"p-1\"");
        // The narrowing went through the lazy repository hook, capped at the field's LIMIT.
        assertThat(personRepository.searchCalls).isGreaterThan(callsAfterMount);
        assertThat(personRepository.lastSearchLimit).isEqualTo(RelationSelectTestApp.SEARCH_LIMIT);
    }

    /**
     * @spec.given a lazy-mode relation Combobox over 50 rows with the field LIMIT of 5
     * @spec.when  a broad query that matches every row is set over the wire
     * @spec.then  at most LIMIT options render (the lazy read is bounded: the catalog never loads all
     *     rows every render, the whole point of the lazy path)
     */
    @Test
    void lazy_search_is_bounded_by_the_field_limit() {
        WireCallResult mounted = wireService.mountStamped(COMPONENT, Map.of("preload", false));

        WireCallResult filtered =
                wireService.call(
                        mounted.snapshot(), Map.of("query", "Person"), List.of(), "test-client");

        long rendered =
                filtered.html().lines()
                        .filter(line -> line.contains("data-relation-select-option=\"p-"))
                        .count();
        assertThat(rendered).isLessThanOrEqualTo(RelationSelectTestApp.SEARCH_LIMIT);
    }

    /**
     * @spec.given a single-mode lazy relation Combobox
     * @spec.when  an option is selected via the armed $set('toggleValue', 'p-rossi')
     * @spec.then  the server holds the value: the hidden submit input carries it and the option is
     *     aria-selected (the selection lives server-side, the form submits the related id)
     */
    @Test
    void selecting_a_relation_option_sets_the_submitted_id() {
        WireCallResult mounted = wireService.mountStamped(COMPONENT, Map.of("preload", false));

        WireCallResult selected =
                wireService.call(
                        mounted.snapshot(),
                        Map.of(),
                        List.of("$set('toggleValue', 'p-rossi')"),
                        "test-client");

        assertThat(selected.html())
                .containsPattern("value=\"p-rossi\"[^>]*data-relation-select-input")
                .containsPattern(
                        "aria-selected=\"true\"[^>]*data-relation-select-option=\"p-rossi\"");
    }

    /**
     * @spec.given a MULTIPLE-mode lazy relation Combobox (the locked flag seeded server-side)
     * @spec.when  two options are toggled in turn via the armed $set('toggleValue', ...)
     * @spec.then  both stay selected and the multi-relation submits as REPEATED hidden inputs (one
     *     per chosen id, the multi-value form association a static select cannot do), each chosen
     *     option rendering a removable chip
     */
    @Test
    void multiple_mode_submits_repeated_values() {
        WireCallResult mounted = wireService.mountStamped(COMPONENT, Map.of("multiple", true));

        WireCallResult first =
                wireService.call(
                        mounted.snapshot(),
                        Map.of(),
                        List.of("$set('toggleValue', 'p-bianchi')"),
                        "test-client");
        WireCallResult both =
                wireService.call(
                        first.snapshot(),
                        Map.of(),
                        List.of("$set('toggleValue', 'p-rossi')"),
                        "test-client");

        assertThat(both.html())
                // both ids submit as repeated hidden inputs under the field name...
                .containsPattern("value=\"p-bianchi\"[^>]*data-relation-select-input")
                .containsPattern("value=\"p-rossi\"[^>]*data-relation-select-input")
                // ...and each chosen option renders a removable chip.
                .contains("data-relation-select-chip=\"p-bianchi\"")
                .contains("data-relation-select-chip-remove=\"p-bianchi\"")
                .contains("data-relation-select-chip=\"p-rossi\"");
    }

    /**
     * @spec.given a multiple-mode relation Combobox with two ids already selected
     * @spec.when  a chip's remove arms the same toggle on its id ($set('toggleValue', 'p-bianchi'))
     * @spec.then  that id leaves the selection: its hidden input is gone, the other remains
     *     (toggling a selected value removes it, the chip-remove wiring)
     */
    @Test
    void removing_a_chip_drops_only_that_id() {
        WireCallResult mounted = wireService.mountStamped(COMPONENT, Map.of("multiple", true));
        WireCallResult one =
                wireService.call(
                        mounted.snapshot(),
                        Map.of(),
                        List.of("$set('toggleValue', 'p-bianchi')"),
                        "test-client");
        WireCallResult both =
                wireService.call(
                        one.snapshot(),
                        Map.of(),
                        List.of("$set('toggleValue', 'p-rossi')"),
                        "test-client");

        WireCallResult removed =
                wireService.call(
                        both.snapshot(),
                        Map.of(),
                        List.of("$set('toggleValue', 'p-bianchi')"),
                        "test-client");

        assertThat(removed.html())
                .doesNotContain("data-relation-select-chip=\"p-bianchi\"")
                .contains("data-relation-select-chip=\"p-rossi\"")
                .containsPattern("value=\"p-rossi\"[^>]*data-relation-select-input");
        assertThat(removed.html())
                .doesNotContainPattern("value=\"p-bianchi\"[^>]*data-relation-select-input");
    }
}
