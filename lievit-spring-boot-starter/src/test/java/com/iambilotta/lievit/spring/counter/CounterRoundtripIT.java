/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring.counter;

import static com.iambilotta.lievit.test.Lievit.test;

import org.junit.jupiter.api.Test;

import com.iambilotta.lievit.test.LievitTest;
import com.iambilotta.lievit.test.Rejections.LockedProperty;
import com.iambilotta.lievit.test.Rejections.SnapshotForged;
import com.iambilotta.lievit.test.Rejections.TooManyFailures;

/**
 * The walking-skeleton golden roundtrip (ADR-0007), rewritten on top of the {@code Lievit.test()}
 * harness (ADR-0010). This is the dogfooding proof: the verbose hand-rolled version (raw MockMvc,
 * hand-built JSON maps, manual snapshot juggling, string-grep) collapses into the fluent intent
 * mount → call → assert. The harness drives the same real codec / registry / dispatcher / JTE
 * adapter / HTTP endpoint underneath; only the developer-facing surface changed.
 *
 * <p>It still exercises the same three behaviours: the increment roundtrip with snapshot rotation,
 * the locked-field tamper rejected 403 from the attacker's seat, and the forged-snapshot rejection
 * — plus the rate-limit (429), which the harness makes reachable headless and which the old
 * hand-rolled test never asserted.
 */
@LievitTest(classes = CounterTestApp.class)
class CounterRoundtripIT {

    /**
     * @spec.given a freshly mounted Counter and its signed initial snapshot
     * @spec.when  that snapshot is carried back over the wire with an increment action
     * @spec.then  the count advances to 1, the re-rendered HTML shows it, and a fresh snapshot rotated
     * @spec.adr   ADR-0001
     */
    @Test
    void mounts_then_increments_over_the_wire_endpoint() {
        test(CounterComponent.class)
                .mount()
                .assertWire("count", 0)
                .assertSee(">0<")
                .assertSeeHtml("l:click=\"increment\"")
                .call("increment")
                .assertWire("count", 1)
                .assertSee(">1<")
                .assertSnapshotRotated();
    }

    /**
     * @spec.given a validly signed Counter snapshot and a client update to the locked label field
     * @spec.when  the snapshot is carried back with that hostile update and an increment
     * @spec.then  the call is rejected 403 locked-property: the lock stops a client writing a
     *     server-owned field even though the snapshot signature is valid
     * @spec.adr   ADR-0001
     */
    @Test
    void rejects_a_client_update_to_a_locked_field_with_403() {
        test(CounterComponent.class)
                .mount()
                .tamperUpdate("label", "attacker-set")
                .call("increment")
                .assertRejected(LockedProperty.class);
    }

    /**
     * @spec.given a tampered snapshot (a flipped payload byte) carried back to the endpoint
     * @spec.when  it is POSTed
     * @spec.then  the call is rejected at the HMAC boundary, never reaching the component
     * @spec.adr   ADR-0001
     */
    @Test
    void rejects_a_tampered_snapshot_at_the_endpoint() {
        test(CounterComponent.class)
                .mount()
                .forgeSnapshot()
                .call("increment")
                .assertRejected(SnapshotForged.class);
    }

    /**
     * @spec.given a mounted Counter whose signature is brute-forced past the failure budget
     * @spec.when  more than the allowed signature failures arrive from the client
     * @spec.then  the client is rate-limited 429 too-many-failures — reachable headless here,
     *     unlike Livewire's component tester which short-circuits the limiter in tests
     * @spec.adr   ADR-0001
     */
    @Test
    void brute_forcing_the_signature_is_rate_limited() {
        var tester = test(CounterComponent.class).mount();
        for (int i = 0; i < 10; i++) {
            tester.forgeSnapshot().callExpectingRejection().assertRejected(SnapshotForged.class);
        }
        tester.forgeSnapshot().callExpectingRejection().assertRejected(TooManyFailures.class);
    }
}
