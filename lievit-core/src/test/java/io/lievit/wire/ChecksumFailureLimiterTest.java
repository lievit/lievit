/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;

/**
 * Specifies the checksum-failure rate limiter: a client may fail up to the budget inside the
 * window, the next failure trips a 429, failures aging past the window stop counting, and clients
 * are independent (Livewire parity: 10 / 600 s, ADR-0001 amendment).
 */
class ChecksumFailureLimiterTest {

    private static final String CLIENT = "203.0.113.7";

    private final AtomicReference<Instant> now =
            new AtomicReference<>(Instant.parse("2026-06-17T12:00:00Z"));

    private ChecksumFailureLimiter limiter() {
        return new ChecksumFailureLimiter(10, Duration.ofSeconds(600), now::get);
    }

    /**
     * @spec.given a limiter with the 10 / 600 s budget
     * @spec.when  a client records exactly 10 failures inside the window
     * @spec.then  none of them trips the limit (the budget is inclusive)
     * @spec.adr   ADR-0001
     */
    @Test
    void tolerates_failures_up_to_the_budget() {
        ChecksumFailureLimiter limiter = limiter();

        assertThatCode(
                        () -> {
                            for (int i = 0; i < 10; i++) {
                                limiter.recordFailure(CLIENT);
                            }
                        })
                .doesNotThrowAnyException();
        assertThat(limiter.failureCount(CLIENT)).isEqualTo(10);
    }

    /**
     * @spec.given a client that has already failed 10 times inside the window
     * @spec.when  it fails once more
     * @spec.then  the limiter trips TOO_MANY_CHECKSUM_FAILURES (429)
     * @spec.adr   ADR-0001
     */
    @Test
    void trips_on_the_failure_past_the_budget() {
        ChecksumFailureLimiter limiter = limiter();
        for (int i = 0; i < 10; i++) {
            limiter.recordFailure(CLIENT);
        }

        assertThatThrownBy(() -> limiter.recordFailure(CLIENT))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.TOO_MANY_CHECKSUM_FAILURES);
    }

    /**
     * @spec.given a client that failed up to the budget, then the window fully elapses
     * @spec.when  it fails again after the window
     * @spec.then  the aged failures no longer count, so the new failure does not trip
     * @spec.adr   ADR-0001
     */
    @Test
    void forgets_failures_older_than_the_window() {
        ChecksumFailureLimiter limiter = limiter();
        for (int i = 0; i < 10; i++) {
            limiter.recordFailure(CLIENT);
        }

        now.set(now.get().plus(Duration.ofSeconds(601)));

        assertThatCode(() -> limiter.recordFailure(CLIENT)).doesNotThrowAnyException();
        assertThat(limiter.failureCount(CLIENT)).isEqualTo(1);
    }

    /**
     * @spec.given two distinct clients
     * @spec.when  one exhausts its budget
     * @spec.then  the other client's budget is untouched (per-client keying)
     * @spec.adr   ADR-0001
     */
    @Test
    void keeps_clients_independent() {
        ChecksumFailureLimiter limiter = limiter();
        for (int i = 0; i < 10; i++) {
            limiter.recordFailure(CLIENT);
        }

        assertThat(limiter.failureCount("198.51.100.2")).isZero();
        assertThatCode(() -> limiter.recordFailure("198.51.100.2")).doesNotThrowAnyException();
    }

    /**
     * @spec.given a client whose only failure has aged out of the window
     * @spec.when  its state is next observed via failureCount
     * @spec.then  its now-empty entry is evicted, so a quiet client leaves no residue in the map
     * @spec.adr   ADR-0001
     */
    @Test
    void evicts_a_drained_client_entry_on_touch() {
        ChecksumFailureLimiter limiter = limiter();
        limiter.recordFailure(CLIENT);
        assertThat(limiter.trackedClientCount()).isEqualTo(1);

        now.set(now.get().plus(Duration.ofSeconds(601)));

        assertThat(limiter.failureCount(CLIENT)).isZero();
        assertThat(limiter.trackedClientCount()).isZero();
    }

    /**
     * @spec.given many distinct client IPs that each fail once and then never return (IP rotation),
     *     followed by the window elapsing
     * @spec.when  a further failure crosses the sweep threshold
     * @spec.then  the aged-out entries are swept, so the map collapses to the active client set and
     *     does not grow unbounded (the anti-DoS control is not itself a memory-DoS vector)
     * @spec.adr   ADR-0001
     */
    @Test
    void sweeps_stale_entries_so_the_map_does_not_grow_unbounded_under_ip_rotation() {
        ChecksumFailureLimiter limiter = limiter();

        // 2000 rotated IPs each fail once: the map grows past the sweep threshold (1024).
        for (int i = 0; i < 2000; i++) {
            limiter.recordFailure("10.0." + (i / 256) + "." + (i % 256));
        }
        assertThat(limiter.trackedClientCount()).isGreaterThan(1024);

        // The whole rotation ages out of the window, then one live client fails: the sweep fires.
        now.set(now.get().plus(Duration.ofSeconds(601)));
        limiter.recordFailure("203.0.113.250");

        // Only the one currently-active client remains; the 2000 rotated entries were reclaimed.
        assertThat(limiter.trackedClientCount()).isEqualTo(1);
    }
}
