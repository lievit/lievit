/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.runtime;

import static io.lievit.test.Lievit.test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.lievit.spring.LievitWireService;
import io.lievit.spring.WireCallResult;
import io.lievit.test.LievitTest;

/**
 * End-to-end Epic #34 server-side runtime parity (ADR-0030 / ADR-0031) through the real codec,
 * dispatcher (with the autoconfigured built-in listener bus), JTE adapter, and HTTP endpoint:
 * magic actions, server-driven redirects (with render skip), renderless, the convention lifecycle
 * hooks, and inbound {@code @LievitOn} events carried in {@code _events}.
 */
@LievitTest(classes = RuntimeFeaturesTestApp.class)
class RuntimeFeaturesIT {

    /**
     * @spec.given a mounted runtime component
     * @spec.when  a wire call invokes the magic action $set('count', 5)
     * @spec.then  the count property is set to 5 over the wire (no UNKNOWN_COMPONENT)
     * @spec.adr   ADR-0030
     */
    @Test
    void magic_set_sets_a_property_over_the_wire() {
        test(RuntimeComponent.class)
                .mount()
                .call("$set('count', 5)")
                .assertWire("count", 5)
                .assertSee("<span data-count>5</span>");
    }

    /**
     * @spec.given a mounted runtime component with open=false
     * @spec.when  the magic action $toggle('open') runs
     * @spec.then  open flips to true
     * @spec.adr   ADR-0030
     */
    @Test
    void magic_toggle_flips_a_boolean_over_the_wire() {
        test(RuntimeComponent.class)
                .mount()
                .call("$toggle('open')")
                .assertWire("open", true);
    }

    /**
     * @spec.given a mounted runtime component
     * @spec.when  the save action dispatches "saved"
     * @spec.then  the harness sees the dispatched event
     * @spec.adr   ADR-0030
     */
    @Test
    void an_action_dispatches_an_event_the_harness_asserts() {
        test(RuntimeComponent.class)
                .mount()
                .call("save")
                .assertDispatched("saved")
                .assertNotDispatched("deleted");
    }

    /**
     * @spec.given a mounted runtime component
     * @spec.when  the leave action calls redirect("/done")
     * @spec.then  the harness asserts the redirect effect
     * @spec.adr   ADR-0031
     */
    @Test
    void an_action_redirects_and_the_harness_asserts_it() {
        test(RuntimeComponent.class)
                .mount()
                .call("leave")
                .assertRedirect("/done");
    }

    /**
     * @spec.given a mounted runtime component whose boot()/rendered() hooks set wire flags
     * @spec.when  a wire call runs
     * @spec.then  the booted and rendered witnesses are true, proving the convention hooks fired
     * @spec.adr   ADR-0030
     */
    @Test
    void the_convention_lifecycle_hooks_fire_over_the_wire() {
        test(RuntimeComponent.class)
                .mount()
                .call("save")
                .assertWire("booted", true)
                .assertWire("rendered", true);
    }

    // --- the lower-level checks that need _events / response-body inspection ----------------------

    @SpringBootTest(classes = RuntimeFeaturesTestApp.class)
    @AutoConfigureMockMvc
    @org.springframework.test.context.TestPropertySource(
            properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
    static class WireLevel {

        @Autowired MockMvc mvc;
        @Autowired LievitWireService wireService;
        private final ObjectMapper json = new ObjectMapper();

        /**
         * @spec.given a mounted runtime component and an action that redirects
         * @spec.when  the leave action is POSTed
         * @spec.then  the redirect effect is present AND the response body carries no re-rendered
         *     panel markup (render_on_redirect=false skips the render)
         * @spec.adr   ADR-0031
         */
        @Test
        void a_redirect_skips_the_render() throws Exception {
            WireCallResult mounted = wireService.mount(RuntimeComponent.class.getName());

            MvcResult result =
                    mvc.perform(
                                    post("/lievit/{id}/call", "cid")
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content(body(mounted.snapshot(), List.of("leave"), List.of())))
                            .andExpect(status().isOk())
                            .andReturn();

            JsonNode effects = json.readTree(result.getResponse().getHeader("Lievit-Effects"));
            assertThat(effects.get("redirect").asText()).isEqualTo("/done");
            // Render skipped: the body did not re-render the panel buttons.
            assertThat(result.getResponse().getContentAsString()).doesNotContain("data-count");
        }

        /**
         * @spec.given a mounted runtime component listening for "incremented" via @LievitOn
         * @spec.when  a wire call carries an inbound _events: [{name:"incremented", detail:{id:9}}]
         * @spec.then  the handler ran (count incremented, lastEventId=9) and the component re-rendered
         * @spec.adr   ADR-0030
         */
        @Test
        void an_inbound_event_invokes_the_listener_over_the_wire() throws Exception {
            WireCallResult mounted = wireService.mount(RuntimeComponent.class.getName());

            MvcResult result =
                    mvc.perform(
                                    post("/lievit/{id}/call", "cid")
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content(
                                                    bodyWithEvents(
                                                            mounted.snapshot(),
                                                            List.of(
                                                                    Map.of(
                                                                            "name", "incremented",
                                                                            "detail", Map.of("id", 9))))))
                            .andExpect(status().isOk())
                            .andReturn();

            // The re-rendered panel shows the incremented count (0 -> 1).
            assertThat(result.getResponse().getContentAsString()).contains("<span data-count>1</span>");
        }

        private String body(String snapshot, List<String> calls, List<?> events) throws Exception {
            return json.writeValueAsString(
                    Map.of("_snapshot", snapshot, "_updates", Map.of(), "_calls", calls,
                            "_events", events));
        }

        private String bodyWithEvents(String snapshot, List<?> events) throws Exception {
            return body(snapshot, List.of(), events);
        }
    }
}
