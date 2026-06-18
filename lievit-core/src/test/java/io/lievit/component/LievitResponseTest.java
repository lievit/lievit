/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * Pins the per-request response-control sink (issue #123, Livewire
 * {@code SupportDisablingBackButtonCache} parity): a component calls
 * {@link LievitResponse#disableBackButtonCache()} during mount/render, the bound sink records it for
 * the response filter to read, the flag is per-request (a fresh sink starts clean), and the call is a
 * safe no-op when no sink is bound (off the wire). Bound like the other request-scoped sinks.
 */
class LievitResponseTest {

    @AfterEach
    void unbind() {
        LievitResponse.clear();
    }

    /**
     * @spec.given a freshly bound response-control sink
     * @spec.when  the back-button-cache flag is read before any component opts out
     * @spec.then  it is false (the default: a page is bfcache-eligible)
     * @spec.adr   ADR-0012
     */
    @Test
    void a_fresh_sink_leaves_the_back_button_cache_enabled() {
        LievitResponse response = new LievitResponse();
        assertThat(response.isBackButtonCacheDisabled()).isFalse();
    }

    /**
     * @spec.given a response-control sink bound for the current request
     * @spec.when  a component calls disableBackButtonCache() during its mount
     * @spec.then  the bound sink records the opt-out for the filter to read
     * @spec.adr   ADR-0012
     */
    @Test
    void disabling_the_back_button_cache_sets_the_flag_on_the_bound_sink() {
        LievitResponse response = new LievitResponse();
        LievitResponse.bind(response);

        LievitResponse.disableBackButtonCache();

        assertThat(response.isBackButtonCacheDisabled()).isTrue();
        assertThat(LievitResponse.current()).isSameAs(response);
    }

    /**
     * @spec.given no response-control sink is bound (a unit test or server-side code off the wire)
     * @spec.when  disableBackButtonCache() is called
     * @spec.then  it is a no-op: no sink is bound, the call does not throw, current() stays null
     * @spec.adr   ADR-0012
     */
    @Test
    void disabling_the_back_button_cache_off_the_wire_is_a_no_op() {
        LievitResponse.disableBackButtonCache();

        assertThat(LievitResponse.current()).isNull();
    }

    /**
     * @spec.given a request that opted out of bfcache, then a following request with a fresh sink
     * @spec.when  the second request's sink is read
     * @spec.then  it is clean: the flag resets per request, so a non-lievit request is unaffected
     * @spec.adr   ADR-0012
     */
    @Test
    void the_flag_resets_per_request() {
        LievitResponse first = new LievitResponse();
        LievitResponse.bind(first);
        LievitResponse.disableBackButtonCache();
        LievitResponse.clear();

        LievitResponse second = new LievitResponse();
        LievitResponse.bind(second);

        assertThat(second.isBackButtonCacheDisabled()).isFalse();
    }
}
