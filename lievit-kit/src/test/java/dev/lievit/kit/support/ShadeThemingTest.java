/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the shade-level theming depth: generating a full OKLCH ramp from one brand hex,
 * overriding a single shade without redefining the ramp, and emitting registered colors as CSS
 * custom properties the theme stylesheet consumes.
 */
class ShadeThemingTest {

    /**
     * @spec.given a single brand hex (Tailwind blue-500)
     * @spec.when  a palette is generated from it
     * @spec.then  all eleven shades exist as OKLCH strings on the fixed lightness scale, keeping the
     *     input hue, lightest at 50 and darkest at 950
     */
    @Test
    void generates_a_full_ramp_from_one_hex() {
        Color ramp = Color.generate("#3b82f6");

        assertThat(ramp.ramp().keySet())
                .containsExactly(50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950);
        // Fixed lightness scale: 50 is the lightest, 950 the darkest, hue preserved from the input.
        assertThat(ramp.shade(50)).isEqualTo("oklch(0.9772 0.1880 259.815)");
        assertThat(ramp.shade(500)).isEqualTo("oklch(0.6827 0.1880 259.815)");
        assertThat(ramp.shade(950)).isEqualTo("oklch(0.2779 0.1880 259.815)");
    }

    /**
     * @spec.given a gray brand hex
     * @spec.when  a palette is generated
     * @spec.then  the ramp is achromatic (chroma 0) so it stays neutral
     */
    @Test
    void generates_an_achromatic_ramp_for_a_gray() {
        Color ramp = Color.generate("#808080");

        assertThat(ramp.shade(500)).contains("oklch(0.6827 0.0000");
    }

    /**
     * @spec.given a generated ramp
     * @spec.when  one shade is overridden
     * @spec.then  only that shade changes; every other shade is untouched and the original is intact
     */
    @Test
    void overrides_a_single_shade_without_redefining_the_ramp() {
        Color original = Color.generate("#3b82f6");

        Color tweaked = original.withShade(600, "#0050ff");

        assertThat(tweaked.shade(600)).isEqualTo("#0050ff");
        assertThat(tweaked.shade(500)).isEqualTo(original.shade(500));
        assertThat(original.shade(600)).isNotEqualTo("#0050ff");
    }

    /**
     * @spec.given a ColorManager with primary bound to a generated ramp
     * @spec.when  CSS custom properties are emitted
     * @spec.then  each shade becomes a --lievit-{name}-{shade} declaration carrying its value
     */
    @Test
    void emits_registered_colors_as_css_custom_properties() {
        ColorManager colors = new ColorManager();
        colors.register("primary", Color.generate("#3b82f6"));

        String css = colors.cssVariables();

        assertThat(css).contains("--lievit-primary-50: oklch(0.9772 0.1880 259.815);");
        assertThat(css).contains("--lievit-primary-950: oklch(0.2779 0.1880 259.815);");
        assertThat(css).contains("--lievit-danger-500:");
    }

    /**
     * @spec.given a generated ramp with a removed shade
     * @spec.when  the ramp keys are read
     * @spec.then  the removed shade is gone and the rest remain
     */
    @Test
    void removes_a_shade() {
        Color ramp = Color.generate("#3b82f6").withoutShade(400);

        assertThat(ramp.ramp().keySet()).doesNotContain(400).contains(300, 500);
    }
}
