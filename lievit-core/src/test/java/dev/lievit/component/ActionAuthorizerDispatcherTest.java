/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.LievitAction;
import dev.lievit.LievitAuthorize;
import dev.lievit.LievitComponent;
import dev.lievit.LievitOn;
import dev.lievit.Wire;
import dev.lievit.wire.WireError;
import dev.lievit.wire.WireException;

/**
 * Specifies the dispatcher's authorization seam (issue #57): the {@link ActionAuthorizer} is
 * consulted before a {@code @LievitAction} runs and before a matched {@code @LievitOn} listener
 * runs, on every wire call; a deny is a fail-closed {@link WireError#FORBIDDEN_ACTION} and the
 * action body never executes; the default (no authorizer) permits everything (backward compatible).
 */
class ActionAuthorizerDispatcherTest {

    @LievitComponent
    static class Vault {
        @Wire int opened;

        @LievitAction
        @LievitAuthorize("hasRole('ADMIN')")
        void open() {
            this.opened++;
        }

        @LievitOn("intrusion")
        void onIntrusion() {
            this.opened = 999;
        }
    }

    /**
     * @spec.given a component with an authorized action and a permit-all default dispatcher
     * @spec.when  the action is called with no authorizer wired
     * @spec.then  the action runs: the default posture is permissive (backward compatible)
     * @spec.us    US-057-action-authorization
     */
    @Test
    void permits_the_action_when_no_authorizer_is_wired() {
        WireDispatcher dispatcher = new WireDispatcher();
        ComponentMetadata metadata = ComponentMetadata.of(Vault.class);
        WireCall result =
                dispatcher.call(metadata, new Vault(), Map.of("opened", 0), Map.of(), List.of("open"));
        assertThat(result.wire().get("opened")).isEqualTo(1);
    }

    /**
     * @spec.given a dispatcher wired with an authorizer that denies the action
     * @spec.when  the action is called
     * @spec.then  a FORBIDDEN_ACTION is raised before the body runs: the state is never mutated
     * @spec.us    US-057-action-authorization
     */
    @Test
    void denies_the_action_fail_closed_before_the_body_runs() {
        Vault vault = new Vault();
        WireDispatcher dispatcher =
                WireDispatcher.builder().actionAuthorizer((component, action) -> false).build();
        ComponentMetadata metadata = ComponentMetadata.of(Vault.class);
        assertThatThrownBy(
                        () ->
                                dispatcher.call(
                                        metadata, vault, Map.of("opened", 0), Map.of(), List.of("open")))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.FORBIDDEN_ACTION);
        assertThat(vault.opened).isZero();
    }

    /**
     * @spec.given a dispatcher with an authorizer that allows the action
     * @spec.when  the action is called
     * @spec.then  the action runs and mutates state
     * @spec.us    US-057-action-authorization
     */
    @Test
    void permits_the_action_when_the_authorizer_allows() {
        WireDispatcher dispatcher =
                WireDispatcher.builder().actionAuthorizer((component, action) -> true).build();
        ComponentMetadata metadata = ComponentMetadata.of(Vault.class);
        WireCall result =
                dispatcher.call(metadata, new Vault(), Map.of("opened", 0), Map.of(), List.of("open"));
        assertThat(result.wire().get("opened")).isEqualTo(1);
    }

    /**
     * @spec.given a dispatcher whose authorizer denies the @LievitOn event-listener method
     * @spec.when  an inbound event routes to that listener
     * @spec.then  a FORBIDDEN_ACTION is raised before the listener runs: authorization is enforced
     *             identically on the event path (the Livewire SupportEvents bypass the study flagged)
     * @spec.us    US-057-action-authorization
     */
    @Test
    void denies_the_event_listener_path_too() {
        Vault vault = new Vault();
        WireDispatcher dispatcher =
                WireDispatcher.builder()
                        .actionAuthorizer((component, action) -> !action.getName().equals("onIntrusion"))
                        .build();
        ComponentMetadata metadata = ComponentMetadata.of(Vault.class);
        assertThatThrownBy(
                        () ->
                                dispatcher.call(
                                        metadata,
                                        vault,
                                        Map.of("opened", 0),
                                        Map.of(),
                                        List.of(),
                                        List.of(new InboundEvent("intrusion", Map.of()))))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.FORBIDDEN_ACTION);
        // The listener never ran (denied before the body), so opened stays 0, not 999.
        assertThat(vault.opened).isZero();
    }
}
