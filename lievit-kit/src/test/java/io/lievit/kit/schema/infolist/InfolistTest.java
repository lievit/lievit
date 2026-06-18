/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema.infolist;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.kit.Color;
import io.lievit.kit.support.EvaluationContext;

/**
 * Specifies the infolist container and entry palette (the filament-infolists surface over the
 * shared schema engine): a read-only Infolist resolves its entries against a record under the VIEW
 * operation, with TextEntry formatting (money / dateTime / badge / limit / placeholder) and the
 * visual entries (Icon / Image / Color / Code / KeyValue / Repeatable / View).
 */
class InfolistTest {

    private static Map<String, Object> record(Map<String, Object> attrs) {
        return new LinkedHashMap<>(attrs);
    }

    // ── Infolist container + TextEntry ────────────────────────────────────────────

    /**
     * @spec.given an Infolist of two text entries over a record
     * @spec.when  the infolist resolves the record
     * @spec.then  it produces an ordered label-to-display map from the record's attributes
     */
    @Test
    void infolist_resolves_text_entries_from_a_record() {
        Infolist infolist =
                Infolist.make().schema(TextEntry.make("title"), TextEntry.make("status")).columns(2);

        Map<String, String> view = infolist.resolve(record(Map.of("title", "Hello", "status", "draft")));

        assertThat(view).containsExactly(Map.entry("Title", "Hello"), Map.entry("Status", "draft"));
        assertThat(infolist.columns()).isEqualTo(2);
    }

    /**
     * @spec.given a TextEntry with a placeholder over a record missing that attribute
     * @spec.when  the entry resolves its display
     * @spec.then  the placeholder is substituted for the empty value
     */
    @Test
    void text_entry_substitutes_a_placeholder_for_empty() {
        Infolist infolist = Infolist.make().schema(TextEntry.make("note").placeholder("—"));

        assertThat(infolist.resolve(record(Map.of()))).containsEntry("Note", "—");
    }

    /**
     * @spec.given a money TextEntry over a numeric attribute
     * @spec.when  the entry resolves its display
     * @spec.then  the value is formatted as a currency amount
     */
    @Test
    void text_entry_money_formats_a_currency_amount() {
        TextEntry entry = TextEntry.make("price").money("EUR");
        EvaluationContext ctx = Infolist.make().contextOver(record(Map.of("price", 1299)));

        assertThat(entry.resolveDisplay(ctx)).isEqualTo("EUR 1299.00");
    }

    /**
     * @spec.given a dateTime TextEntry over a LocalDate attribute
     * @spec.when  the entry resolves its display
     * @spec.then  the temporal value is formatted with the pattern
     */
    @Test
    void text_entry_date_time_formats_a_temporal() {
        TextEntry entry = TextEntry.make("created_at").dateTime("yyyy/MM/dd");
        EvaluationContext ctx =
                Infolist.make().contextOver(record(Map.of("created_at", LocalDate.parse("2026-06-15"))));

        assertThat(entry.resolveDisplay(ctx)).isEqualTo("2026/06/15");
    }

    /**
     * @spec.given a badge TextEntry with a color and a limit
     * @spec.when  its presentation accessors are read
     * @spec.then  the badge, color, and limit are carried
     */
    @Test
    void text_entry_carries_badge_color_and_limit() {
        TextEntry entry = TextEntry.make("status").badge().color(Color.SUCCESS).limit(20).copyable();

        assertThat(entry.isBadge()).isTrue();
        assertThat(entry.color()).isEqualTo(Color.SUCCESS);
        assertThat(entry.limit()).isEqualTo(20);
        assertThat(entry.isCopyable()).isTrue();
    }

    /**
     * @spec.given an Infolist with a hidden entry
     * @spec.when  the infolist resolves
     * @spec.then  the hidden entry is omitted from the view
     */
    @Test
    void infolist_omits_hidden_entries() {
        Infolist infolist =
                Infolist.make()
                        .schema(TextEntry.make("title"), TextEntry.make("secret").visible(false));

        assertThat(infolist.resolve(record(Map.of("title", "x", "secret", "y")))).containsOnlyKeys("Title");
    }

    // ── Visual entries ────────────────────────────────────────────────────────────

    /**
     * @spec.given an IconEntry mapping a boolean to a check / cross icon and a color
     * @spec.when  a truthy then a falsy value is resolved
     * @spec.then  the icon and color follow the value
     */
    @Test
    void icon_entry_maps_a_boolean_to_an_icon_and_color() {
        IconEntry entry =
                IconEntry.make("active")
                        .booleanIcons("check", "x")
                        .color(v -> Boolean.TRUE.equals(v) ? Color.SUCCESS : Color.DANGER);

        assertThat(entry.resolveIcon(true)).isEqualTo("check");
        assertThat(entry.resolveIcon(false)).isEqualTo("x");
        assertThat(entry.resolveColor(true)).isEqualTo(Color.SUCCESS);
    }

    /**
     * @spec.given an ImageEntry made circular with a disk
     * @spec.when  its accessors are read
     * @spec.then  the dimensions, circular crop, and disk are carried
     */
    @Test
    void image_entry_carries_sizing_and_disk() {
        ImageEntry entry = ImageEntry.make("avatar").circular(48).disk("avatars");

        assertThat(entry.width()).isEqualTo(48);
        assertThat(entry.height()).isEqualTo(48);
        assertThat(entry.isCircular()).isTrue();
        assertThat(entry.disk()).isEqualTo("avatars");
    }

    /**
     * @spec.given a copyable ColorEntry
     * @spec.when  it resolves a stored CSS color value
     * @spec.then  the value passes through as the display and copyable is set
     */
    @Test
    void color_entry_displays_a_css_color_value() {
        ColorEntry entry = ColorEntry.make("brand").copyable();
        EvaluationContext ctx = Infolist.make().contextOver(record(Map.of("brand", "#1d4ed8")));

        assertThat(entry.resolveDisplay(ctx)).isEqualTo("#1d4ed8");
        assertThat(entry.isCopyable()).isTrue();
    }

    /**
     * @spec.given a CodeEntry with a language and line numbers
     * @spec.when  its accessors are read
     * @spec.then  the language and line-number flag are carried
     */
    @Test
    void code_entry_carries_language_and_line_numbers() {
        CodeEntry entry = CodeEntry.make("config").language("json").lineNumbers().copyable();

        assertThat(entry.language()).isEqualTo("json");
        assertThat(entry.hasLineNumbers()).isTrue();
        assertThat(entry.isCopyable()).isTrue();
    }

    /**
     * @spec.given a KeyValueEntry over a map attribute
     * @spec.when  the entry resolves the map
     * @spec.then  the ordered map is read from the record with custom headers
     */
    @Test
    void key_value_entry_renders_a_map() {
        KeyValueEntry entry = KeyValueEntry.make("meta").keyLabel("Attr").valueLabel("Val");
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("color", "blue");
        meta.put("size", "L");
        EvaluationContext ctx = Infolist.make().contextOver(record(Map.of("meta", meta)));

        assertThat(entry.keyLabel()).isEqualTo("Attr");
        assertThat(entry.resolveMap(ctx))
                .containsExactly(Map.entry("color", "blue"), Map.entry("size", "L"));
    }

    /**
     * @spec.given a RepeatableEntry looping two child text entries over a list attribute
     * @spec.when  the entry resolves the items
     * @spec.then  each item resolves its child entries against its own attributes, in order
     */
    @Test
    void repeatable_entry_loops_child_entries_over_a_list() {
        RepeatableEntry entry =
                RepeatableEntry.make("lines")
                        .schema(TextEntry.make("name"), TextEntry.make("qty"))
                        .columns(2);
        Map<String, Object> line1 = new LinkedHashMap<>();
        line1.put("name", "Widget");
        line1.put("qty", "3");
        Map<String, Object> line2 = new LinkedHashMap<>();
        line2.put("name", "Gadget");
        line2.put("qty", "1");
        EvaluationContext ctx =
                Infolist.make().contextOver(record(Map.of("lines", List.of(line1, line2))));

        List<Map<String, String>> items = entry.resolveItems(ctx);

        assertThat(items).hasSize(2);
        assertThat(items.get(0)).containsEntry("Name", "Widget").containsEntry("Qty", "3");
        assertThat(items.get(1)).containsEntry("Name", "Gadget");
    }

    /**
     * @spec.given a ViewEntry bound to a template
     * @spec.when  its accessors are read
     * @spec.then  the template name and bound state path are carried
     */
    @Test
    void view_entry_binds_a_custom_template() {
        ViewEntry entry = ViewEntry.make("payload", "infolist/payload");

        assertThat(entry.view()).isEqualTo("infolist/payload");
        assertThat(entry.statePath()).isEqualTo("payload");
    }
}
