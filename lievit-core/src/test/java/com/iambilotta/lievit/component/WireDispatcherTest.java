/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.iambilotta.lievit.LievitAction;
import com.iambilotta.lievit.LievitComponent;
import com.iambilotta.lievit.LievitMount;
import com.iambilotta.lievit.LievitProperty;
import com.iambilotta.lievit.LievitRender;
import com.iambilotta.lievit.Wire;
import com.iambilotta.lievit.wire.WireError;
import com.iambilotta.lievit.wire.WireException;

/**
 * Specifies the stateless lifecycle engine: mount seeds state, a wire call rehydrates + applies
 * updates + invokes actions, a locked field rejects client updates, and an unknown action is a
 * gone-component (ADR-0001, ADR-0002, the ADR-0001 locked amendment).
 */
class WireDispatcherTest {

    private final WireDispatcher dispatcher = new WireDispatcher();

    @LievitComponent(template = "counter")
    static class Counter {
        @Wire int count;

        @LievitMount
        void seed() {
            this.count = 0;
        }

        @LievitAction
        void increment() {
            this.count++;
        }
    }

    @LievitComponent
    static class Cart {
        @Wire @LievitProperty(locked = true) String cartId = "server-owned";
        @Wire int quantity;

        // A non-@Wire field: never client-settable (the settable allowlist is @Wire only).
        @SuppressWarnings("unused")
        String role = "user";

        @LievitAction
        void addOne() {
            this.quantity++;
        }

        // A plain (non-@LievitAction) method: never client-callable (the callable allowlist is
        // @LievitAction only).
        @SuppressWarnings("unused")
        void grantAdmin() {
            this.role = "admin";
        }
    }

    /**
     * @spec.given a freshly constructed Counter component with a {@code @LievitMount} hook
     * @spec.when  the dispatcher mounts it
     * @spec.then  the mount hook runs and the initial {@code @Wire} state is read back
     * @spec.adr   ADR-0001
     */
    @Test
    void mount_runs_the_mount_hook_and_reads_initial_state() {
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        WireCall mounted = dispatcher.mount(meta, new Counter());

        assertThat(mounted.wire()).containsEntry("count", 0);
        assertThat(mounted.children()).isEmpty();
    }

    /**
     * @spec.given a Counter rehydrated from a snapshot whose count is 7
     * @spec.when  the dispatcher applies the increment action
     * @spec.then  the read-back state carries count 8 (state survived the stateless round trip)
     * @spec.adr   ADR-0001
     */
    @Test
    void call_rehydrates_then_invokes_the_action() {
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        WireCall result =
                dispatcher.call(
                        meta,
                        new Counter(),
                        Map.of("count", 7),
                        Map.of(),
                        List.of("increment"));

        assertThat(result.wire()).containsEntry("count", 8);
    }

    /**
     * @spec.given a Counter rehydrated at count 7 plus a client update setting count to 100
     * @spec.when  the dispatcher applies the update then increments
     * @spec.then  the update is honored (unlocked field): count becomes 101
     * @spec.adr   ADR-0001
     */
    @Test
    void call_applies_an_unlocked_client_update() {
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        WireCall result =
                dispatcher.call(
                        meta,
                        new Counter(),
                        Map.of("count", 7),
                        Map.of("count", 100),
                        List.of("increment"));

        assertThat(result.wire()).containsEntry("count", 101);
    }

    /**
     * @spec.given a Cart whose cartId is a locked @LievitProperty and a client update that tries to
     *     overwrite it
     * @spec.when  the dispatcher applies the updates
     * @spec.then  it rejects the call with LOCKED_PROPERTY (403): the snapshot signature does not
     *     stop the first POST from writing a server-owned field; the lock does
     * @spec.adr   ADR-0001
     */
    @Test
    void call_rejects_a_client_update_to_a_locked_field() {
        ComponentMetadata meta = ComponentMetadata.of(Cart.class);

        assertThatThrownBy(
                        () ->
                                dispatcher.call(
                                        meta,
                                        new Cart(),
                                        Map.of("cartId", "server-owned", "quantity", 1),
                                        Map.of("cartId", "attacker-owned"),
                                        List.of("addOne")))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.LOCKED_PROPERTY);
    }

    /**
     * @spec.given a Cart and a client update to the unlocked quantity field
     * @spec.when  the dispatcher applies it
     * @spec.then  the unlocked update is honored while the locked cartId stays server-owned
     * @spec.adr   ADR-0001
     */
    @Test
    void call_honors_unlocked_fields_while_locking_others() {
        ComponentMetadata meta = ComponentMetadata.of(Cart.class);

        WireCall result =
                dispatcher.call(
                        meta,
                        new Cart(),
                        Map.of("cartId", "server-owned", "quantity", 1),
                        Map.of("quantity", 5),
                        List.of("addOne"));

        assertThat(result.wire()).containsEntry("quantity", 6).containsEntry("cartId", "server-owned");
    }

    /**
     * @spec.given a Counter and a call naming a method that is not a @LievitAction
     * @spec.when  the dispatcher runs the call
     * @spec.then  it is an UNKNOWN_COMPONENT (410): the named action does not exist on this build
     * @spec.adr   ADR-0001
     */
    @Test
    void call_rejects_an_unknown_action() {
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        assertThatThrownBy(
                        () ->
                                dispatcher.call(
                                        meta,
                                        new Counter(),
                                        Map.of("count", 0),
                                        Map.of(),
                                        List.of("nonexistent")))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.UNKNOWN_COMPONENT);
    }

    /**
     * @spec.given a Cart and a client update targeting {@code role}, a non-@Wire field
     * @spec.when  the dispatcher applies the updates
     * @spec.then  the update is dropped, never bound: only @Wire fields are settable, so a first
     *     POST cannot write a property the component never exposed to the wire (the settable
     *     allowlist, ADR-0013). The call succeeds; role stays "user".
     * @spec.adr   ADR-0013
     */
    @Test
    void call_drops_an_update_to_a_non_wire_field() {
        ComponentMetadata meta = ComponentMetadata.of(Cart.class);
        Cart cart = new Cart();

        WireCall result =
                dispatcher.call(
                        meta,
                        cart,
                        Map.of("cartId", "server-owned", "quantity", 0),
                        Map.of("role", "admin"),
                        List.of());

        assertThat(cart.role).isEqualTo("user");
        assertThat(result.wire()).doesNotContainKey("role");
    }

    /**
     * @spec.given a Cart and a call naming {@code grantAdmin}, a non-@LievitAction method
     * @spec.when  the dispatcher runs the call
     * @spec.then  it is rejected UNKNOWN_COMPONENT (410): only @LievitAction methods are callable,
     *     so a plain method (or a lifecycle hook) is never reachable from the wire (the callable
     *     allowlist, ADR-0013). The method does not run; role stays "user".
     * @spec.adr   ADR-0013
     */
    @Test
    void call_rejects_a_call_to_a_non_action_method() {
        ComponentMetadata meta = ComponentMetadata.of(Cart.class);
        Cart cart = new Cart();

        assertThatThrownBy(
                        () ->
                                dispatcher.call(
                                        meta,
                                        cart,
                                        Map.of("cartId", "server-owned", "quantity", 0),
                                        Map.of(),
                                        List.of("grantAdmin")))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.UNKNOWN_COMPONENT);
        assertThat(cart.role).isEqualTo("user");
    }

    /**
     * @spec.given a Counter and a client update value that is an opaque (non-JSON) Java object
     * @spec.when  the dispatcher runs the call
     * @spec.then  the PayloadGuard rejects it FORBIDDEN_DESERIALIZATION (422) before any value is
     *     bound: the snapshot is state-never-code, the JVM gadget surface is closed (ADR-0013)
     * @spec.adr   ADR-0013
     */
    @Test
    void call_rejects_a_forbidden_deserialization_value() {
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);
        java.util.Map<String, Object> updates = new java.util.HashMap<>();
        updates.put("count", new Object());

        assertThatThrownBy(
                        () ->
                                dispatcher.call(
                                        meta, new Counter(), Map.of("count", 0), updates, List.of()))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.FORBIDDEN_DESERIALIZATION);
    }

    /**
     * @spec.given a Counter and more _calls than the protocol cap (default 50)
     * @spec.when  the dispatcher runs the call
     * @spec.then  the PayloadGuard rejects it PAYLOAD_TOO_COMPLEX (413): a DoS guard on call count
     *     fires before any action runs (ADR-0013)
     * @spec.adr   ADR-0013
     */
    @Test
    void call_rejects_too_many_calls() {
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);
        java.util.List<String> calls = java.util.Collections.nCopies(51, "increment");

        assertThatThrownBy(
                        () ->
                                dispatcher.call(
                                        meta, new Counter(), Map.of("count", 0), Map.of(), calls))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.PAYLOAD_TOO_COMPLEX);
    }

    // --- nested components (ADR-0015) ------------------------------------------------------------

    @LievitComponent(template = "row")
    static class Row {
        @Wire String label = "";

        @LievitMount
        void seed() {
            // A prop seeded before mount is visible here; if none, label stays "".
            if (this.label.isEmpty()) {
                this.label = "default";
            }
        }
    }

    @LievitComponent(template = "row-input")
    static class RowInput {
        @Wire @LievitProperty(modelable = true) String value = "";

        @LievitAction
        void clear() {
            this.value = "";
        }
    }

    @LievitComponent(template = "parent")
    static class Parent {
        @Wire int rows;

        @LievitMount
        void seed() {
            this.rows = 2;
        }

        @LievitRender
        void render() {
            LievitChildren children = LievitChildren.current();
            for (int i = 0; i < rows; i++) {
                children.child("row-" + i, Row.class, Map.of("label", "row " + i));
            }
        }
    }

    /**
     * @spec.given a Parent that declares one Row child per row in its render
     * @spec.when  the dispatcher mounts the parent
     * @spec.then  the mounted result carries the declared children, each with its stable @key and the
     *     props the parent passed down (the parent's snapshot carries only the parent's own state)
     * @spec.adr   ADR-0015
     */
    @Test
    void mount_collects_the_children_a_parent_declared() {
        ComponentMetadata meta = ComponentMetadata.of(Parent.class);

        WireCall mounted = dispatcher.mount(meta, new Parent());

        assertThat(mounted.wire()).containsEntry("rows", 2).doesNotContainKey("label");
        assertThat(mounted.children()).hasSize(2);
        assertThat(mounted.children().get(0).key()).isEqualTo("row-0");
        assertThat(mounted.children().get(0).className()).isEqualTo(Row.class.getName());
        assertThat(mounted.children().get(0).props()).containsEntry("label", "row 0");
        assertThat(mounted.children().get(1).key()).isEqualTo("row-1");
    }

    /**
     * @spec.given a Row child mounted with a parent-supplied {@code label} prop
     * @spec.when  the dispatcher mounts it with those props
     * @spec.then  the prop is seeded onto the @Wire field before @LievitMount runs (the mount hook
     *     sees it, so its default-only branch does not overwrite the prop)
     * @spec.adr   ADR-0015
     */
    @Test
    void mount_seeds_parent_props_before_the_mount_hook() {
        ComponentMetadata meta = ComponentMetadata.of(Row.class);

        WireCall mounted = dispatcher.mount(meta, new Row(), Map.of("label", "passed-down"));

        assertThat(mounted.wire()).containsEntry("label", "passed-down");
    }

    /**
     * @spec.given a Row mounted with no props
     * @spec.when  the dispatcher mounts it
     * @spec.then  the mount hook's default applies (no prop overrode it)
     * @spec.adr   ADR-0015
     */
    @Test
    void mount_with_no_props_lets_the_mount_hook_default_apply() {
        ComponentMetadata meta = ComponentMetadata.of(Row.class);

        WireCall mounted = dispatcher.mount(meta, new Row(), Map.of());

        assertThat(mounted.wire()).containsEntry("label", "default");
    }

    /**
     * @spec.given a prop targeting a name that is not a @Wire field on the child
     * @spec.when  the child is mounted with that prop
     * @spec.then  the prop is dropped (the settable allowlist applies to props too): the child's
     *     state is unaffected, no stray field is written
     * @spec.adr   ADR-0015
     */
    @Test
    void mount_drops_a_prop_that_is_not_a_wire_field() {
        ComponentMetadata meta = ComponentMetadata.of(Row.class);

        WireCall mounted = dispatcher.mount(meta, new Row(), Map.of("notAField", "x"));

        assertThat(mounted.wire()).doesNotContainKey("notAField");
        assertThat(mounted.wire()).containsEntry("label", "default");
    }

    /**
     * @spec.given a RowInput child whose value field is @LievitProperty(modelable)
     * @spec.when  its metadata is reflected
     * @spec.then  the modelable field is discovered (the parent two-way-bind target, ADR-0015)
     * @spec.adr   ADR-0015
     */
    @Test
    void metadata_discovers_the_modelable_field() {
        ComponentMetadata meta = ComponentMetadata.of(RowInput.class);

        assertThat(meta.modelableField()).isEqualTo("value");
        assertThat(meta.wireFields().get("value").modelable()).isTrue();
    }

    @LievitComponent
    static class BothLockedAndModelable {
        @Wire @LievitProperty(modelable = true, locked = true) String v = "";
    }

    /**
     * @spec.given a field declared both modelable and locked
     * @spec.when  the metadata is reflected
     * @spec.then  it is rejected: a server-owned (locked) field cannot be a parent two-way bind
     * @spec.adr   ADR-0015
     */
    @Test
    void metadata_rejects_a_field_that_is_both_modelable_and_locked() {
        assertThatThrownBy(() -> ComponentMetadata.of(BothLockedAndModelable.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("server-owned field cannot be a parent two-way bind");
    }

    @LievitComponent
    static class TwoModelable {
        @Wire @LievitProperty(modelable = true) String a = "";
        @Wire @LievitProperty(modelable = true) String b = "";
    }

    /**
     * @spec.given a component declaring two modelable fields
     * @spec.when  the metadata is reflected
     * @spec.then  it is rejected: a component has at most one parent-bound value
     * @spec.adr   ADR-0015
     */
    @Test
    void metadata_rejects_more_than_one_modelable_field() {
        assertThatThrownBy(() -> ComponentMetadata.of(TwoModelable.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("more than one @LievitProperty(modelable)");
    }

    /**
     * @spec.given a Parent re-rendered on a wire call (rehydrated rows = 3)
     * @spec.when  the dispatcher runs the call
     * @spec.then  the re-render re-declares its children with their current props, so the children
     *     list reflects the new state (key-stable across re-renders is the client morph's job)
     * @spec.adr   ADR-0015
     */
    @Test
    void call_redeclares_children_on_re_render() {
        ComponentMetadata meta = ComponentMetadata.of(Parent.class);

        WireCall result =
                dispatcher.call(meta, new Parent(), Map.of("rows", 3), Map.of(), List.of());

        assertThat(result.children()).hasSize(3);
        assertThat(result.children().get(2).key()).isEqualTo("row-2");
    }

    /**
     * @spec.given a Counter class
     * @spec.when  its metadata is reflected
     * @spec.then  the @Wire count field and the increment action are discovered, template is set
     * @spec.adr   ADR-0002
     */
    @Test
    void metadata_reflects_wire_fields_actions_and_template() {
        ComponentMetadata meta = ComponentMetadata.of(Counter.class);

        assertThat(meta.wireFields()).containsKey("count");
        assertThat(meta.action("increment")).isNotNull();
        assertThat(meta.template()).isEqualTo("counter");
        assertThat(meta.className()).isEqualTo(Counter.class.getName());
    }
}
