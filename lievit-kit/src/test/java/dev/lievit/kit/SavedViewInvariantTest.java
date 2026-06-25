/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Specifies the {@link SavedView} value type: a named bundle of filters + visible columns + sort +
 * page size, in two flavours (a code-owned read-only preset, a per-user editable view), with the
 * non-blank-name invariant and the preset rules (no owner, never the stored default) pinned by the
 * compact constructor.
 */
class SavedViewInvariantTest {

    /**
     * @spec.given a user view with a padded name and no explicit columns
     * @spec.when  it is constructed
     * @spec.then  the name is trimmed and it is flagged as an editable user view
     */
    @Test
    void a_user_view_trims_its_name_and_is_editable() {
        SavedView view =
                SavedView.user("v1", "activities", "ada", "  Mine  ", FilterState.EMPTY,
                        List.of(), Sort.NONE, 0, false);

        assertThat(view.name()).isEqualTo("Mine");
        assertThat(view.isUser()).isTrue();
        assertThat(view.isPreset()).isFalse();
        assertThat(view.hasVisibleColumns()).isFalse();
    }

    /**
     * @spec.given a blank view name
     * @spec.when  a view is constructed
     * @spec.then  construction fails loudly (the list-by-name invariant)
     */
    @Test
    void a_blank_name_is_rejected() {
        assertThatThrownBy(
                        () ->
                                SavedView.user("v1", "activities", "ada", "   ", FilterState.EMPTY,
                                        List.of(), Sort.NONE, 0, false))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /**
     * @spec.given a preset declared with an owner and a default flag
     * @spec.when  it is constructed
     * @spec.then  the owner is cleared and it is never the stored default (presets belong to everyone)
     */
    @Test
    void a_preset_has_no_owner_and_is_never_default() {
        SavedView preset =
                new SavedView("overdue", "activities", "someone", "Overdue",
                        SavedView.Scope.PERSONAL, SavedView.Origin.PRESET, FilterState.EMPTY,
                        List.of(), Sort.NONE, 0, true);

        assertThat(preset.owner()).isEmpty();
        assertThat(preset.isDefault()).isFalse();
        assertThat(preset.isPreset()).isTrue();
    }

    /**
     * @spec.given a preset view
     * @spec.when  its default flag is set true
     * @spec.then  it stays non-default (a preset is never a per-user default)
     */
    @Test
    void a_preset_cannot_be_made_default() {
        SavedView preset =
                SavedView.preset("overdue", "activities", "Overdue", FilterState.EMPTY, List.of(),
                        Sort.NONE, 0);

        assertThat(preset.withDefault(true).isDefault()).isFalse();
    }

    /**
     * @spec.given a view declaring visible columns in a specific order
     * @spec.when  the view is read
     * @spec.then  it reports having visible columns in that order
     */
    @Test
    void a_view_carries_its_visible_column_order() {
        SavedView view =
                SavedView.user("v1", "activities", "ada", "Slim", FilterState.EMPTY,
                        List.of("name", "status"), Sort.NONE, 0, false);

        assertThat(view.hasVisibleColumns()).isTrue();
        assertThat(view.visibleColumns()).containsExactly("name", "status");
    }
}
