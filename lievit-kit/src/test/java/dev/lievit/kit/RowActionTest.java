/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Specifies the {@link RowAction} value object: the generic per-row action the table chrome stamps
 * (label + icon + a single href-or-wire channel + variant + confirm + disabled + newTab), with the
 * predicates already resolved to booleans at build time. Replaces the host-injected typed per-row
 * template seam with one shape every adopter renders identically.
 */
class RowActionTest {

    /**
     * @spec.given a link action built from the {@link RowAction#link} factory
     * @spec.when  its channel flags are read
     * @spec.then  it carries the href, is not a wire action, and defaults to the default variant
     */
    @Test
    void a_link_action_carries_an_href_and_defaults_to_the_default_variant() {
        RowAction action = RowAction.link("Open", "/admin/cities/1");

        assertThat(action.hasHref()).isTrue();
        assertThat(action.hasWire()).isFalse();
        assertThat(action.href()).isEqualTo("/admin/cities/1");
        assertThat(action.variant()).isEqualTo("default");
        assertThat(action.requiresConfirmation()).isFalse();
    }

    /**
     * @spec.given a wire action built from the {@link RowAction#wire} factory with a per-row argument
     * @spec.when  its channel flags are read
     * @spec.then  it carries the wire name + the escaped arg and is not a link action
     */
    @Test
    void a_wire_action_carries_the_wire_name_and_its_per_row_argument() {
        RowAction action = RowAction.wire("Revoke", "revokeDevice", Map.of("id", "42"));

        assertThat(action.hasWire()).isTrue();
        assertThat(action.hasHref()).isFalse();
        assertThat(action.wire()).isEqualTo("revokeDevice");
        assertThat(action.wireArgs()).containsEntry("id", "42");
    }

    /**
     * @spec.given a row action with a confirmation prompt set through the wither
     * @spec.when  its confirmation flag is read
     * @spec.then  it requires confirmation and carries the prompt
     */
    @Test
    void a_confirm_prompt_makes_the_action_require_confirmation() {
        RowAction action = RowAction.wire("Delete", "deleteRow", Map.of("id", "7"))
                .withVariant("destructive")
                .withConfirm("Delete this row?");

        assertThat(action.requiresConfirmation()).isTrue();
        assertThat(action.confirm()).isEqualTo("Delete this row?");
        assertThat(action.variant()).isEqualTo("destructive");
    }

    /**
     * @spec.given a row action constructed with a null variant and a null wire-args map
     * @spec.when  the compact constructor normalises them
     * @spec.then  the variant defaults to "default" and the args map is empty (never null)
     */
    @Test
    void the_compact_constructor_never_nulls_the_variant_or_the_args() {
        RowAction action =
                new RowAction("X", null, "/x", null, null, null, null, false, false);

        assertThat(action.variant()).isEqualTo("default");
        assertThat(action.wireArgs()).isEmpty();
        assertThat(action.hasIcon()).isFalse();
    }

    /**
     * @spec.given a link action with the new-tab + icon withers applied
     * @spec.when  the resulting copy is read
     * @spec.then  it opens in a new tab and shows the icon
     */
    @Test
    void the_withers_set_new_tab_and_icon() {
        RowAction action = RowAction.link("Open", "/x").withNewTab(true).withIcon("external-link");

        assertThat(action.newTab()).isTrue();
        assertThat(action.hasIcon()).isTrue();
        assertThat(action.icon()).isEqualTo("external-link");
    }
}
