/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Specifies the K4 {@link AvatarStackColumn} (the Filament stacked image column): the first N items
 * render as avatars (image or initials/name fallback), then a {@code "+K"} overflow badge when the
 * list exceeds N, optionally linking to the row's detail. No Spring context needed.
 */
class AvatarStackColumnTest {

    record Person(String name, String avatar) {}

    record Deal(String id, List<Person> people) {}

    /**
     * @spec.given an avatar-stack column with limit 3 over a row of 5 people
     * @spec.when  the visible avatars and the overflow count are read
     * @spec.then  exactly the first 3 avatars render and the overflow count is 2 (the "+K" badge)
     */
    @Test
    void shows_the_first_n_avatars_and_a_plus_k_overflow() {
        AvatarStackColumn<Deal> col =
                AvatarStackColumn.<Deal>make("People", Deal::people)
                        .image(p -> ((Person) p).avatar())
                        .label(p -> ((Person) p).name())
                        .limit(3);
        Deal deal = new Deal("1", people(5));

        assertThat(col.visibleAvatarsFor(deal)).hasSize(3);
        assertThat(col.visibleAvatarsFor(deal))
                .extracting(AvatarStackColumn.Avatar::label)
                .containsExactly("P0", "P1", "P2");
        assertThat(col.overflowCountFor(deal)).isEqualTo(2);
        assertThat(col.hasOverflowFor(deal)).isTrue();
    }

    /**
     * @spec.given an avatar-stack column with limit 3 over a row of 3 people (fits exactly)
     * @spec.when  the visible avatars and the overflow are read
     * @spec.then  all 3 avatars render and there is no overflow badge
     */
    @Test
    void shows_all_avatars_and_no_overflow_when_within_the_limit() {
        AvatarStackColumn<Deal> col =
                AvatarStackColumn.<Deal>make("People", Deal::people)
                        .label(p -> ((Person) p).name())
                        .limit(3);
        Deal deal = new Deal("1", people(3));

        assertThat(col.visibleAvatarsFor(deal)).hasSize(3);
        assertThat(col.overflowCountFor(deal)).isZero();
        assertThat(col.hasOverflowFor(deal)).isFalse();
    }

    /**
     * @spec.given an avatar-stack column with an image mapper and a label fallback
     * @spec.when  an avatar with an image and one without are rendered
     * @spec.then  the imaged avatar carries its src (hasImage), the imageless one falls back to the
     *     label chip
     */
    @Test
    void falls_back_to_the_label_chip_when_an_item_has_no_image() {
        AvatarStackColumn<Deal> col =
                AvatarStackColumn.<Deal>make("People", Deal::people)
                        .image(p -> ((Person) p).avatar())
                        .label(p -> ((Person) p).name())
                        .limit(2);
        Deal deal =
                new Deal(
                        "1",
                        List.of(new Person("Ada", "/img/ada.png"), new Person("Bo", "")));

        List<AvatarStackColumn.Avatar> avatars = col.visibleAvatarsFor(deal);
        assertThat(avatars.get(0).hasImage()).isTrue();
        assertThat(avatars.get(0).image()).isEqualTo("/img/ada.png");
        assertThat(avatars.get(1).hasImage()).isFalse();
        assertThat(avatars.get(1).label()).isEqualTo("Bo");
    }

    /**
     * @spec.given an avatar-stack column linked to the row's detail with an overflow title
     * @spec.when  the overflow URL and title are read for an overflowing row
     * @spec.then  the "+K" badge carries the detail link and the hover title (the limitedRemainingText)
     */
    @Test
    void the_overflow_badge_links_and_titles_to_the_row_detail() {
        AvatarStackColumn<Deal> col =
                AvatarStackColumn.<Deal>make("People", Deal::people)
                        .label(p -> ((Person) p).name())
                        .limit(2)
                        .url(d -> "/admin/deals/" + d.id())
                        .overflowTitle(d -> d.people().size() + " people");
        Deal deal = new Deal("9", people(5));

        assertThat(col.overflowUrlFor(deal)).hasValue("/admin/deals/9");
        assertThat(col.overflowTitleFor(deal)).hasValue("5 people");
    }

    /**
     * @spec.given an avatar-stack column with a defaulted limit and circular flag
     * @spec.when  its configuration is read before any override
     * @spec.then  the limit defaults to 3 and avatars are circular
     */
    @Test
    void defaults_to_limit_three_and_circular_avatars() {
        AvatarStackColumn<Deal> col = AvatarStackColumn.make("People", Deal::people);

        assertThat(col.limit()).isEqualTo(3);
        assertThat(col.isCircular()).isTrue();
        assertThat(col.circular(false).isCircular()).isFalse();
    }

    /**
     * @spec.given an avatar-stack column over a null collection
     * @spec.when  its avatars and overflow are read
     * @spec.then  no avatars render and there is no overflow (empty, not an NPE)
     */
    @Test
    void renders_nothing_for_a_null_collection() {
        AvatarStackColumn<Deal> col =
                AvatarStackColumn.<Deal>make("People", Deal::people).label(p -> ((Person) p).name());

        Deal empty = new Deal("1", null);
        assertThat(col.visibleAvatarsFor(empty)).isEmpty();
        assertThat(col.overflowCountFor(empty)).isZero();
    }

    private static List<Person> people(int n) {
        List<Person> out = new java.util.ArrayList<>();
        for (int i = 0; i < n; i++) {
            out.add(new Person("P" + i, "/img/p" + i + ".png"));
        }
        return out;
    }
}
