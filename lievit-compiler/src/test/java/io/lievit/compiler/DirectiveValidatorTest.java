/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.compiler;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

/**
 * Spec for the unknown-{@code l:}-directive validator (the poka-yoke that turns a silent client
 * no-op into a loud build/startup failure): a template carrying an unknown directive name
 * ({@code l:value}) is a violation with a line number and an actionable hint, while the known
 * builtins, modifier forms, and {@code $set} magic actions pass; a custom directive passes only when
 * allowlisted.
 */
class DirectiveValidatorTest {

    private final DirectiveValidator validator = new DirectiveValidator();

    /**
     * @spec.given a template using only known directives (l:click, l:submit, l:model)
     * @spec.when  it is validated
     * @spec.then  no violations are reported
     */
    @Test
    void known_directives_pass() {
        String src =
                """
                <form l:submit="save">
                  <input l:model="name">
                  <button l:click="confirmDelete">Delete</button>
                </form>
                """;

        assertThat(validator.validate("ok.jte", src)).isEmpty();
    }

    /**
     * @spec.given the exact shipped bug: a button carrying l:value (not a real directive)
     * @spec.when  the template is validated
     * @spec.then  one violation names l:value, its line, and the $set fix in the hint
     */
    @Test
    void l_value_fails_with_a_helpful_message() {
        String src =
                """
                <button l:model="x" l:value="${id}" l:click="arm">Arm</button>
                """;

        List<DirectiveValidator.Violation> violations = validator.validate("listing-list.jte", src);

        assertThat(violations).hasSize(1);
        DirectiveValidator.Violation v = violations.get(0);
        assertThat(v.directive()).isEqualTo("l:value");
        assertThat(v.line()).isEqualTo(1);
        assertThat(v.hint()).contains("$set('field', value)");
        assertThat(v.message()).contains("listing-list.jte:1").contains("l:value");
    }

    /**
     * @spec.given directives carrying modifiers (l:model.live, l:keydown.enter, l:debounce.500ms,
     *     l:bind.disabled, l:ignore.self, l:target.except)
     * @spec.when  the template is validated
     * @spec.then  no violations: only the bare name before the first dot is checked
     */
    @Test
    void modifiers_pass() {
        String src =
                """
                <input l:model.live="q">
                <input l:model.debounce.500ms="q2">
                <input l:keydown.enter="go">
                <button l:bind.disabled="busy">Go</button>
                <div l:ignore.self></div>
                <span l:target.except="poll" l:loading>...</span>
                """;

        assertThat(validator.validate("mods.jte", src)).isEmpty();
    }

    /**
     * @spec.given an l:click whose value is the $set magic action
     * @spec.when  the template is validated
     * @spec.then  no violation: the directive name is click (valid); the value is never inspected
     */
    @Test
    void set_magic_action_in_the_value_passes() {
        String src =
                """
                <button l:click="$set('pendingDeleteId', '${row.id()}')">Delete</button>
                <button l:click="$refresh">Reload</button>
                """;

        assertThat(validator.validate("set.jte", src)).isEmpty();
    }

    /**
     * @spec.given a template using a custom directive l:tooltip not in the builtins
     * @spec.when  it is validated WITHOUT an allowlist
     * @spec.then  it is a violation (a static scan cannot see runtime.directives.register)
     */
    @Test
    void a_custom_directive_fails_unless_allowlisted() {
        String src = "<span l:tooltip=\"hi\">?</span>";

        assertThat(validator.validate("custom.jte", src)).hasSize(1);
        assertThat(validator.validate("custom.jte", src).get(0).directive()).isEqualTo("l:tooltip");
    }

    /**
     * @spec.given the same custom directive l:tooltip, now allowlisted via the extra-directives set
     * @spec.when  the template is validated by a validator built with that allowlist
     * @spec.then  no violation: the escape hatch authorises the app's own directive
     */
    @Test
    void a_custom_directive_passes_when_allowlisted() {
        DirectiveValidator withExtra = new DirectiveValidator(Set.of("tooltip"));
        String src = "<span l:tooltip=\"hi\">?</span>";

        assertThat(withExtra.validate("custom.jte", src)).isEmpty();
    }

    /**
     * @spec.given a template with two distinct unknown directives on separate lines
     * @spec.when  it is validated
     * @spec.then  both are reported, each with its own line number, in source order
     */
    @Test
    void reports_each_unknown_occurrence_with_its_line() {
        String src =
                """
                <button l:click="ok">ok</button>
                <button l:value="1">bad</button>
                <button l:nope="2">also bad</button>
                """;

        List<DirectiveValidator.Violation> violations = validator.validate("multi.jte", src);

        assertThat(violations).extracting(DirectiveValidator.Violation::directive)
                .containsExactly("l:value", "l:nope");
        assertThat(violations).extracting(DirectiveValidator.Violation::line)
                .containsExactly(2, 3);
    }

    /**
     * @spec.given a JTE comment and an HTML comment that mention l:value in prose, plus a real l:click
     * @spec.when  the template is validated
     * @spec.then  no false positive: directive text inside comments is stripped before scanning
     */
    @Test
    void does_not_flag_directive_text_inside_comments() {
        String src =
                """
                <%-- NB there is no l:value directive; use l:model+l:value is wrong --%>
                <!-- and l:nope is not real either -->
                <button l:click="ok">ok</button>
                """;

        assertThat(validator.validate("comments.jte", src)).isEmpty();
    }

    /**
     * @spec.given a commented-out l:value followed by a real l:value on a later line
     * @spec.when  the template is validated
     * @spec.then  only the real one is flagged, and its line number is the real (post-comment) line
     */
    @Test
    void flags_the_real_directive_not_the_commented_one_with_correct_line() {
        String src =
                """
                <%-- old: <button l:value="x"> --%>
                <button l:value="y">bad</button>
                """;

        List<DirectiveValidator.Violation> violations = validator.validate("c.jte", src);

        assertThat(violations).hasSize(1);
        assertThat(violations.get(0).line()).isEqualTo(2);
    }

    /**
     * @spec.given text that merely contains the substring "l:" inside a word or URL, not as an attr
     * @spec.when  the template is validated
     * @spec.then  no false positive: only attribute-position l:name tokens are scanned
     */
    @Test
    void does_not_false_positive_on_non_attribute_text() {
        String src =
                """
                <p>see html:foo and the ratio l:something written in prose? no.</p>
                <a href="https://x/l:bar">link</a>
                """;

        assertThat(validator.validate("prose.jte", src)).isEmpty();
    }
}
