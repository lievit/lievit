/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.wire;

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
 * timestamp deque is pruned on every touch, so memory stays bounded by the active client set.
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
        synchronized (timestamps) {
            prune(timestamps, now);
            return timestamps.size();
        }
    }

    private void prune(Deque<Instant> timestamps, Instant now) {
        Instant cutoff = now.minus(window);
        while (!timestamps.isEmpty() && !timestamps.peekFirst().isAfter(cutoff)) {
            timestamps.removeFirst();
        }
    }
}
