/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.LievitComponent;

/**
 * Specifies the per-render child sink (ADR-0016): a parent declares keyed children with props, the
 * placeholder token is stable, a duplicate key is a hard error (the morph-identity bug), and reading
 * the sink outside a bound render is a programming error.
 */
class LievitChildrenTest {

    @LievitComponent
    static class Row {}

    /**
     * @spec.given a bound child sink
     * @spec.when  a parent declares two keyed children with props
     * @spec.then  the sink collects them in render order with their keys, class names, and props
     * @spec.adr   ADR-0016
     */
    @Test
    void collects_declared_children_in_render_order() {
        LievitChildren children = new LievitChildren();

        String p0 = children.child("row-0", Row.class, Map.of("label", "a"));
        String p1 = children.child("row-1", Row.class.getName(), Map.of("label", "b"));

        assertThat(children.declared()).hasSize(2);
        assertThat(children.declared().get(0).key()).isEqualTo("row-0");
        assertThat(children.declared().get(0).props()).containsEntry("label", "a");
        assertThat(children.declared().get(1).key()).isEqualTo("row-1");
        assertThat(p0).isEqualTo("<!--lievit:child:row-0-->");
        assertThat(p1).isEqualTo(LievitChildren.placeholderFor("row-1"));
    }

    /**
     * @spec.given a parent that declared a child with key "row-0"
     * @spec.when  it declares a second child with the same key
     * @spec.then  it is a hard error: keys must be unique so the client morph can tell children apart
     * @spec.adr   ADR-0016
     */
    @Test
    void rejects_a_duplicate_child_key() {
        LievitChildren children = new LievitChildren();
        children.child("row-0", Row.class);

        assertThatThrownBy(() -> children.child("row-0", Row.class))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("duplicate child @key 'row-0'");
    }

    /**
     * @spec.given a child declared with a blank key
     * @spec.when  the declaration is attempted
     * @spec.then  it is rejected: a stable @key is required for the morph identity
     * @spec.adr   ADR-0016
     */
    @Test
    void rejects_a_blank_child_key() {
        LievitChildren children = new LievitChildren();

        assertThatThrownBy(() -> children.child("", Row.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("non-blank @key");
    }

    /**
     * @spec.given no bound child sink on the current thread
     * @spec.when  {@code LievitChildren.current()} is read
     * @spec.then  it is a programming error: the sink is only bound during a wire render
     * @spec.adr   ADR-0016
     */
    @Test
    void current_outside_a_render_is_a_programming_error() {
        LievitChildren.clear();

        assertThatThrownBy(LievitChildren::current)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("no child sink is bound");
    }
}
