/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Specifies the display column types and the shared formatting surface: {@link IconColumn} maps a
 * value to an icon + colour, {@link ImageColumn} renders a URL as a thumbnail/avatar,
 * {@link ColorColumn} renders a swatch, {@link TagsColumn} splits a value into chips, and
 * {@link TextColumn} formats / limits / links / copies / describes a cell (the Filament
 * {@code IconColumn}/{@code ImageColumn}/{@code ColorColumn}/{@code TagsColumn} + the
 * {@code CanFormatState}/{@code CanOpenUrl}/{@code CanBeCopied}/{@code HasDescription} concerns).
 */
class DisplayColumnTest {

    record Item(boolean active, String avatar, String color, List<String> tags, long cents, String name) {}

    /**
     * @spec.given an icon column with a boolean→icon and a value→colour mapping
     * @spec.when  a row is rendered
     * @spec.then  the icon name and colour are resolved from the value
     */
    @Test
    void icon_column_maps_value_to_icon_and_color() {
        IconColumn<Item> col =
                IconColumn.<Item>make("Active", Item::active)
                        .bool("check", "x")
                        .color(v -> Boolean.TRUE.equals(v) ? "success" : "danger");

        Item active = new Item(true, "", "", List.of(), 0, "");
        assertThat(col.iconFor(active)).isEqualTo("check");
        assertThat(col.colorFor(active)).isEqualTo("success");
    }

    /**
     * @spec.given an image column marked circular at a size
     * @spec.when  a row is rendered
     * @spec.then  the URL is the cell value and the circular/size config is exposed
     */
    @Test
    void image_column_renders_a_circular_avatar() {
        ImageColumn<Item> col = ImageColumn.<Item>make("Avatar", Item::avatar).circular().size(64);

        Item item = new Item(false, "https://x/y.png", "", List.of(), 0, "");
        assertThat(col.urlFor(item)).isEqualTo("https://x/y.png");
        assertThat(col.isCircular()).isTrue();
        assertThat(col.size()).isEqualTo(64);
    }

    /**
     * @spec.given a color column
     * @spec.when  a row is rendered
     * @spec.then  the CSS colour string is the cell value
     */
    @Test
    void color_column_renders_a_swatch() {
        ColorColumn<Item> col = ColorColumn.<Item>make("Color", Item::color).copyable();

        assertThat(col.colorFor(new Item(false, "", "#ff0000", List.of(), 0, ""))).isEqualTo("#ff0000");
        assertThat(col.isCopyable()).isTrue();
    }

    /**
     * @spec.given a tags column over a collection value
     * @spec.when  a row is rendered
     * @spec.then  the individual tags are returned
     */
    @Test
    void tags_column_splits_a_collection_into_chips() {
        TagsColumn<Item> col = TagsColumn.make("Tags", Item::tags);

        Item item = new Item(false, "", "", List.of("a", "b"), 0, "");
        assertThat(col.tagsFor(item)).containsExactly("a", "b");
    }

    /**
     * @spec.given a tags column over a separator-joined string
     * @spec.when  a row is rendered with a declared separator
     * @spec.then  the string is split into trimmed tags
     */
    @Test
    void tags_column_splits_a_joined_string_by_separator() {
        TagsColumn<Item> col = TagsColumn.<Item>make("Tags", Item::name).separator(",");

        Item item = new Item(false, "", "", List.of(), 0, "a, b ,c");
        assertThat(col.tagsFor(item)).containsExactly("a", "b", "c");
    }

    /**
     * @spec.given a text column formatting cents as EUR money
     * @spec.when  a row is rendered
     * @spec.then  the cell shows a formatted currency amount
     */
    @Test
    void text_column_formats_money() {
        TextColumn<Item> col =
                TextColumn.<Item>make("Price", i -> i.cents() / 100.0).money("EUR");

        Item item = new Item(false, "", "", List.of(), 1999, "");
        assertThat(col.cell(item)).contains("19").contains("99");
    }

    /**
     * @spec.given a text column with a length limit
     * @spec.when  a long value is rendered
     * @spec.then  it is truncated with an ellipsis
     */
    @Test
    void text_column_limits_length() {
        TextColumn<Item> col = TextColumn.<Item>make("Name", Item::name).limit(3);

        assertThat(col.cell(new Item(false, "", "", List.of(), 0, "Parma"))).isEqualTo("Par…");
    }

    /**
     * @spec.given a text column with a url, description and tooltip
     * @spec.when  a row is rendered
     * @spec.then  the link, description and tooltip resolve from the row
     */
    @Test
    void text_column_exposes_url_description_and_tooltip() {
        TextColumn<Item> col =
                TextColumn.<Item>make("Name", Item::name)
                        .url(i -> "/items/" + i.name())
                        .description(i -> "desc " + i.name())
                        .tooltip(i -> "tip")
                        .copyable();

        Item item = new Item(false, "", "", List.of(), 0, "x");
        assertThat(col.hasUrl()).isTrue();
        assertThat(col.urlFor(item)).contains("/items/x");
        assertThat(col.descriptionFor(item)).contains("desc x");
        assertThat(col.tooltipFor(item)).contains("tip");
        assertThat(col.isCopyable()).isTrue();
    }
}
