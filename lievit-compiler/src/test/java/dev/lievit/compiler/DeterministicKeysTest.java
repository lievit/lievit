/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Golden + stability spec for deterministic key generation (ADR-0023, issue #175): the key is
 * {@code lw-<crc32(templateId)>-<counter>} (Livewire {@code DeterministicBladeKeys} parity), stable
 * for the same template position across re-renders, distinct between sibling positions, and
 * distinct between templates. This is the morph anchor for keyed children in loops; wrong keys
 * bleed state between rows.
 */
class DeterministicKeysTest {

    /**
     * @spec.given a known template id and a counter
     * @spec.when  a key is generated
     * @spec.then  it is exactly {@code lw-<crc32-hex>-<counter>} (golden), matching the Livewire shape
     * @spec.adr   ADR-0023
     */
    @Test
    void generates_the_golden_lw_crc32_counter_key() {
        // crc32("dev.lievit.RowComponent") = 0x9aa6af0c (verified against zlib.crc32).
        assertThat(DeterministicKeys.of("dev.lievit.RowComponent", 0)).isEqualTo("lw-9aa6af0c-0");
        assertThat(DeterministicKeys.of("dev.lievit.RowComponent", 2)).isEqualTo("lw-9aa6af0c-2");
    }

    /**
     * @spec.given the same template id and counter generated twice
     * @spec.when  the keys are compared
     * @spec.then  they are identical: the position is stable across re-renders (the morph anchor)
     * @spec.adr   ADR-0023
     */
    @Test
    void the_same_position_is_stable_across_re_renders() {
        assertThat(DeterministicKeys.of("t", 5)).isEqualTo(DeterministicKeys.of("t", 5));
    }

    /**
     * @spec.given two different templates and two different counters
     * @spec.when  keys are generated
     * @spec.then  different templates and different positions yield different keys (no collision)
     * @spec.adr   ADR-0023
     */
    @Test
    void distinct_templates_and_positions_do_not_collide() {
        assertThat(DeterministicKeys.of("a", 0)).isNotEqualTo(DeterministicKeys.of("b", 0));
        assertThat(DeterministicKeys.of("a", 0)).isNotEqualTo(DeterministicKeys.of("a", 1));
    }

    /**
     * @spec.given the deterministic-key generator as a BiFunction
     * @spec.when  it is used to build a DeterministicKeyScope and three keyless children are counted
     * @spec.then  the scope yields lw- keys with an advancing counter scoped to the template
     * @spec.adr   ADR-0023
     */
    @Test
    void the_generator_drives_a_scope_with_an_advancing_counter() {
        var scope = new dev.lievit.component.DeterministicKeyScope(DeterministicKeys.GENERATOR);
        scope.enter("dev.lievit.RowComponent");

        assertThat(scope.nextKey()).isEqualTo("lw-9aa6af0c-0");
        assertThat(scope.nextKey()).isEqualTo("lw-9aa6af0c-1");
        assertThat(scope.nextKey()).isEqualTo("lw-9aa6af0c-2");
    }
}
