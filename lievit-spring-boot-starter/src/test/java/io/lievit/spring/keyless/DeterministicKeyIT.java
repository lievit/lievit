/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.keyless;

import static io.lievit.test.Lievit.test;

import org.junit.jupiter.api.Test;

import io.lievit.test.LievitTest;

/**
 * End-to-end deterministic {@code wire:key} generation over the real wire pipeline (ADR-0023, issue
 * #175), driven through the {@code Lievit.test()} harness. The parent declares its row children
 * <strong>without</strong> an explicit {@code @key}; the dispatcher binds a
 * {@code DeterministicKeyScope} seeded with the compiler's crc32 generator, so each keyless child
 * gets a stable, distinct {@code lw-<crc32(template)>-<counter>} key. This is the gestionale
 * list/table case: the generated keys are the morph anchor, and a re-render is key-stable so state
 * does not bleed between rows.
 */
@LievitTest(classes = KeylessTestApp.class)
class DeterministicKeyIT {

    // crc32("keyless/list") = 0x5dbd6c26: the children's key namespace is the parent's template id.
    private static final String K = "lw-5dbd6c26-";

    /**
     * @spec.given a mounted parent that declares three keyless row children in a loop
     * @spec.when  the parent renders
     * @spec.then  each child root carries a stable, distinct deterministic lw-<crc32>-<counter> key,
     *     in render order: the generated key is the morph anchor for a keyless list
     * @spec.adr   ADR-0023
     * @spec.us    US-deterministic-keys
     */
    @Test
    void keyless_children_get_stable_distinct_deterministic_keys() {
        test(KeylessListComponent.class)
                .mount()
                .assertWire("rows", 3)
                .assertSee("lievit:key=\"" + K + "0\"")
                .assertSee("lievit:key=\"" + K + "1\"")
                .assertSee("lievit:key=\"" + K + "2\"")
                .assertSeeInOrder(
                        "lievit:key=\"" + K + "0\"",
                        "lievit:key=\"" + K + "1\"",
                        "lievit:key=\"" + K + "2\"")
                // No raw placeholder leaks: every keyless child was substituted.
                .assertDontSee("<!--lievit:child:");
    }

    /**
     * @spec.given a mounted parent with three keyless rows
     * @spec.when  addRow runs over the wire, growing the list to four rows
     * @spec.then  the re-render is key-stable: positions 0..2 keep their keys (the morph preserves
     *     their DOM) and a fourth deterministic key appears for the new row
     * @spec.adr   ADR-0023
     * @spec.us    US-deterministic-keys
     */
    @Test
    void re_render_is_key_stable_for_keyless_children() {
        test(KeylessListComponent.class)
                .mount()
                .assertSee("lievit:key=\"" + K + "2\"")
                .assertDontSee("lievit:key=\"" + K + "3\"")
                .call("addRow")
                .assertWire("rows", 4)
                .assertSee("lievit:key=\"" + K + "0\"")
                .assertSee("lievit:key=\"" + K + "1\"")
                .assertSee("lievit:key=\"" + K + "2\"")
                .assertSee("lievit:key=\"" + K + "3\"")
                .assertSnapshotRotated();
    }
}
