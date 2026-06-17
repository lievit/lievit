/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.support;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the shared enum vocabulary (Size / Width / Alignment / IconPosition): one CSS token per
 * constant so a component never invents its own scale and the class mapping lives in one place.
 */
class SharedEnumsTest {

    /**
     * @spec.given the Size enum
     * @spec.when  token() is read for each constant
     * @spec.then  it maps to the canonical short CSS token
     */
    @Test
    void size_maps_each_constant_to_its_css_token() {
        assertThat(Size.EXTRA_SMALL.token()).isEqualTo("xs");
        assertThat(Size.MEDIUM.token()).isEqualTo("md");
        assertThat(Size.EXTRA_LARGE.token()).isEqualTo("xl");
    }

    /**
     * @spec.given the Width enum
     * @spec.when  token() is read
     * @spec.then  the multi-step widths and the special full/screen widths map correctly
     */
    @Test
    void width_maps_steps_and_special_widths() {
        assertThat(Width.TWO_EXTRA_LARGE.token()).isEqualTo("2xl");
        assertThat(Width.FULL.token()).isEqualTo("full");
        assertThat(Width.SCREEN.token()).isEqualTo("screen");
    }

    /**
     * @spec.given the Alignment enum
     * @spec.when  token() is read
     * @spec.then  logical and explicit alignments both expose their token
     */
    @Test
    void alignment_exposes_logical_and_explicit_tokens() {
        assertThat(Alignment.START.token()).isEqualTo("start");
        assertThat(Alignment.CENTER.token()).isEqualTo("center");
        assertThat(Alignment.RIGHT.token()).isEqualTo("right");
    }

    /**
     * @spec.given the IconPosition enum
     * @spec.when  token() is read
     * @spec.then  before/after map to their tokens
     */
    @Test
    void icon_position_maps_before_and_after() {
        assertThat(IconPosition.BEFORE.token()).isEqualTo("before");
        assertThat(IconPosition.AFTER.token()).isEqualTo("after");
    }
}
