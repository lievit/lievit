/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.hello;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import dev.lievit.spring.LievitWireService;
import dev.lievit.spring.WireCallResult;

/**
 * The hello-admin full-page CRUD tracer-bullet (ADR-0008): the worked {@link ListingResource} is
 * driven List -&gt; Create -&gt; Edit -&gt; Delete through the real lievit runtime (codec + registry
 * + dispatcher + JTE adapter + effects channel), proving the whole CRUD spine end to end over the
 * persistence-agnostic {@link dev.lievit.kit.RecordRepository} port.
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop of ADR-0007).
 */
@SpringBootTest(classes = HelloAdminTestApp.class)
@TestPropertySource(
        properties = {
            "lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"
        })
// Each CRUD test mutates the shared in-memory repository; a fresh context per method isolates them.
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class HelloAdminIT {

    @Autowired LievitWireService wireService;

    private final ObjectMapper json = new ObjectMapper();

    private static final String LIST = ListingListComponent.class.getName();
    private static final String CREATE = ListingCreateComponent.class.getName();
    private static final String EDIT = ListingEditComponent.class.getName();

    /**
     * @spec.given the worked ListingResource wired with an in-memory repository of two rows
     * @spec.when  its list component is mounted and rendered by JTE
     * @spec.then  the response is an HTML table with the column headers, one row per record, the
     *     create link, and the pagination, all over a signed snapshot
     * @spec.adr   ADR-0008
     */
    @Test
    void renders_the_resource_list_through_the_runtime() {
        WireCallResult mounted = wireService.mount(LIST);

        assertThat(mounted.html())
                .contains("data-admin-list")
                .contains("<h1 data-admin-heading>Listings</h1>")
                .contains("data-admin-create")
                .contains("href=\"/admin/listings/create\"")
                .contains("<th>Ref</th>")
                .contains("<th>City</th>")
                .contains("<th>Zone</th>")
                .contains("<td>Parma</td>")
                .contains("<td>Reggio Emilia</td>")
                .contains("data-admin-pagination");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given the worked ListingResource whose table declares a linked Ref column and a coloured
     *     Zone badge column
     * @spec.when  its list component is mounted and rendered by JTE through the real runtime
     * @spec.then  the linked column renders a real {@code <a href>} to the row's edit page and the
     *     badge column renders the server-first badge partial's {@code <span class="lv-badge
     *     lv-badge--<variant>">} (no {@code <lv-badge>} island tag), proving the typed cells survive
     *     the end-to-end JTE compile + render
     * @spec.adr   ADR-0008
     * @spec.adr   ADR-0012
     */
    @Test
    void renders_typed_cells_as_links_and_badges_through_jte() {
        WireCallResult mounted = wireService.mount(LIST);

        assertThat(mounted.html())
                // Ref is a LinkCell: a real anchor to the row's edit page (Parma is ref 1).
                .contains("<a href=\"/admin/listings/1/edit\">1</a>")
                // Zone is a BadgeCell rendered by the server-first badge partial (ADR-0012): the
                // island <lv-badge> tag is gone, replaced by a token-styled <span>. Reggio Emilia
                // (>5 chars) -> "large" with the "info" variant.
                .contains("lv-badge--info")
                .contains("data-variant=\"info\"")
                .contains(">large</span>")
                // Parma (<=5 chars) -> "small" with the "gray" variant.
                .contains("lv-badge--gray")
                .contains(">small</span>")
                // Big is an IconCell rendered by the server-first icon partial (ADR-0012): an inline
                // <svg> with data-icon, not an <lv-icon> island tag. Reggio Emilia (>5) -> "check",
                // Parma -> "x"; the colour token rides a text-* utility class on the svg.
                .contains("<svg")
                .contains("data-icon=\"check\"")
                .contains("data-icon=\"x\"")
                .contains("text-[var(--lv-color-success)]")
                // No island custom-element tags survive the render.
                .doesNotContain("<lv-badge")
                .doesNotContain("<lv-icon");
    }

    /**
     * @spec.given the worked ListingResource declaring a HEADER/toolbar URL-navigation action
     *     ("Open calendar" -&gt; /admin/calendar)
     * @spec.when  its list component is mounted and rendered by JTE through the real runtime
     * @spec.then  the header action renders in the toolbar as a real {@code <a href>} (a toolbar
     *     button, NOT a per-row action): it sits under data-admin-toolbar, points at the navigation
     *     URL, and is not stamped inside any data-admin-row
     * @spec.adr   ADR-0008
     */
    @Test
    void renders_a_header_toolbar_action_in_the_toolbar_not_per_row() {
        String html = wireService.mount(LIST).html();

        // The toolbar exists and carries the header action as a navigation anchor.
        assertThat(html)
                .contains("data-admin-toolbar")
                .contains("data-admin-header-action=\"open-calendar\"")
                .contains("href=\"/admin/calendar\"")
                .contains(">Open calendar</a>");

        // It is NOT a per-row action: the header action survives only before the first row.
        String beforeFirstRow = html.substring(0, html.indexOf("data-admin-row="));
        assertThat(beforeFirstRow).contains("data-admin-header-action=\"open-calendar\"");
        String rowsRegion = html.substring(html.indexOf("data-admin-row="));
        assertThat(rowsRegion).doesNotContain("data-admin-header-action");
    }

    /**
     * @spec.given the worked ListingResource whose table declares a TagsColumn.limit(2) and an
     *     AvatarStackColumn.limit(2), both derived from the city (Reggio Emilia &gt; 2 letters)
     * @spec.when  its list component is mounted and rendered by JTE through the real runtime
     * @spec.then  the tags cell renders the first 2 chips + a "+K" overflow badge, and the avatar
     *     stack renders 2 avatars + a "+K" badge linking to the row's detail (the K4 stacked column
     *     parity), proving the typed cells survive the end-to-end JTE compile + render
     * @spec.adr   ADR-0008
     */
    @Test
    void renders_tags_overflow_and_avatar_stack_overflow_through_jte() {
        String html = wireService.mount(LIST).html();

        // TagsColumn.limit(2): "Reggio Emilia" -> 12 letters, 2 chips + "+10".
        assertThat(html)
                .contains("data-tags-cell")
                .contains("data-tag")
                .contains("data-tags-overflow")
                .contains(">+10</span>");

        // AvatarStackColumn.limit(2): 2 stacked avatars + a "+10" overflow badge linking to the
        // row's detail (ref 2 = Reggio Emilia), carrying the limitedRemainingText title.
        assertThat(html)
                .contains("data-avatar-stack")
                .contains("data-shape=\"circular\"")
                .contains("data-avatar")
                .contains("data-avatar-overflow")
                .contains("href=\"/admin/listings/2/edit\"")
                .contains("title=\"12 people\"")
                .contains(">+10</a>");
    }

    /**
     * @spec.given a mounted create component and valid form state (a non-blank city)
     * @spec.when  the state is set over the wire and the save action is called
     * @spec.then  the action redirects to the list (the Lievit-Effects redirect) and flashes a
     *     success notification, and the new record is persisted (it appears on a fresh list mount)
     * @spec.adr   ADR-0008
     */
    @Test
    void create_persists_a_valid_record_then_flashes_and_redirects() {
        WireCallResult mounted = wireService.mount(CREATE);

        WireCallResult saved =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("state", Map.of("city", "Modena")),
                        List.of("save"),
                        "test-client");

        assertThat(saved.effects()).isNotNull();
        JsonNode effects = readEffects(saved);
        assertThat(effects.get("redirect").asText()).isEqualTo("/admin/listings");
        assertThat(effects.get("dispatch").get(0).get("name").asText()).isEqualTo("lievit-admin-notify");
        assertThat(effects.get("dispatch").get(0).get("detail").get("level").asText()).isEqualTo("success");

        // The new record is now in the list.
        assertThat(wireService.mount(LIST).html()).contains("<td>Modena</td>");
    }

    /**
     * @spec.given a mounted create component and invalid form state (a blank city)
     * @spec.when  the state is set over the wire and the save action is called
     * @spec.then  no redirect effect is emitted and the form re-renders with the field error; nothing
     *     is persisted
     * @spec.adr   ADR-0008
     */
    @Test
    void create_blocks_an_invalid_record_and_shows_the_field_error() {
        WireCallResult mounted = wireService.mount(CREATE);
        int before = countRows();

        WireCallResult saved =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("state", Map.of("city", "   ")),
                        List.of("save"),
                        "test-client");

        // No redirect: a blank-city save was blocked by validation.
        if (saved.effects() != null) {
            assertThat(readEffects(saved).has("redirect")).isFalse();
        }
        assertThat(saved.html()).contains("data-admin-field-errors=\"city\"");
        assertThat(countRows()).isEqualTo(before);
    }

    /**
     * @spec.given a mounted edit component pointed at an existing record
     * @spec.when  load prefills the form, then a changed city is saved
     * @spec.then  load shows the current value, and save redirects to the list and persists the change
     * @spec.adr   ADR-0008
     */
    @Test
    void edit_prefills_then_saves_a_change_and_redirects() {
        WireCallResult mounted = wireService.mount(EDIT);

        // Seed the record id (a settable @Wire field) and prefill.
        WireCallResult prefilled =
                wireService.call(
                        mounted.snapshot(), Map.of("recordId", "1"), List.of("load"), "test-client");
        assertThat(prefilled.html()).contains("value=\"Parma\"");

        // Change the city and save.
        WireCallResult saved =
                wireService.call(
                        prefilled.snapshot(),
                        Map.of("state", Map.of("city", "Piacenza")),
                        List.of("save"),
                        "test-client");

        assertThat(readEffects(saved).get("redirect").asText()).isEqualTo("/admin/listings");
        assertThat(wireService.mount(LIST).html()).contains("<td>Piacenza</td>").doesNotContain("<td>Parma</td>");
    }

    /**
     * @spec.given a mounted edit component pointed at an existing record
     * @spec.when  the delete action is called
     * @spec.then  it redirects to the list, flashes a success notification, and the record is gone
     * @spec.adr   ADR-0008
     */
    @Test
    void delete_removes_the_record_then_flashes_and_redirects() {
        WireCallResult mounted = wireService.mount(EDIT);

        WireCallResult deleted =
                wireService.call(
                        mounted.snapshot(), Map.of("recordId", "2"), List.of("delete"), "test-client");

        JsonNode effects = readEffects(deleted);
        assertThat(effects.get("redirect").asText()).isEqualTo("/admin/listings");
        assertThat(effects.get("dispatch").get(0).get("detail").get("level").asText()).isEqualTo("success");
        assertThat(wireService.mount(LIST).html()).doesNotContain("<td>Reggio Emilia</td>");
    }

    private int countRows() {
        String html = wireService.mount(LIST).html();
        return html.split("data-admin-row=", -1).length - 1;
    }

    private JsonNode readEffects(WireCallResult result) {
        try {
            assertThat(result.effects()).as("expected an effects header").isNotNull();
            return json.readTree(result.effects());
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
