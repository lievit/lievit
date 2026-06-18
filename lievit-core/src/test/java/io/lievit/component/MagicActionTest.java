/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Pins the parsing of framework-provided magic-action call strings (ADR-0030): the leading-{@code $}
 * detection, the bare vs call form, and the scalar argument literals a template writes inline.
 */
class MagicActionTest {

    /**
     * @spec.given a bare magic call string with no parentheses
     * @spec.when  it is parsed
     * @spec.then  the name is captured with no arguments
     * @spec.adr   ADR-0030
     */
    @Test
    void parses_a_bare_magic_call() {
        MagicAction action = MagicAction.parse("$refresh");
        assertThat(action).isNotNull();
        assertThat(action.name()).isEqualTo("$refresh");
        assertThat(action.args()).isEmpty();
    }

    /**
     * @spec.given a $set call with a quoted property name and a JSON scalar value
     * @spec.when  it is parsed
     * @spec.then  the name, the unquoted property string, and the typed scalar are captured in order
     * @spec.adr   ADR-0030
     */
    @Test
    void parses_a_set_call_with_a_property_and_scalar() {
        MagicAction action = MagicAction.parse("$set('count', 5)");
        assertThat(action).isNotNull();
        assertThat(action.name()).isEqualTo("$set");
        assertThat(action.args()).containsExactly("count", 5L);
    }

    /**
     * @spec.given a $set call whose value is a boolean literal
     * @spec.when  it is parsed
     * @spec.then  the value is the Boolean, not the string "true"
     * @spec.adr   ADR-0030
     */
    @Test
    void parses_a_boolean_scalar_argument() {
        MagicAction action = MagicAction.parse("$set('open', true)");
        assertThat(action).isNotNull();
        assertThat(action.args()).containsExactly("open", Boolean.TRUE);
    }

    /**
     * @spec.given a $toggle call with a double-quoted property name
     * @spec.when  it is parsed
     * @spec.then  the single property argument is captured unquoted
     * @spec.adr   ADR-0030
     */
    @Test
    void parses_a_toggle_call() {
        MagicAction action = MagicAction.parse("$toggle(\"visible\")");
        assertThat(action).isNotNull();
        assertThat(action.name()).isEqualTo("$toggle");
        assertThat(action.args()).containsExactly("visible");
    }

    /**
     * @spec.given a plain (non-magic) action call name
     * @spec.when  it is parsed
     * @spec.then  parse returns null and isMagic is false (a real action, untouched)
     * @spec.adr   ADR-0030
     */
    @Test
    void a_plain_action_name_is_not_magic() {
        assertThat(MagicAction.isMagic("increment")).isFalse();
        assertThat(MagicAction.parse("increment")).isNull();
    }

    /**
     * @spec.given a $set whose string value itself contains a comma
     * @spec.when  it is parsed
     * @spec.then  the comma inside the quotes is preserved (top-level split ignores quoted commas)
     * @spec.adr   ADR-0030
     */
    @Test
    void preserves_a_comma_inside_a_quoted_argument() {
        MagicAction action = MagicAction.parse("$set('name', 'Doe, John')");
        assertThat(action).isNotNull();
        assertThat(action.args()).containsExactly("name", "Doe, John");
    }

    /**
     * @spec.given the well-known magic names
     * @spec.when  they are checked
     * @spec.then  each is detected as magic
     * @spec.adr   ADR-0030
     */
    @Test
    void recognises_the_well_known_magic_names() {
        for (String name : List.of("$refresh", "$set", "$toggle", "$get", "$parent")) {
            assertThat(MagicAction.isMagic(name)).as(name).isTrue();
        }
    }
}
