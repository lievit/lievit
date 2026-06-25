/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies column toggling and responsive hiding: a column marked {@link TextColumn#toggleable()}
 * can be hidden by the user (optionally hidden by default), and {@link TextColumn#hiddenFrom(String)}
 * declares a responsive-hide breakpoint (the Filament {@code CanBeToggled} +
 * {@code CanBeHiddenResponsively}).
 */
class ColumnToggleTest {

    record Row(String a, String b) {}

    /**
     * @spec.given a toggleable column
     * @spec.when  its flags are read
     * @spec.then  it reports toggleable and visible by default
     */
    @Test
    void a_toggleable_column_is_visible_by_default() {
        TextColumn<Row> col = TextColumn.<Row>make("A", Row::a).toggleable();

        assertThat(col.isToggleable()).isTrue();
        assertThat(col.toggledHiddenByDefault()).isFalse();
    }

    /**
     * @spec.given a toggleable column hidden by default
     * @spec.when  its flags are read
     * @spec.then  it reports toggleable and hidden by default
     */
    @Test
    void a_toggleable_column_can_start_hidden() {
        TextColumn<Row> col = TextColumn.<Row>make("B", Row::b).toggleable(true);

        assertThat(col.isToggleable()).isTrue();
        assertThat(col.toggledHiddenByDefault()).isTrue();
    }

    /**
     * @spec.given a column with a responsive-hide breakpoint
     * @spec.when  the breakpoint is read
     * @spec.then  it reports the declared breakpoint
     */
    @Test
    void a_column_declares_a_responsive_hide_breakpoint() {
        TextColumn<Row> col = TextColumn.<Row>make("A", Row::a).hiddenFrom("md");

        assertThat(col.hiddenFrom()).isEqualTo("md");
    }

    /**
     * @spec.given a plain column
     * @spec.when  its toggle flags are read
     * @spec.then  it is not toggleable and always visible
     */
    @Test
    void a_plain_column_is_not_toggleable() {
        TextColumn<Row> col = TextColumn.make("A", Row::a);

        assertThat(col.isToggleable()).isFalse();
        assertThat(col.hiddenFrom()).isNull();
    }
}
