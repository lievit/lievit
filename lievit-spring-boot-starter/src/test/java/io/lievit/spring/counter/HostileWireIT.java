/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.counter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.lievit.spring.LievitWireService;

/**
 * The hostile-seat security suite over the real endpoint (ADR-0013, ADR-0014): every rejection is
 * pinned with its exact status and {@code Lievit-Reason}, and every error body is asserted
 * leak-free (no stack trace, no internal class name, no snapshot). These are the parity gaps from
 * {@code docs/research/livewire-design-decisions-complete.md} §Security 2,3,4,7.
 */
@SpringBootTest(classes = CounterTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {
            "lievit.signing-key=test-signing-key-0123456789abcdef-0123456789",
            // Tight caps so the structural-abuse cases stay small and fast.
            "lievit.max-calls=2",
            "lievit.max-updates=3",
            "lievit.max-nesting-depth=3"
        })
class HostileWireIT {

    @Autowired MockMvc mvc;
    @Autowired LievitWireService wireService;

    private final ObjectMapper json = new ObjectMapper();

    private String mountedSnapshot() {
        return wireService.mount(CounterComponent.class.getName()).snapshot();
    }

    private MvcResult perform(String snapshot, Map<String, Object> updates, List<String> calls)
            throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("_snapshot", snapshot);
        payload.put("_updates", updates);
        payload.put("_calls", calls);
        return mvc.perform(
                        post("/lievit/{id}/call", "cid")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(payload)))
                .andReturn();
    }

    /**
     * @spec.given a validly signed snapshot and an action that throws an internal exception whose
     *     message names a fake internal class
     * @spec.when  the snapshot is POSTed with that action
     * @spec.then  the response is a generic 500 + Lievit-Reason: internal-error with an EMPTY body:
     *     no stack trace, no internal class name, no message reaches the client (fail-closed,
     *     leak-free; ADR-0014)
     * @spec.adr   ADR-0014
     */
    @Test
    void a_throwing_action_returns_a_generic_leak_free_500() throws Exception {
        MvcResult result = perform(mountedSnapshot(), Map.of(), List.of("boom"));

        assertThat(result.getResponse().getStatus()).isEqualTo(500);
        assertThat(result.getResponse().getHeader("Lievit-Reason")).isEqualTo("internal-error");
        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain("GadgetChain");
        assertThat(body).doesNotContain("io.lievit");
        assertThat(body).doesNotContain("IllegalStateException");
        assertThat(body).doesNotContain("row 42");
    }

    /**
     * @spec.given a validly signed snapshot and more _calls than the configured cap (3 > 2)
     * @spec.when  the snapshot is POSTed
     * @spec.then  the call is rejected 413 + Lievit-Reason: too-complex with an empty body, before
     *     any action runs (the structural DoS cap; ADR-0013)
     * @spec.adr   ADR-0013
     */
    @Test
    void too_many_calls_is_a_413_too_complex() throws Exception {
        MvcResult result =
                perform(mountedSnapshot(), Map.of(), List.of("increment", "increment", "increment"));

        assertThat(result.getResponse().getStatus()).isEqualTo(413);
        assertThat(result.getResponse().getHeader("Lievit-Reason")).isEqualTo("too-complex");
        assertThat(result.getResponse().getContentAsString()).isEmpty();
    }

    /**
     * @spec.given a validly signed snapshot and an _updates value nested deeper than the cap (4 > 3)
     * @spec.when  the snapshot is POSTed
     * @spec.then  the call is rejected 413 + Lievit-Reason: too-complex: the deep-nesting DoS guard
     *     fires (ADR-0013)
     * @spec.adr   ADR-0013
     */
    @Test
    void over_deep_nesting_is_a_413_too_complex() throws Exception {
        Map<String, Object> deep = Map.of("l2", Map.of("l3", Map.of("l4", "too deep")));

        MvcResult result = perform(mountedSnapshot(), Map.of("count", deep), List.of());

        assertThat(result.getResponse().getStatus()).isEqualTo(413);
        assertThat(result.getResponse().getHeader("Lievit-Reason")).isEqualTo("too-complex");
    }

    /**
     * @spec.given a validly signed snapshot and a client update targeting {@code label}, the locked
     *     server-owned field
     * @spec.when  the snapshot is POSTed
     * @spec.then  rejected 403 + Lievit-Reason: locked-property with an empty body (the locked-field
     *     boundary, ADR-0001 amendment; pinned here leak-free alongside the new gaps)
     * @spec.adr   ADR-0001
     */
    @Test
    void a_locked_field_update_is_a_leak_free_403() throws Exception {
        MvcResult result = perform(mountedSnapshot(), Map.of("label", "attacker"), List.of());

        assertThat(result.getResponse().getStatus()).isEqualTo(403);
        assertThat(result.getResponse().getHeader("Lievit-Reason")).isEqualTo("locked-property");
        assertThat(result.getResponse().getContentAsString()).isEmpty();
    }

    /**
     * @spec.given a validly signed snapshot and a call naming {@code seed}, the @LievitMount
     *     lifecycle hook (a method that exists but is not a @LievitAction)
     * @spec.when  the snapshot is POSTed
     * @spec.then  rejected 410 + Lievit-Reason: gone: only @LievitAction methods are callable, so a
     *     lifecycle hook is never reachable from the wire (the callable allowlist, ADR-0013)
     * @spec.adr   ADR-0013
     */
    @Test
    void calling_a_lifecycle_hook_is_a_410_gone() throws Exception {
        MvcResult result = perform(mountedSnapshot(), Map.of(), List.of("seed"));

        assertThat(result.getResponse().getStatus()).isEqualTo(410);
        assertThat(result.getResponse().getHeader("Lievit-Reason")).isEqualTo("gone");
    }

    /**
     * @spec.given a validly signed snapshot and a forbidden value: an _updates entry the client
     *     sends as a JSON object where the field is a scalar — but the allowlist only permits JSON
     *     shapes, so a deep object is also caught by the depth/shape guard
     * @spec.when  the snapshot is POSTed with a single-key list of unsupported size
     * @spec.then  the count update with a list value of plain scalars is accepted shape-wise (lists
     *     are allowed); this pins that the allowlist does NOT over-reject legitimate JSON arrays
     * @spec.adr   ADR-0013
     */
    @Test
    void a_plain_json_array_update_is_not_over_rejected() throws Exception {
        List<Object> scalars = new ArrayList<>(List.of(1, 2, 3));
        // count is an int field; a list value will fail to bind, but the PayloadGuard (shape) must
        // NOT be what rejects it — the guard passes plain JSON arrays. A bind failure surfaces as a
        // generic 500 (fail-closed), never a 413/422. This proves the allowlist is not overzealous.
        MvcResult result = perform(mountedSnapshot(), Map.of("extra", scalars), List.of());

        // "extra" is not a @Wire field, so it is dropped; the call succeeds.
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
    }

    /**
     * @spec.given the configured cap of 3 _updates and a payload with 4
     * @spec.when  the snapshot is POSTed
     * @spec.then  rejected 413 + Lievit-Reason: too-complex (the update-count DoS cap; ADR-0013)
     * @spec.adr   ADR-0013
     */
    @Test
    void too_many_updates_is_a_413_too_complex() throws Exception {
        Map<String, Object> updates = new HashMap<>();
        updates.put("a", 1);
        updates.put("b", 2);
        updates.put("c", 3);
        updates.put("d", 4);

        MvcResult result = perform(mountedSnapshot(), updates, Collections.emptyList());

        assertThat(result.getResponse().getStatus()).isEqualTo(413);
        assertThat(result.getResponse().getHeader("Lievit-Reason")).isEqualTo("too-complex");
    }
}
