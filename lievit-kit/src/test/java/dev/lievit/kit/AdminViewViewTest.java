/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.kit.schema.infolist.Infolist;
import dev.lievit.kit.schema.infolist.TextEntry;

/**
 * Specifies {@link AdminViewView}: the detail (View) page view-model the kit derives from a
 * {@link Infolist} resolved over one record. The values are PROJECTED once (the silent-slot lesson),
 * laid out in the infolist's section/columns shape, alongside the toolbar header actions.
 */
class AdminViewViewTest {

    /**
     * @spec.given an infolist of two text entries (one with a placeholder) and a record's attributes
     * @spec.when  the view-model is built under VIEW
     * @spec.then  it carries one section with the resolved label-to-value entries (the placeholder
     *     applied to the empty attribute), the column layout, the record id, and the header actions
     */
    @Test
    void builds_a_resolved_single_section_view_model() {
        Infolist infolist =
                Infolist.make()
                        .schema(TextEntry.make("title"), TextEntry.make("note").placeholder("—"))
                        .columns(2);

        AdminViewView view =
                AdminViewView.of(
                        "Detail",
                        "42",
                        infolist,
                        Map.of("title", "Hello"),
                        List.of(
                                AdminViewView.HeaderAction.primary("Edit", "/admin/x/42/edit"),
                                AdminViewView.HeaderAction.secondary("Back", "/admin/x")));

        assertThat(view.heading()).isEqualTo("Detail");
        assertThat(view.recordId()).isEqualTo("42");
        assertThat(view.sections()).singleElement().satisfies(section -> {
            assertThat(section.columns()).isEqualTo(2);
            assertThat(section.hasHeading()).isFalse();
            assertThat(section.entries())
                    .containsExactly(Map.entry("Title", "Hello"), Map.entry("Note", "—"));
        });
        assertThat(view.entries()).containsEntry("Title", "Hello").containsEntry("Note", "—");
    }

    /**
     * @spec.given a view-model carrying header actions
     * @spec.when  its toolbar accessors are read
     * @spec.then  it reports having header actions and the primary/secondary variants are tagged
     */
    @Test
    void exposes_the_header_actions_with_their_variants() {
        AdminViewView view =
                AdminViewView.of(
                        "Detail",
                        "1",
                        Infolist.make().schema(TextEntry.make("title")),
                        Map.of("title", "Hi"),
                        List.of(AdminViewView.HeaderAction.primary("Edit", "/edit")));

        assertThat(view.hasHeaderActions()).isTrue();
        assertThat(view.headerActions())
                .singleElement()
                .satisfies(a -> {
                    assertThat(a.label()).isEqualTo("Edit");
                    assertThat(a.variant()).isEqualTo("primary");
                });
    }

    /**
     * @spec.given a view-model built with no header actions
     * @spec.when  its toolbar accessor is read
     * @spec.then  it reports no header actions (a read-only resource needs no toolbar)
     */
    @Test
    void reports_no_header_actions_when_none_declared() {
        AdminViewView view =
                AdminViewView.of(
                        "Detail",
                        "1",
                        Infolist.make().schema(TextEntry.make("title")),
                        Map.of("title", "Hi"),
                        List.of());

        assertThat(view.hasHeaderActions()).isFalse();
    }
}
