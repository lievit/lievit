/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the action presentation surface (the Filament {@code Action} view variants + concerns):
 * icon, color, size, variant, tooltip, badge, outlined, disabled and a per-record hidden predicate,
 * plus the built-in defaults (delete → danger, edit → primary, view → gray).
 */
class ActionPresentationTest {

    record Listing(String id) {}

    /**
     * @spec.given a custom action with the full presentation set
     * @spec.when  its presentation is read
     * @spec.then  each property reflects the configured value
     */
    @Test
    void exposes_the_full_presentation_surface() {
        AdminAction<Listing> action =
                new ViewAction<Listing>()
                        .icon("heroicon-o-eye")
                        .color("info")
                        .size(Size.SMALL)
                        .variant(ActionVariant.ICON_BUTTON)
                        .tooltip("Open")
                        .badge("3")
                        .outlined();

        assertThat(action.icon()).isEqualTo("heroicon-o-eye");
        assertThat(action.color()).isEqualTo("info");
        assertThat(action.size()).isEqualTo(Size.SMALL);
        assertThat(action.variant()).isEqualTo(ActionVariant.ICON_BUTTON);
        assertThat(action.tooltip()).isEqualTo("Open");
        assertThat(action.badge()).isEqualTo("3");
        assertThat(action.isOutlined()).isTrue();
    }

    /**
     * @spec.given the built-in delete, edit and view actions with no overrides
     * @spec.when  their default colours are read
     * @spec.then  delete is danger, edit is primary, view is gray
     */
    @Test
    void built_ins_carry_their_default_colours() {
        assertThat(new DeleteAction<Listing>().color()).isEqualTo("danger");
        assertThat(new EditAction<>(Form.<Listing>create()).color()).isEqualTo("primary");
        assertThat(new ViewAction<Listing>().color()).isEqualTo("gray");
    }

    /**
     * @spec.given an action with a per-record hidden predicate
     * @spec.when  it is tested against a matching and a non-matching record
     * @spec.then  it is hidden only for the matching record
     */
    @Test
    void a_hidden_predicate_gates_per_record_visibility() {
        AdminAction<Listing> action =
                new DeleteAction<Listing>()
                        .hidden(r -> r instanceof Listing l && l.id().equals("locked"));

        assertThat(action.isHiddenFor(new Listing("locked"))).isTrue();
        assertThat(action.isHiddenFor(new Listing("open"))).isFalse();
    }

    /**
     * @spec.given a destructive action
     * @spec.when  its confirmation modal config is read
     * @spec.then  it carries a heading, a destructive description and a confirm/cancel label
     */
    @Test
    void a_destructive_action_has_a_confirmation_modal_config() {
        ConfirmationModal modal = new DeleteAction<Listing>().confirmationModal();

        assertThat(modal.heading()).isNotBlank();
        assertThat(modal.submitLabel()).isEqualTo("Confirm");
        assertThat(modal.cancelLabel()).isEqualTo("Cancel");
        assertThat(modal.description()).isNotNull();
    }
}
