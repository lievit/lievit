/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.hello;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import io.lievit.compiler.DirectiveValidator;
import io.lievit.spring.DirectiveTemplateValidator;

/**
 * Spec proving the unknown-{@code l:}-directive poka-yoke (ADR-0082) on lievit's own hello-admin
 * example: the shipped (fixed) admin templates use only known directives, and the pre-fix buggy
 * row-arm ({@code l:model + l:value} on a button) is rejected. This is the regression guard for the
 * exact bug that motivated the validator: lievit's canonical example must stay clean, and the
 * broken shape must stay caught.
 */
class HelloAdminDirectivesTest {

    /**
     * @spec.given the shipped hello-admin admin templates (listing-list.jte, listing-form.jte)
     * @spec.when  the directive validator scans them
     * @spec.then  no unknown directive: the canonical example passes the poka-yoke
     * @spec.adr   ADR-0082
     */
    @Test
    void hello_admin_templates_use_only_known_directives() {
        DirectiveTemplateValidator v =
                new DirectiveTemplateValidator("classpath*:jte/admin/**/*.jte", List.of());

        assertThat(v.scan()).isEmpty();
    }

    /**
     * @spec.given the pre-fix buggy row-arm fixture (l:model + l:value on a button)
     * @spec.when  the directive validator scans it
     * @spec.then  l:value is rejected with the $set fix in the hint (the bug stays caught)
     * @spec.adr   ADR-0082
     */
    @Test
    void the_pre_fix_buggy_row_arm_is_rejected() {
        DirectiveTemplateValidator v =
                new DirectiveTemplateValidator(
                        "classpath*:directive-negative/**/*.jte", List.of());

        List<DirectiveValidator.Violation> violations = v.scan();

        assertThat(violations).extracting(DirectiveValidator.Violation::directive)
                .containsExactly("l:value");
        assertThat(violations.get(0).hint()).contains("$set('field', value)");
    }
}
