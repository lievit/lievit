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
 * Wave 2 exit gate (ADR-0012) grown to the Filament-Select-parity Combobox (roadmap L1): the
 * rich-select wire component driven through the REAL lievit runtime (codec + registry + dispatcher +
 * JTE adapter). A render-asserting IT (not a structural one): it asserts the RENDERED DOM, the lesson
 * the silent slot bug taught.
 *
 * <p>Proves the canonical wire/htmx typeahead AND the four L1 behaviours, all server-first: the
 * server-side {@code query} filter narrows the rendered options; single-select ({@code $set('selected',
 * ...)}) sets the server-held value; multiple-select toggles membership in {@code selectedValues} and
 * renders removable chips (the chip remove arms the same toggle); preload renders the catalog on mount
 * with no query; allow-create adds the typed value; a rich option projects its icon + subtext.
 *
 * <p>The locked mode flags ({@code multiple} / {@code preload} / {@code allowCreate}) are seeded
 * server-side at mount via {@link LievitWireService#mountStamped} (a prop targeting a locked field is
 * honored: locked stops the client, not the owning server, ADR-0016), so the locked flag round-trips
 * in the snapshot for the follow-up calls.
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
     * @spec.given a mounted rich-select (single mode)
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
     * @spec.given a query that matches nothing (single mode, no allow-create)
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

    /**
     * @spec.given a rich option seeded with a Lucide icon + a secondary subtext line
     * @spec.when  the listbox renders on mount
     * @spec.then  the option projects its rich label: the leading icon and the subtext both render
     *     (the rich-label fields flow through the real runtime, not a client template)
     * @spec.adr   ADR-0012
     */
    @Test
    void a_rich_option_renders_its_icon_and_subtext() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-rich-select-option=\"durian\"")
                .contains("data-rich-select-option-icon")
                .contains("data-icon=\"leaf\"")
                .contains("data-rich-select-option-subtext")
                .contains(">Spiky and pungent</span>");
    }

    /**
     * @spec.given a rich-select mounted in MULTIPLE mode (the locked flag seeded server-side)
     * @spec.when  two options are toggled in turn via the armed $set('toggleValue', ...) (the same
     *     idiom toggle-group uses)
     * @spec.then  both stay selected: the listbox marks both aria-selected, the trigger renders a
     *     removable chip per chosen option, and the selection submits as repeated hidden inputs (the
     *     multi-value form-association the gest island could not do reliably)
     * @spec.adr   ADR-0012
     */
    @Test
    void multiple_mode_toggles_membership_and_renders_chips() {
        WireCallResult mounted = wireService.mountStamped(COMPONENT, Map.of("multiple", true));

        WireCallResult first =
                wireService.call(
                        mounted.snapshot(),
                        Map.of(),
                        List.of("$set('toggleValue', 'apple')"),
                        "test-client");
        WireCallResult both =
                wireService.call(
                        first.snapshot(),
                        Map.of(),
                        List.of("$set('toggleValue', 'cherry')"),
                        "test-client");

        assertThat(both.html())
                // both options are members of the selection (multiple mode keeps both)...
                .containsPattern("aria-selected=\"true\"[^>]*data-rich-select-option=\"apple\"")
                .containsPattern("aria-selected=\"true\"[^>]*data-rich-select-option=\"cherry\"")
                // ...each chosen option renders a removable chip with a remove button...
                .contains("data-rich-select-chip=\"apple\"")
                .contains("data-rich-select-chip-remove=\"apple\"")
                .contains("data-rich-select-chip=\"cherry\"")
                .contains("data-rich-select-chip-remove=\"cherry\"")
                // ...and the selection submits as repeated hidden inputs (one per value).
                .containsPattern("value=\"apple\"[^>]*data-rich-select-input")
                .containsPattern("value=\"cherry\"[^>]*data-rich-select-input");
    }

    /**
     * @spec.given a multiple-mode rich-select with two values already selected
     * @spec.when  a chip's remove button arms the same toggle on its value ($set('toggleValue',
     *     'apple'), the chip-remove wiring)
     * @spec.then  that value leaves the selection: its chip is gone, its option is no longer
     *     aria-selected, and the other selection is untouched (toggling a selected value removes it)
     * @spec.adr   ADR-0012
     */
    @Test
    void removing_a_chip_drops_only_that_value() {
        WireCallResult mounted = wireService.mountStamped(COMPONENT, Map.of("multiple", true));
        WireCallResult apple =
                wireService.call(
                        mounted.snapshot(),
                        Map.of(),
                        List.of("$set('toggleValue', 'apple')"),
                        "test-client");
        WireCallResult both =
                wireService.call(
                        apple.snapshot(),
                        Map.of(),
                        List.of("$set('toggleValue', 'cherry')"),
                        "test-client");

        // the chip remove arms the SAME toggle on apple's value: it removes apple.
        WireCallResult removed =
                wireService.call(
                        both.snapshot(),
                        Map.of(),
                        List.of("$set('toggleValue', 'apple')"),
                        "test-client");

        assertThat(removed.html())
                .doesNotContain("data-rich-select-chip=\"apple\"")
                .contains("data-rich-select-chip=\"cherry\"")
                .containsPattern("aria-selected=\"true\"[^>]*data-rich-select-option=\"cherry\"");
        assertThat(removed.html())
                .doesNotContainPattern(
                        "aria-selected=\"true\"[^>]*data-rich-select-option=\"apple\"");
    }

    /**
     * @spec.given a rich-select mounted with preload on (the locked flag seeded server-side)
     * @spec.when  it renders on mount with NO query typed
     * @spec.then  the full catalog renders eagerly (the small-set eager path): all seed options are
     *     present without any search, no empty state
     * @spec.adr   ADR-0012
     */
    @Test
    void preload_renders_the_full_catalog_on_mount_without_a_query() {
        WireCallResult mounted = wireService.mountStamped(COMPONENT, Map.of("preload", true));

        assertThat(mounted.html())
                .contains("data-rich-select-option=\"apple\"")
                .contains("data-rich-select-option=\"banana\"")
                .contains("data-rich-select-option=\"cherry\"")
                .doesNotContain("data-rich-select-empty");
    }

    /**
     * @spec.given a rich-select with allow-create on and a query that matches no existing option
     * @spec.when  the no-match query is filtered, then the Create affordance is armed
     *     ($set('createValue', 'mango'))
     * @spec.then  the typed value becomes a new selected option: a Create row renders for the query,
     *     and arming it selects the new value (its hidden input carries it, its option aria-selected)
     * @spec.adr   ADR-0012
     */
    @Test
    void allow_create_adds_the_typed_value_as_a_new_option() {
        WireCallResult mounted = wireService.mountStamped(COMPONENT, Map.of("allowCreate", true));

        WireCallResult typed =
                wireService.call(
                        mounted.snapshot(), Map.of("query", "mango"), List.of(), "test-client");
        // the no-match query renders the Create affordance for the typed value.
        assertThat(typed.html())
                .contains("data-rich-select-create=\"mango\"")
                .contains("Create \"mango\"");

        WireCallResult created =
                wireService.call(
                        typed.snapshot(),
                        Map.of(),
                        List.of("$set('createValue', 'mango')"),
                        "test-client");

        assertThat(created.html())
                // the new value is now a real, selected option...
                .contains("data-rich-select-option=\"mango\"")
                .containsPattern("aria-selected=\"true\"[^>]*data-rich-select-option=\"mango\"")
                // ...and it submits in the hidden input.
                .containsPattern("value=\"mango\"[^>]*data-rich-select-input");
    }
}
