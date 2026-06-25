/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import dev.lievit.LievitComponent;

/**
 * Specifies the keyless child overloads + the {@link DeterministicKeyScope} binding (ADR-0023,
 * completing the ADR-0016 key contract for the keyless case): when no explicit {@code @key} is
 * given, the sink pulls a deterministic, stable key from the bound scope so a child in a loop has a
 * morph identity; with no scope bound it falls back to a positional key so {@code lievit-core}
 * builds without a hard dependency on the compiler. A generated key still collides with a later
 * equal explicit key (the ADR-0016 duplicate-key hard error is preserved).
 */
class KeylessChildrenTest {

    @LievitComponent
    static class Row {}

    @AfterEach
    void unbind() {
        LievitChildren.clear();
        DeterministicKeyScope.clear();
    }

    /**
     * @spec.given a bound key scope (the core default generator) and a bound child sink
     * @spec.when  a parent declares three keyless children in a loop
     * @spec.then  each gets a stable, distinct key (counter scoped per template); the crc32 format
     *     is the compiler's concern, the core only guarantees stable + distinct
     * @spec.adr   ADR-0023
     */
    @Test
    void keyless_children_get_stable_distinct_keys() {
        LievitChildren children = new LievitChildren();
        LievitChildren.bind(children);
        DeterministicKeyScope scope = new DeterministicKeyScope();
        scope.enter(Row.class.getName());
        DeterministicKeyScope.bind(scope);

        String p0 = children.child(Row.class, Map.of("label", "a"));
        children.child(Row.class, Map.of("label", "b"));
        String p2 = children.child(Row.class);

        String k0 = children.declared().get(0).key();
        String k1 = children.declared().get(1).key();
        String k2 = children.declared().get(2).key();

        assertThat(k0).isNotEqualTo(k1).isNotEqualTo(k2);
        assertThat(k1).isNotEqualTo(k2);
        assertThat(p0).isEqualTo(LievitChildren.placeholderFor(k0));
        assertThat(p2).isEqualTo(LievitChildren.placeholderFor(k2));
    }

    /**
     * @spec.given the same template id rendered twice (two scopes seeded with the same template)
     * @spec.when  a keyless child is declared at the same position in each render
     * @spec.then  it gets the same key both times: the morph anchor is stable across re-renders
     * @spec.adr   ADR-0023
     */
    @Test
    void the_same_position_is_stable_across_re_renders() {
        DeterministicKeyScope first = new DeterministicKeyScope();
        first.enter(Row.class.getName());
        LievitChildren a = new LievitChildren();
        LievitChildren.bind(a);
        DeterministicKeyScope.bind(first);
        a.child(Row.class);
        String firstKey = a.declared().get(0).key();

        DeterministicKeyScope second = new DeterministicKeyScope();
        second.enter(Row.class.getName());
        LievitChildren b = new LievitChildren();
        LievitChildren.bind(b);
        DeterministicKeyScope.bind(second);
        b.child(Row.class);
        String secondKey = b.declared().get(0).key();

        assertThat(firstKey).isEqualTo(secondKey);
    }

    /**
     * @spec.given no key scope bound (a unit test driving the sink directly)
     * @spec.when  keyless children are declared
     * @spec.then  they fall back to positional keys so the core builds without the compiler
     * @spec.adr   ADR-0023
     */
    @Test
    void falls_back_to_positional_keys_when_no_scope_is_bound() {
        LievitChildren children = new LievitChildren();
        LievitChildren.bind(children);

        children.child(Row.class);
        children.child(Row.class);

        assertThat(children.declared().get(0).key()).isEqualTo("lievit-child-0");
        assertThat(children.declared().get(1).key()).isEqualTo("lievit-child-1");
    }

    /**
     * @spec.given a keyless child whose generated key the scope recorded
     * @spec.when  a later explicit child is declared with that same key
     * @spec.then  it is the ADR-0016 duplicate-key hard error (generated keys are registered)
     * @spec.adr   ADR-0023
     */
    @Test
    void a_later_explicit_key_equal_to_a_generated_one_is_still_a_duplicate() {
        LievitChildren children = new LievitChildren();
        LievitChildren.bind(children);
        children.child(Row.class); // -> lievit-child-0 (no scope)

        assertThatThrownBy(() -> children.child("lievit-child-0", Row.class))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("duplicate child @key");
    }

    /**
     * @spec.given a single scope used across two different template ids (the nested / sibling-loop
     *     case of #107: a loop inside one template and a loop inside another, or two sibling loops in
     *     different templates)
     * @spec.when  keys are pulled while entered in template A, then template B, then back in A
     * @spec.then  each template keeps its OWN counter (A: 0,1 ; B: 0 ; A resumes at 2): two templates
     *     never collide and re-entering a template resumes its own namespace, so a child's morph
     *     identity is stable per template position across single / nested / sibling loops
     * @spec.adr   ADR-0023
     * @spec.us    US-107-smart-wire-keys
     */
    @Test
    void counters_are_namespaced_per_template_for_nested_and_sibling_loops() {
        DeterministicKeyScope scope =
                new DeterministicKeyScope((templateId, counter) -> templateId + "#" + counter);

        scope.enter("outer");
        String a0 = scope.nextKey();
        String a1 = scope.nextKey();
        scope.enter("inner");
        String b0 = scope.nextKey();
        scope.enter("outer"); // re-enter: outer resumes its own counter, not reset
        String a2 = scope.nextKey();

        assertThat(a0).isEqualTo("outer#0");
        assertThat(a1).isEqualTo("outer#1");
        assertThat(b0).isEqualTo("inner#0");
        assertThat(a2).isEqualTo("outer#2");
    }
}
