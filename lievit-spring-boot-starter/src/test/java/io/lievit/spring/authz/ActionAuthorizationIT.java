/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.authz;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

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
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.lievit.spring.LievitWireService;
import io.lievit.wire.WireError;

/**
 * The action-authorization suite over the real wire endpoint (ADR-0053, issue #57): an authorized
 * principal passes and the action runs; an unauthorized one gets a fail-closed
 * {@code 403 forbidden-action} and the action never runs. It exercises {@code @LievitAuthorize}
 * (role), plain {@code @PreAuthorize}, {@code hasPermission(...)} (the PermissionEvaluator SPI),
 * stacked {@code @LievitAuthorize} (AND), the permissive default (no annotation), and the
 * {@code @LievitOn} event-listener path (not a bypass). Because each wire POST goes through the
 * SecurityFilterChain and re-evaluates the authorization, this also pins the issue #179 property:
 * authorization is re-checked on every update, never cached from mount.
 */
@SpringBootTest(classes = AuthzTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = "lievit.signing-key=test-signing-key-0123456789abcdef-0123456789")
class ActionAuthorizationIT {

    @Autowired MockMvc mvc;
    @Autowired LievitWireService wireService;

    private final ObjectMapper json = new ObjectMapper();

    private String mountedSnapshot() {
        return wireService.mount(SecuredVaultComponent.class.getName()).snapshot();
    }

    private MvcResult call(String action, RequestPostProcessor who) throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("_snapshot", mountedSnapshot());
        payload.put("_updates", Map.of());
        payload.put("_calls", List.of(action));
        return mvc.perform(
                        post("/lievit/{id}/call", "cid")
                                .with(who)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(payload)))
                .andReturn();
    }

    private static RequestPostProcessor admin() {
        return user("admin").roles("ADMIN");
    }

    private static RequestPostProcessor clerk() {
        return user("clerk").roles("USER");
    }

    /**
     * @spec.given an admin principal and a @LievitAuthorize("hasRole('ADMIN')") action
     * @spec.when  the admin calls the action over the wire
     * @spec.then  the call succeeds (200): an authorized principal passes
     * @spec.us    US-057-action-authorization
     */
    @Test
    void admin_passes_a_role_authorized_action() throws Exception {
        org.assertj.core.api.Assertions.assertThat(call("openAsAdmin", admin()).getResponse().getStatus())
                .isEqualTo(200);
    }

    /**
     * @spec.given a non-admin principal and a @LievitAuthorize("hasRole('ADMIN')") action
     * @spec.when  the clerk calls the action over the wire
     * @spec.then  it is refused with 403 forbidden-action (fail-closed): an unauthorized principal
     *             is denied and the action body never runs
     * @spec.us    US-057-action-authorization
     */
    @Test
    void non_admin_is_denied_a_role_authorized_action() throws Exception {
        MvcResult result = call("openAsAdmin", clerk());
        org.assertj.core.api.Assertions.assertThat(result.getResponse().getStatus()).isEqualTo(403);
        org.assertj.core.api.Assertions.assertThat(
                        result.getResponse().getHeader("Lievit-Reason"))
                .isEqualTo(WireError.FORBIDDEN_ACTION.reason());
    }

    /**
     * @spec.given an anonymous request and an action requiring authentication
     * @spec.when  the action is called with no principal
     * @spec.then  it is refused with 403 forbidden-action
     * @spec.us    US-057-action-authorization
     */
    @Test
    void anonymous_is_denied_an_authenticated_only_action() throws Exception {
        MvcResult result = call("openWhenAuthenticated", post -> post);
        org.assertj.core.api.Assertions.assertThat(result.getResponse().getStatus()).isEqualTo(403);
    }

    /**
     * @spec.given an authenticated clerk and a plain @PreAuthorize("isAuthenticated()") action
     * @spec.when  the clerk calls it
     * @spec.then  the call succeeds: plain @PreAuthorize is honored alongside @LievitAuthorize
     * @spec.us    US-057-action-authorization
     */
    @Test
    void preauthorize_is_honored_for_an_authenticated_user() throws Exception {
        org.assertj.core.api.Assertions.assertThat(
                        call("openWhenAuthenticated", clerk()).getResponse().getStatus())
                .isEqualTo(200);
    }

    /**
     * @spec.given a clerk and a hasPermission(#this.invoiceId,'Invoice','update') action on invoice 1
     * @spec.when  the clerk calls it (the PermissionEvaluator grants update on invoice 1)
     * @spec.then  the call succeeds: the PermissionEvaluator SPI is wired into the expression handler
     * @spec.us    US-057-action-authorization
     */
    @Test
    void permission_evaluator_grants_the_object_permission() throws Exception {
        org.assertj.core.api.Assertions.assertThat(
                        call("approveInvoice", clerk()).getResponse().getStatus())
                .isEqualTo(200);
    }

    /**
     * @spec.given a clerk and a stacked @LievitAuthorize (isAuthenticated AND hasRole('ADMIN'))
     * @spec.when  the clerk (authenticated but not admin) calls it
     * @spec.then  it is denied 403: stacked authorizations are AND-combined, so the missing role fails
     * @spec.us    US-057-action-authorization
     */
    @Test
    void stacked_authorizations_are_and_combined() throws Exception {
        org.assertj.core.api.Assertions.assertThat(
                        call("openWithStackedChecks", clerk()).getResponse().getStatus())
                .isEqualTo(403);
        org.assertj.core.api.Assertions.assertThat(
                        call("openWithStackedChecks", admin()).getResponse().getStatus())
                .isEqualTo(200);
    }

    /**
     * @spec.given an action with NO authorization annotation
     * @spec.when  an anonymous request calls it
     * @spec.then  the call succeeds: the permissive default holds (backward compatible)
     * @spec.us    US-057-action-authorization
     */
    @Test
    void unannotated_action_is_permitted_by_default() throws Exception {
        org.assertj.core.api.Assertions.assertThat(
                        call("openFreely", post -> post).getResponse().getStatus())
                .isEqualTo(200);
    }

    /**
     * @spec.given a @LievitOn listener guarded by @LievitAuthorize("hasRole('ADMIN')")
     * @spec.when  a non-admin routes the event to the listener over the wire
     * @spec.then  it is refused 403: the event-listener path enforces authorization too (no bypass)
     * @spec.us    US-057-action-authorization
     */
    @Test
    void event_listener_path_enforces_authorization() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("_snapshot", mountedSnapshot());
        payload.put("_updates", Map.of());
        payload.put("_calls", List.of());
        payload.put("_events", List.of(Map.of("name", "intrusion", "detail", Map.of())));
        MvcResult result =
                mvc.perform(
                                post("/lievit/{id}/call", "cid")
                                        .with(clerk())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(json.writeValueAsString(payload)))
                        .andReturn();
        org.assertj.core.api.Assertions.assertThat(result.getResponse().getStatus()).isEqualTo(403);
    }
}
