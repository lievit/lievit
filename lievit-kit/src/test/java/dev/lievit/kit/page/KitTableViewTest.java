/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.lievit.kit.AdminListView;
import dev.lievit.kit.ColumnSummary;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * Specifies {@link KitTableView}, the render-time bundle the {@code kit/table.jte} template reads: it
 * carries the bounded {@link AdminListView} plus the render-only facts the pure view-model does not
 * know (the server-first URL patterns, the active-filter indicator chips, the bulk-selection state,
 * the summary projection), each layered on with a wither and surfaced through a {@code has*} guard so
 * the template renders a control only when the host supplied its data. Also pins the
 * {@link AdminListView.Pagination} results-count derivation ("Showing X to Y of Z").
 */
class KitTableViewTest {

    private static AdminListView viewOf(int page, int size, long total) {
        return new AdminListView(
                "Cities",
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                AdminListView.Pagination.of(page, size, total),
                new AdminListView.Controls(
                        "", false, dev.lievit.kit.Sort.NONE, dev.lievit.kit.FilterState.EMPTY,
                        List.of(), dev.lievit.kit.FiltersLayout.DROPDOWN, false, List.of(10, 25),
                        false, "Empty", null));
    }

    /**
     * @spec.given a bare view with no render facts
     * @spec.when  it is wrapped with {@link KitTableView#of}
     * @spec.then  every optional control is absent (no URL patterns, chips, selection, summaries),
     *     so the template falls back to its wire-only controls
     */
    @Test
    void the_minimal_bundle_advertises_no_render_facts() {
        KitTableView table = KitTableView.of(viewOf(1, 10, 0));

        assertThat(table.hasPageHref()).isFalse();
        assertThat(table.hasSortHref()).isFalse();
        assertThat(table.hasSizeHref()).isFalse();
        assertThat(table.hasFilterChips()).isFalse();
        assertThat(table.hasResetFiltersHref()).isFalse();
        assertThat(table.selection().enabled()).isFalse();
        assertThat(table.hasSummaries()).isFalse();
    }

    /**
     * @spec.given a bundle and a sort-href pattern
     * @spec.when  a column's sort link is requested
     * @spec.then  the pattern's {@code %s} is substituted with the column key
     */
    @Test
    void the_sort_href_substitutes_the_column_key() {
        KitTableView table = KitTableView.of(viewOf(1, 10, 0)).withSortHref("/admin/cities?sort=%s");

        assertThat(table.hasSortHref()).isTrue();
        assertThat(table.sortHref("name")).isEqualTo("/admin/cities?sort=name");
    }

    /**
     * @spec.given filter indicators and a reset href layered onto a bundle
     * @spec.when  the bundle is read
     * @spec.then  the chips and the reset href surface, each behind its guard
     */
    @Test
    void filter_indicators_and_reset_surface_behind_their_guards() {
        KitTableView table = KitTableView.of(viewOf(1, 10, 0))
                .withFilterIndicators(
                        "/admin/cities",
                        List.of(new KitTableView.FilterChip("Status: active", "/admin/cities?x")));

        assertThat(table.hasResetFiltersHref()).isTrue();
        assertThat(table.resetFiltersHref()).isEqualTo("/admin/cities");
        assertThat(table.hasFilterChips()).isTrue();
        assertThat(table.filterChips()).singleElement()
                .extracting(KitTableView.FilterChip::label).isEqualTo("Status: active");
    }

    /**
     * @spec.given a bundle carrying summary cells
     * @spec.when  the summaries are read
     * @spec.then  they surface behind the {@code hasSummaries} guard in order
     */
    @Test
    void summaries_surface_behind_their_guard() {
        KitTableView table = KitTableView.of(viewOf(1, 10, 0))
                .withSummaries(List.of(new ColumnSummary("Total", "42")));

        assertThat(table.hasSummaries()).isTrue();
        assertThat(table.summaries()).singleElement()
                .extracting(ColumnSummary::value).isEqualTo("42");
    }

    /**
     * @spec.given a half-selected page of rows
     * @spec.when  the selection state is read
     * @spec.then  it reports the selected ids, the running count, and an indeterminate (some-not-all)
     *     header state
     */
    @Test
    void a_partial_page_selection_is_indeterminate_not_all() {
        KitTableView.Selection selection = KitTableView.Selection.of(Set.of("1", "2"), 4, 10);

        assertThat(selection.enabled()).isTrue();
        assertThat(selection.isSelected("1")).isTrue();
        assertThat(selection.isSelected("3")).isFalse();
        assertThat(selection.selectedCount()).isEqualTo(2);
        assertThat(selection.allSelected()).isFalse();
        assertThat(selection.someSelected()).isTrue();
        assertThat(selection.hasSelection()).isTrue();
    }

    /**
     * @spec.given every row on the page selected
     * @spec.when  the selection state is read
     * @spec.then  the header box is fully checked (all), not indeterminate
     */
    @Test
    void a_fully_selected_page_is_all_not_indeterminate() {
        KitTableView.Selection selection = KitTableView.Selection.of(Set.of("1", "2", "3"), 3, 3);

        assertThat(selection.allSelected()).isTrue();
        assertThat(selection.someSelected()).isFalse();
    }

    /**
     * @spec.given the no-selection default
     * @spec.when  it is read
     * @spec.then  selection is disabled and nothing is selected (no checkbox column renders)
     */
    @Test
    void the_none_selection_is_disabled() {
        assertThat(KitTableView.Selection.NONE.enabled()).isFalse();
        assertThat(KitTableView.Selection.NONE.hasSelection()).isFalse();
        assertThat(KitTableView.Selection.NONE.allSelected()).isFalse();
    }

    /**
     * @spec.given 7 results paginated 3 per page, on page 1
     * @spec.when  the results-count window is derived
     * @spec.then  it shows rows 1 to 3 of 7 (the "Showing X to Y of Z" line)
     */
    @Test
    void the_results_count_window_is_one_to_size_on_the_first_page() {
        AdminListView.Pagination pagination = AdminListView.Pagination.of(1, 3, 7);

        assertThat(pagination.firstShown()).isEqualTo(1);
        assertThat(pagination.lastShown()).isEqualTo(3);
    }

    /**
     * @spec.given 7 results paginated 3 per page, on the last (partial) page
     * @spec.when  the results-count window is derived
     * @spec.then  the last index clamps to the total (rows 7 to 7), never past it
     */
    @Test
    void the_results_count_window_clamps_to_the_total_on_the_last_page() {
        AdminListView.Pagination pagination = AdminListView.Pagination.of(3, 3, 7);

        assertThat(pagination.firstShown()).isEqualTo(7);
        assertThat(pagination.lastShown()).isEqualTo(7);
    }

    /**
     * @spec.given an empty result set
     * @spec.when  the results-count window is derived
     * @spec.then  both bounds are zero (the template shows "No results")
     */
    @Test
    void the_results_count_window_is_zero_when_empty() {
        AdminListView.Pagination pagination = AdminListView.Pagination.of(1, 10, 0);

        assertThat(pagination.firstShown()).isZero();
        assertThat(pagination.lastShown()).isZero();
    }

    // ---- #491 signed sort-token tests (SortTokenSigner + KitTableView.withSignedSort) ----

    private static final byte[] TEST_KEY =
            "test-sort-signing-key-0123456789ab".getBytes(StandardCharsets.UTF_8);

    /**
     * @spec.given a bundle without a sort signer and a sort-href pattern
     * @spec.when  sortHref is called with a column key
     * @spec.then  the link carries the plain key (unsigned, backward-compatible)
     */
    @Test
    void sort_href_is_unsigned_when_no_signer_is_wired() {
        KitTableView table = KitTableView.of(viewOf(1, 10, 0)).withSortHref("/admin?sort=%s");

        assertThat(table.hasSortTokenSigner()).isFalse();
        // Plain key, no dot-separated HMAC suffix.
        assertThat(table.sortHref("name")).isEqualTo("/admin?sort=name");
    }

    /**
     * @spec.given a bundle wired with a SortTokenSigner and a sort-href pattern
     * @spec.when  sortHref is called with a column key
     * @spec.then  the link carries a signed token (base64key.base64sig), not the plain key
     */
    @Test
    void sort_href_is_hmac_signed_when_a_signer_is_wired() {
        SortTokenSigner signer = new SortTokenSigner(TEST_KEY);
        KitTableView table = KitTableView.of(viewOf(1, 10, 0))
                .withSortHref("/admin?sort=%s")
                .withSignedSort(signer);

        assertThat(table.hasSortTokenSigner()).isTrue();
        String href = table.sortHref("name");
        // The token is not the plain key.
        assertThat(href).isNotEqualTo("/admin?sort=name");
        // The token portion is base64key.base64sig (two dot-separated parts after "sort=").
        String token = href.substring(href.indexOf("sort=") + 5);
        assertThat(token).contains(".");
        // The signer can round-trip: verify recovers the original key.
        assertThat(signer.verify(token)).isEqualTo("name");
    }

    /**
     * @spec.given a signed sort-href token for a descending sort direction
     * @spec.when  the token is verified
     * @spec.then  the negated key ("-name") is recovered intact, encoding the intended direction
     */
    @Test
    void descending_sort_key_survives_the_sign_verify_round_trip() {
        SortTokenSigner signer = new SortTokenSigner(TEST_KEY);
        KitTableView table = KitTableView.of(viewOf(1, 10, 0))
                .withSortHref("/admin?sort=%s")
                .withSignedSort(signer);

        String href = table.sortHref("-name");
        String token = href.substring(href.indexOf("sort=") + 5);
        // The "-" prefix (descending direction) round-trips cleanly.
        assertThat(signer.verify(token)).isEqualTo("-name");
    }

    /**
     * @spec.given a tampered sort token (the signature portion modified)
     * @spec.when  SortTokenSigner.verify is called
     * @spec.then  a SortTokenException is thrown (the sort param is rejected)
     */
    @Test
    void a_tampered_sort_token_is_rejected_with_an_exception() {
        SortTokenSigner signer = new SortTokenSigner(TEST_KEY);
        String good = signer.sign("name");
        // Tamper: flip the last character of the signature.
        String tampered = good.substring(0, good.length() - 1) + (good.endsWith("A") ? "B" : "A");

        assertThatThrownBy(() -> signer.verify(tampered))
                .isInstanceOf(SortTokenException.class)
                .hasMessageContaining("mismatch");
    }

    /**
     * @spec.given a key shorter than SortTokenSigner.MIN_KEY_BYTES
     * @spec.when  a SortTokenSigner is constructed with that key
     * @spec.then  an IllegalArgumentException is thrown at construction time, not silently accepted
     */
    @Test
    void a_short_signing_key_is_rejected_at_construction() {
        byte[] tooShort = "short".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> new SortTokenSigner(tooShort))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least");
    }

    /**
     * @spec.given a bundle wired with a signer, then re-wired with null
     * @spec.when  sortHref is called after removing the signer
     * @spec.then  the link reverts to the plain (unsigned) key
     */
    @Test
    void removing_the_signer_reverts_to_unsigned_links() {
        SortTokenSigner signer = new SortTokenSigner(TEST_KEY);
        KitTableView table = KitTableView.of(viewOf(1, 10, 0))
                .withSortHref("/admin?sort=%s")
                .withSignedSort(signer)
                .withSignedSort(null);

        assertThat(table.hasSortTokenSigner()).isFalse();
        assertThat(table.sortHref("name")).isEqualTo("/admin?sort=name");
    }
}
