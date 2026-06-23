/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * A per-client budget for snapshot signature / checksum failures: more than {@code maxFailures}
 * within {@code window} from one client trips a {@link WireError#TOO_MANY_CHECKSUM_FAILURES} (429).
 *
 * <p>This is a brute-force / probing defense layered on top of the HMAC (Livewire parity: 10
 * failures per 600 s, ADR-0001 amendment). The HMAC already makes a forged snapshot unusable; the
 * limiter stops a client from grinding against the signature offline. Pure Java, zero Spring
 * (ADR-0007); the starter keys it on the client IP.
 *
 * <p>The clock is injectable so the window logic is unit-testable without sleeping. The per-client
 * timestamp deque is pruned on every touch, and the map entry is evicted the moment its deque drains
 * to empty (under the same lock), so memory stays bounded by the <em>currently active</em> client
 * set: a client that stops failing leaves no residue, and IP rotation cannot grow the map without
 * bound (the entry for a rotated-away IP is gone as soon as its last failure ages out of the
 * window). Without that eviction the map is itself a memory-DoS vector under rotation.
 */
public final class ChecksumFailureLimiter {

    /** Livewire's default: 10 failures. */
    public static final int DEFAULT_MAX_FAILURES = 10;

    /** Livewire's default: 600 s. */
    public static final Duration DEFAULT_WINDOW = Duration.ofSeconds(600);

    private final int maxFailures;
    private final Duration window;
    private final Supplier<Instant> clock;
    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    /** Uses the Livewire-parity defaults (10 / 600 s) and the system clock. */
    public ChecksumFailureLimiter() {
        this(DEFAULT_MAX_FAILURES, DEFAULT_WINDOW, Instant::now);
    }

    /**
     * @param maxFailures the number of failures tolerated within the window before tripping
     * @param window the sliding window
     * @param clock the time source (injectable for deterministic tests)
     */
    public ChecksumFailureLimiter(int maxFailures, Duration window, Supplier<Instant> clock) {
        this.maxFailures = maxFailures;
        this.window = window;
        this.clock = clock;
    }

    /**
     * Records a checksum failure for a client and enforces the budget.
     *
     * @param client the client key (the IP, supplied by the web layer)
     * @throws WireException {@link WireError#TOO_MANY_CHECKSUM_FAILURES} once the client exceeds the
     *     budget within the window
     */
    public void recordFailure(String client) {
        Instant now = clock.get();
        Deque<Instant> timestamps = failures.computeIfAbsent(client, k -> new ArrayDeque<>());
        synchronized (timestamps) {
            prune(timestamps, now);
            timestamps.addLast(now);
            if (timestamps.size() > maxFailures) {
                throw new WireException(
                        WireError.TOO_MANY_CHECKSUM_FAILURES,
                        "too many snapshot signature failures from this client");
            }
        }
        // The current client's deque is non-empty (we just added), so the touch-based eviction below
        // never reclaims it; the unbounded growth comes from OTHER clients whose last failure has
        // aged out but whose entry is never revisited (the IP-rotation memory-DoS). Sweep them on an
        // amortized cadence: the scan is O(map) but only runs once the map outgrows the plausible
        // active set, so the per-call cost stays ~O(1).
        if (failures.size() > SWEEP_THRESHOLD) {
            sweepStaleEntries(now);
        }
    }

    /**
     * @param client the client key
     * @return the number of failures currently inside the window for the client
     */
    public int failureCount(String client) {
        Instant now = clock.get();
        Deque<Instant> timestamps = failures.get(client);
        if (timestamps == null) {
            return 0;
        }
        int count;
        synchronized (timestamps) {
            prune(timestamps, now);
            count = timestamps.size();
        }
        evictIfDrained(client, timestamps);
        return count;
    }

    /**
     * The map size past which {@link #recordFailure} triggers an amortized sweep of stale entries.
     * The active failing-client set is small in practice (only clients with a bad/forged snapshot
     * within the window), so any larger map is dominated by aged-out residue under IP rotation.
     */
    private static final int SWEEP_THRESHOLD = 1024;

    /**
     * Evicts every entry whose deque has drained to empty after pruning to {@code now}, so a map that
     * grew under IP rotation collapses back to the currently-active client set. Each deque is pruned
     * and removed under its own lock, with the value-checked {@link Map#remove(Object, Object)} so a
     * concurrent {@code recordFailure} that re-armed the same key is never clobbered.
     */
    private void sweepStaleEntries(Instant now) {
        for (Map.Entry<String, Deque<Instant>> entry : failures.entrySet()) {
            Deque<Instant> timestamps = entry.getValue();
            synchronized (timestamps) {
                prune(timestamps, now);
            }
            evictIfDrained(entry.getKey(), timestamps);
        }
    }

    /**
     * Drops the map entry for a client once its deque is empty, under the deque's own lock. The
     * value-checked {@link Map#remove(Object, Object)} only removes the exact deque instance we hold:
     * a concurrent {@code recordFailure} that won the {@code computeIfAbsent} race installed a
     * different deque and is untouched, so no in-flight failure is lost.
     */
    private void evictIfDrained(String client, Deque<Instant> timestamps) {
        synchronized (timestamps) {
            if (timestamps.isEmpty()) {
                failures.remove(client, timestamps);
            }
        }
    }

    private void prune(Deque<Instant> timestamps, Instant now) {
        Instant cutoff = now.minus(window);
        while (!timestamps.isEmpty() && !timestamps.peekFirst().isAfter(cutoff)) {
            timestamps.removeFirst();
        }
    }

    /**
     * The number of clients currently tracked in the map (the live footprint). A test seam that pins
     * the bound: it is the size that must stay bounded by the active client set, not grow with the
     * total number of IPs ever seen.
     *
     * @return the count of tracked client entries
     */
    int trackedClientCount() {
        return failures.size();
    }
}
