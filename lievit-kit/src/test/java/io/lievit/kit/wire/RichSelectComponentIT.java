/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import io.lievit.spring.LievitWireService;
import io.lievit.spring.WireCallResult;

/**
 * Wave 2 exit gate (ADR-0012): the rich-select wire component driven through the REAL lievit runtime
 * (codec + registry + dispatcher + JTE adapter). A render-asserting IT (not a structural one): it
 * asserts the RENDERED DOM, the lesson the silent slot bug taught.
 *
 * <p>Proves the canonical wire/htmx typeahead: the options render server-side, a server-side filter
 * (the {@code query} field re-filtering in {@code @LievitRender}) NARROWS the rendered options, and
 * selecting an option ({@code $set('selected', ...)}) sets the server-held value + the hidden input.
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = RichSelectWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class RichSelectComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = RichSelectComponent.class.getName();

    /**
     * @spec.given the rich-select wire component mounted with its seed options (apple/banana/cherry)
     * @spec.when  it is rendered by JTE through the real runtime
     * @spec.then  the trigger is a combobox and the listbox renders all three real options (the
     *     catalog is server-rendered, never a client-shipped array)
     * @spec.adr   ADR-0012
     */
    @Test
    void renders_the_combobox_with_all_options_on_mount() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("role=\"combobox\"")
                .contains("role=\"listbox\"")
                .contains("data-rich-select-option=\"apple\"")
                .contains("data-rich-select-option=\"banana\"")
                .contains("data-rich-select-option=\"cherry\"")
                .contains(">Apple</span>");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a mounted rich-select
     * @spec.when  the query field is set over the wire (the debounced l:model send), filtering
     *     server-side
     * @spec.then  the re-rendered listbox NARROWS to only the matching option (server-side filter,
     *     no client filtering): "ban" leaves only banana, apple + cherry are gone
     * @spec.adr   ADR-0012
     */
    @Test
    void the_query_filters_the_options_server_side() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult filtered =
                wireService.call(
                        mounted.snapshot(), Map.of("query", "ban"), List.of(), "test-client");

        assertThat(filtered.html())
                .contains("data-rich-select-option=\"banana\"")
                .doesNotContain("data-rich-select-option=\"apple\"")
                .doesNotContain("data-rich-select-option=\"cherry\"");
    }

    /**
     * @spec.given a mounted rich-select
     * @spec.when  an option is selected via the $set magic action ($set('selected', 'cherry'))
     * @spec.then  the server holds the value: the hidden input carries it, the option is
     *     aria-selected, and the trigger shows the selected label (a render assertion proving the
     *     selection lives server-side)
     * @spec.adr   ADR-0012
     */
    @Test
    void selecting_an_option_sets_the_server_held_value() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult selected =
                wireService.call(
                        mounted.snapshot(),
                        Map.of(),
                        List.of("$set('selected', 'cherry')"),
                        "test-client");

        assertThat(selected.html())
                // the hidden submit input now carries the selected value...
                .containsPattern("value=\"cherry\"[^>]*data-rich-select-input")
                // ...the cherry option renders aria-selected (it is the server-held selection)...
                .containsPattern("aria-selected=\"true\"[^>]*data-rich-select-option=\"cherry\"")
                // ...and the trigger shows the selected label.
                .contains(">Cherry</span>");
    }

    /**
     * @spec.given a query that matches nothing
     * @spec.when  the listbox re-renders
     * @spec.then  the server-rendered empty state shows (no client fallback): a zero-result query
     *     renders the No options row
     * @spec.adr   ADR-0012
     */
    @Test
    void a_no_match_query_renders_the_empty_state() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult empty =
                wireService.call(
                        mounted.snapshot(), Map.of("query", "zzzzz"), List.of(), "test-client");

        assertThat(empty.html()).contains("data-rich-select-empty").contains("No options");
    }
}
