/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.test.harness;

import static com.iambilotta.lievit.test.Lievit.test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.iambilotta.lievit.test.LievitTest;
import com.iambilotta.lievit.test.Rejections.LockedProperty;

/**
 * The harness's own tests: {@code Lievit.test()} is a public contract (ADR-0010), so it is tested
 * like one. These exercise the fluent surface itself — the model-update roundtrip, typed dotted /
 * {@code .size} navigation, the typed-instance predicate, the HTML assertions, snapshot rotation,
 * the attacker-seat affordances, the load-bearing failure messages, and the guard rails — against
 * the {@link GreeterComponent} fixture over the real wire.
 */
@LievitTest(classes = HarnessTestApp.class)
class LievitTesterIT {

    /**
     * @spec.given a mounted greeter
     * @spec.when  a client model-updates name, then calls greet, which appends to the greetings list
     * @spec.then  the typed state reflects the deferred update riding with the action, navigable by
     *     dotted path and {@code .size}, and the rendered HTML shows the new greeting
     * @spec.adr   ADR-0010
     */
    @Test
    void model_update_rides_with_the_action_and_is_read_back_typed() {
        test(GreeterComponent.class)
                .mount()
                .assertWire("name", "world")
                .assertWire("greetings.size", 0)
                .model("name", "parma")
                .call("greet")
                .assertWire("name", "parma")
                .assertWire("greetings.size", 1)
                .assertSee("Hello, parma");
    }

    /**
     * @spec.given a mounted greeter driven through two greet calls
     * @spec.when  the rendered HTML is asserted with assertSeeInOrder and a typed predicate
     * @spec.then  both greetings appear in order and the rehydrated instance matches the predicate
     * @spec.adr   ADR-0010
     */
    @Test
    void assert_see_in_order_and_typed_predicate_over_the_real_instance() {
        test(GreeterComponent.class)
                .mount()
                .model("name", "alice")
                .call("greet")
                .model("name", "bob")
                .call("greet")
                .assertSeeInOrder("Hello, alice", "Hello, bob")
                .assertWireMatches(g -> g.greetings.size() == 2 && g.name.equals("bob"))
                .assertDontSee("Hello, carol");
    }

    /**
     * @spec.given a mounted greeter
     * @spec.when  a successful action rotates the snapshot
     * @spec.then  assertSnapshotRotated and assertSnapshotValid both hold (a fresh well-signed
     *     snapshot came back)
     * @spec.adr   ADR-0010
     */
    @Test
    void snapshot_rotates_and_stays_valid_after_a_call() {
        test(GreeterComponent.class)
                .mount()
                .assertSnapshotValid()
                .call("greet")
                .assertSnapshotRotated()
                .assertSnapshotValid();
    }

    /**
     * @spec.given a mounted greeter and a hostile update to the locked owner field
     * @spec.when  the tamper is carried back with an action
     * @spec.then  the harness surfaces the wire's 403 locked-property from the attacker's seat
     * @spec.adr   ADR-0010
     */
    @Test
    void tamper_update_to_a_locked_field_is_rejected() {
        test(GreeterComponent.class)
                .mount()
                .tamperUpdate("owner", "attacker")
                .call("greet")
                .assertRejected(LockedProperty.class);
    }

    /**
     * @spec.given a mounted greeter whose count is asserted against the wrong value
     * @spec.when  assertWire fails
     * @spec.then  the AssertionError message names the actual value AND the call sequence that
     *     produced it (the load-bearing failure-message DX)
     * @spec.adr   ADR-0010
     */
    @Test
    void failure_message_names_the_value_and_the_call_sequence() {
        var tester = test(GreeterComponent.class).mount().call("greet");
        assertThatThrownBy(() -> tester.assertWire("greetings.size", 99))
                .isInstanceOf(AssertionError.class)
                .hasMessageContaining("expected @Wire greetings.size == 99")
                .hasMessageContaining("but was 1")
                .hasMessageContaining("after calls [greet]");
    }

    /**
     * @spec.given an expected rejection that did not happen (a normal 200 call)
     * @spec.when  assertRejected is asserted
     * @spec.then  the AssertionError explains the call returned 200 and shows the rendered HTML
     * @spec.adr   ADR-0010
     */
    @Test
    void assert_rejected_explains_a_call_that_unexpectedly_succeeded() {
        var tester = test(GreeterComponent.class).mount().call("greet");
        assertThatThrownBy(() -> tester.assertRejected(LockedProperty.class))
                .isInstanceOf(AssertionError.class)
                .hasMessageContaining("expected the call to be rejected with locked-property (403)")
                .hasMessageContaining("but it returned 200");
    }

    /**
     * @spec.given a class that is not a @LievitComponent
     * @spec.when  it is passed to Lievit.test()
     * @spec.then  the harness rejects it early with a clear IllegalArgumentException
     * @spec.adr   ADR-0010
     */
    @Test
    void test_rejects_a_non_component_class() {
        assertThatThrownBy(() -> test(String.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("is not a @LievitComponent");
    }

    /**
     * @spec.given a mounted greeter with no calls yet
     * @spec.when  the initial wire state is read
     * @spec.then  the mount hook seeded name and the failure-message phrasing for the no-calls case
     *     is "no calls yet, after mount"
     * @spec.adr   ADR-0010
     */
    @Test
    void mount_state_is_readable_before_any_call() {
        var tester = test(GreeterComponent.class).mount();
        tester.assertWire("name", "world");
        assertThatThrownBy(() -> tester.assertWire("name", "nope"))
                .isInstanceOf(AssertionError.class)
                .hasMessageContaining("no calls yet, after mount");
        assertThat(tester).isNotNull();
    }
}
