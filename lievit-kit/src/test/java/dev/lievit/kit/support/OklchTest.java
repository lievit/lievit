/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

/**
 * Specifies {@link Oklch}: the sRGB-hex → OKLCH conversion (Björn Ottosson's OKLab pipeline, the
 * same Filament v4 uses), the achromatic detection, and the stable CSS formatting.
 */
class OklchTest {

    /**
     * @spec.given the Tailwind blue-500 hex #3b82f6
     * @spec.when  it is converted to OKLCH
     * @spec.then  the lightness / chroma / hue match the OKLab pipeline to four decimals
     */
    @Test
    void converts_a_hex_to_oklch() {
        Oklch c = Oklch.fromHex("#3b82f6");

        assertThat(c.lightness()).isCloseTo(0.6231, within(0.0005));
        assertThat(c.chroma()).isCloseTo(0.1880, within(0.0005));
        assertThat(c.hue()).isCloseTo(259.815, within(0.01));
    }

    /**
     * @spec.given a pure gray hex
     * @spec.when  it is converted
     * @spec.then  chroma is near zero and it reports achromatic
     */
    @Test
    void detects_an_achromatic_color() {
        Oklch gray = Oklch.fromHex("#808080");

        assertThat(gray.chroma()).isLessThan(Oklch.ACHROMATIC_THRESHOLD);
        assertThat(gray.isAchromatic()).isTrue();
        assertThat(Oklch.fromHex("#3b82f6").isAchromatic()).isFalse();
    }

    /**
     * @spec.given an OKLCH triple
     * @spec.when  rendered to CSS
     * @spec.then  it is a stable oklch(L C H) string formatted to fixed precision
     */
    @Test
    void renders_stable_css() {
        assertThat(new Oklch(0.6231, 0.1880, 259.815).css())
                .isEqualTo("oklch(0.6231 0.1880 259.815)");
    }

    /**
     * @spec.given a hex with or without a leading hash, and a bad hex
     * @spec.when  it is parsed
     * @spec.then  both valid forms parse equal and an invalid form is rejected
     */
    @Test
    void parses_hex_with_or_without_hash_and_rejects_bad_input() {
        assertThat(Oklch.fromHex("3b82f6")).isEqualTo(Oklch.fromHex("#3b82f6"));
        assertThatThrownBy(() -> Oklch.fromHex("#abc"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Oklch.fromHex("#zzzzzz"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
