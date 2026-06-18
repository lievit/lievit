/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import io.lievit.compiler.DirectiveValidator;

/**
 * Spec for the fail-fast startup directive validator (ADR-0082): it scans the configured classpath
 * templates, passes a clean tree, throws on a template carrying an unknown {@code l:} directive
 * (the shipped {@code l:value} bug), and lets an app's custom directive through only when
 * allowlisted via {@code lievit.directives.extra}.
 */
class DirectiveTemplateValidatorTest {

    /**
     * @spec.given a classpath template tree using only known directives
     * @spec.when  the startup validator runs (afterPropertiesSet)
     * @spec.then  startup succeeds (no violations)
     * @spec.adr   ADR-0082
     */
    @Test
    void a_clean_template_tree_passes_startup() {
        DirectiveTemplateValidator v =
                new DirectiveTemplateValidator(
                        "classpath*:directive-fixtures/ok/**/*.jte", List.of());

        assertThatCode(v::afterPropertiesSet).doesNotThrowAnyException();
        assertThat(v.scan()).isEmpty();
    }

    /**
     * @spec.given a template carrying l:value (the shipped bug) on the classpath
     * @spec.when  the startup validator runs
     * @spec.then  startup fails with a message naming the template, l:value, and the $set fix
     * @spec.adr   ADR-0082
     */
    @Test
    void an_unknown_directive_fails_startup_with_a_helpful_message() {
        DirectiveTemplateValidator v =
                new DirectiveTemplateValidator(
                        "classpath*:directive-fixtures/bad/**/*.jte", List.of());

        assertThatThrownBy(v::afterPropertiesSet)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("arm.jte")
                .hasMessageContaining("l:value")
                .hasMessageContaining("$set('field', value)")
                .hasMessageContaining("lievit.directives.extra");
    }

    /**
     * @spec.given a template using a custom directive l:tooltip, with NO allowlist
     * @spec.when  the startup validator runs
     * @spec.then  startup fails: a static scan cannot see runtime.directives.register
     * @spec.adr   ADR-0082
     */
    @Test
    void a_custom_directive_fails_startup_without_an_allowlist() {
        DirectiveTemplateValidator v =
                new DirectiveTemplateValidator(
                        "classpath*:directive-fixtures/custom/**/*.jte", List.of());

        List<DirectiveValidator.Violation> violations = v.scan();
        assertThat(violations).hasSize(1);
        assertThat(violations.get(0).directive()).isEqualTo("l:tooltip");
    }

    /**
     * @spec.given the same l:tooltip template, now with lievit.directives.extra=tooltip
     * @spec.when  the startup validator runs with the allowlist
     * @spec.then  startup succeeds: the escape hatch authorises the app's own directive
     * @spec.adr   ADR-0082
     */
    @Test
    void a_custom_directive_passes_startup_when_allowlisted() {
        DirectiveTemplateValidator v =
                new DirectiveTemplateValidator(
                        "classpath*:directive-fixtures/custom/**/*.jte", List.of("tooltip"));

        assertThatCode(v::afterPropertiesSet).doesNotThrowAnyException();
    }

    /**
     * @spec.given a template location that matches no classpath resources
     * @spec.when  the startup validator runs
     * @spec.then  it is a no-op (no templates to scan is not a failure; the app may be DSL-only)
     * @spec.adr   ADR-0082
     */
    @Test
    void no_matching_templates_is_a_no_op() {
        DirectiveTemplateValidator v =
                new DirectiveTemplateValidator(
                        "classpath*:directive-fixtures/nonexistent/**/*.jte", List.of());

        assertThatCode(v::afterPropertiesSet).doesNotThrowAnyException();
        assertThat(v.scan()).isEmpty();
    }
}
