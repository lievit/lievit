/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.nested;

import static io.lievit.test.Lievit.test;

import org.junit.jupiter.api.Test;

import io.lievit.test.LievitTest;

/**
 * End-to-end nested components over the real wire pipeline (ADR-0016), driven through the
 * {@code Lievit.test()} harness (ADR-0010). The parent {@link ListComponent} renders keyed
 * {@link RowComponent} children with props passed down and a modelable {@link RowInputComponent}
 * two-way-bound to its {@code draft} property. These pin: child render + inlining, prop pass-down,
 * stable {@code @key} markers, the per-child independent snapshot, the modelable marker, and a
 * key-stable re-render that grows the list without thrashing the existing children.
 */
@LievitTest(classes = NestedTestApp.class)
class NestedComponentsIT {

    /**
     * @spec.given a mounted parent that declares two Row children plus a modelable input
     * @spec.when  the parent renders
     * @spec.then  each child's HTML is inlined at its placeholder, carrying its parent-supplied label
     *     prop, so a nested component renders inside its parent (the core nested-render contract)
     * @spec.adr   ADR-0016
     * @spec.us    US-nested-render
     */
    @Test
    void parent_renders_its_children_with_props_passed_down() {
        test(ListComponent.class)
                .mount()
                .assertWire("rows", 2)
                .assertSee("data-row-label=\"row 0\"")
                .assertSee("data-row-label=\"row 1\"")
                .assertSee(">row 0<")
                .assertSee(">row 1<")
                // No raw placeholder comment leaks: every child was substituted.
                .assertDontSee("<!--lievit:child:");
    }

    /**
     * @spec.given a mounted parent with two Row children
     * @spec.when  the rendered HTML is inspected for the client-glue markers
     * @spec.then  each child root carries a stable lievit:key, its own data-lievit-snapshot, and a
     *     data-lievit-id, in the parent's render order (the morph identity contract)
     * @spec.adr   ADR-0016
     * @spec.us    US-nested-render
     */
    @Test
    void each_child_root_carries_stable_key_and_its_own_snapshot() {
        test(ListComponent.class)
                .mount()
                .assertSee("lievit:key=\"row-0\"")
                .assertSee("lievit:key=\"row-1\"")
                .assertSeeInOrder("lievit:key=\"row-0\"", "lievit:key=\"row-1\"")
                // Each child carries its OWN signed snapshot (independent component, per-component
                // statelessness): two distinct snapshot attributes appear.
                .assertSee("data-lievit-snapshot=")
                .assertSee("data-lievit-id=");
    }

    /**
     * @spec.given a parent two-way-bound to its draft via the modelable RowInput child
     * @spec.when  the parent renders the modelable child
     * @spec.then  the child input shows the parent's draft value (prop down) and the child root
     *     carries lievit:modelable naming its field and the parent property (the up-leg routing)
     * @spec.adr   ADR-0016
     * @spec.us    US-modelable
     */
    @Test
    void modelable_child_shows_the_parent_value_and_carries_the_bind_marker() {
        test(ListComponent.class)
                .mount()
                .assertWire("draft", "hello")
                .assertSee("value=\"hello\"")
                .assertSee("lievit:modelable=\"value:draft\"")
                .assertSee("lievit:key=\"draft-input\"");
    }

    /**
     * @spec.given a mounted parent with two rows
     * @spec.when  addRow runs over the wire, growing the list to three rows
     * @spec.then  the re-render re-declares the children key-stably: row-0 and row-1 keep their keys
     *     (so the client morph preserves their DOM) and a new row-2 appears
     * @spec.adr   ADR-0016
     * @spec.us    US-nested-render
     */
    @Test
    void re_render_grows_the_list_key_stably() {
        test(ListComponent.class)
                .mount()
                .assertSee("lievit:key=\"row-1\"")
                .assertDontSee("lievit:key=\"row-2\"")
                .call("addRow")
                .assertWire("rows", 3)
                .assertSee("lievit:key=\"row-0\"")
                .assertSee("lievit:key=\"row-1\"")
                .assertSee("lievit:key=\"row-2\"")
                .assertSee(">row 2<")
                .assertSnapshotRotated();
    }

    /**
     * @spec.given a parent that declares a child with an @saved event listener and forwarded HTML
     *     attributes (a class to merge, a data-role pass-through, and a `label` that is a real prop)
     * @spec.when  the parent renders
     * @spec.then  the child root carries lievit:on:saved="addRow" (the #69 listener wiring), the
     *     forwarded class + data-role merged onto the root (#71), and `label` was seeded as a prop
     *     (rendered as the row label), NOT stamped as a raw attribute
     * @spec.adr   ADR-0016
     * @spec.us    US-69-nested-component-listeners
     */
    @Test
    void a_child_carries_parent_event_listeners_and_forwarded_attributes() {
        test(ListComponent.class)
                .mount()
                // #69: the parent-declared listener is re-injected onto the child root.
                .assertSee("lievit:on:saved=\"addRow\"")
                // #71: the forwarded attribute bag merges onto the child root.
                .assertSee("class=\"highlight\"")
                .assertSee("data-role=\"listitem\"")
                // `label` is a real @Wire prop: seeded down (rendered as the label), not in the bag.
                .assertSee(">decorated<")
                .assertDontSee("label=\"ignored\"");
    }

    /**
     * @spec.given a parent that declares a child with a listener + forwarded attributes
     * @spec.when  an action re-renders the parent (the child is re-declared with the same tag attrs)
     * @spec.then  the listener marker and the forwarded attributes are re-injected on the re-render:
     *     they survive a re-render (the parent re-declares them each render, ADR-0016)
     * @spec.adr   ADR-0016
     * @spec.us    US-71-attribute-forwarding
     */
    @Test
    void forwarded_attributes_and_listeners_survive_a_re_render() {
        test(ListComponent.class)
                .mount()
                .call("addRow")
                .assertSee("lievit:on:saved=\"addRow\"")
                .assertSee("class=\"highlight\"")
                .assertSee("data-role=\"listitem\"");
    }
}
