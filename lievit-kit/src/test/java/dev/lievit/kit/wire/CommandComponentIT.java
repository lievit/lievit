/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.wire;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import dev.lievit.spring.LievitWireService;
import dev.lievit.spring.WireCallResult;

/**
 * Wave 2 exit gate (ADR-0012): the command-palette wire component driven through the REAL lievit
 * runtime. A render-asserting IT: it asserts the RENDERED DOM, not template structure.
 *
 * <p>Proves the server-filtered command list: items render grouped server-side, the {@code query}
 * field re-filters server-side, and selecting an item ({@code $set('selected', ...)}) holds the
 * chosen value server-side.
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = CommandWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class CommandComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = CommandComponent.class.getName();

    /**
     * @spec.given the command wire component mounted with its seed items (File + Preferences groups)
     * @spec.when  it is rendered by JTE through the real runtime
     * @spec.then  the search is a combobox, the list is a listbox, the group headings + items render
     *     server-side (the catalog is server-rendered, never client-shipped)
     * @spec.adr   ADR-0012
     */
    @Test
    void renders_the_grouped_items_on_mount() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("role=\"combobox\"")
                .contains("role=\"listbox\"")
                .contains("data-command-group")
                .contains(">File</div>")
                .contains("data-command-item=\"new\"")
                .contains("data-command-item=\"settings\"");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a mounted command palette
     * @spec.when  the query field is set over the wire (the debounced l:model send)
     * @spec.then  the re-rendered list NARROWS to the matching item server-side: "set" leaves only
     *     Settings, the File-group items are gone
     * @spec.adr   ADR-0012
     */
    @Test
    void the_query_filters_the_items_server_side() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult filtered =
                wireService.call(
                        mounted.snapshot(), Map.of("query", "set"), List.of(), "test-client");

        assertThat(filtered.html())
                .contains("data-command-item=\"settings\"")
                .doesNotContain("data-command-item=\"new\"")
                .doesNotContain("data-command-item=\"open\"");
    }

    /**
     * @spec.given a mounted command palette
     * @spec.when  an item is chosen via the $set magic action ($set('selected', 'new'))
     * @spec.then  the server holds the chosen value: the item renders aria-selected (a render
     *     assertion proving the selection lives server-side)
     * @spec.adr   ADR-0012
     */
    @Test
    void choosing_an_item_sets_the_server_held_value() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult chosen =
                wireService.call(
                        mounted.snapshot(),
                        Map.of(),
                        List.of("$set('selected', 'new')"),
                        "test-client");

        assertThat(chosen.html())
                .containsPattern("aria-selected=\"true\"[^>]*data-command-item=\"new\"");
    }

    /**
     * @spec.given a query that matches nothing
     * @spec.when  the list re-renders
     * @spec.then  the server-rendered empty state shows (the emptyText), no client fallback
     * @spec.adr   ADR-0012
     */
    @Test
    void a_no_match_query_renders_the_empty_state() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult empty =
                wireService.call(
                        mounted.snapshot(), Map.of("query", "zzzzz"), List.of(), "test-client");

        assertThat(empty.html()).contains("data-command-empty").contains("No results found.");
    }
}
