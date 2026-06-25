/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Spec for the server half of scoped CSS modules (issue #129, ADR-0063): a component's CSS is wrapped
 * in its per-component scope selector so rules never leak, deeply-namespaced names keep their own
 * scope, and a content hash busts the served stylesheet's cache. Pure logic, no Spring.
 */
class ScopedCssTest {

    /**
     * @spec.given a stylesheet with a class rule and the root pseudo-selectors
     * @spec.when  it is scoped to a component
     * @spec.then  each selector is constrained to the component's {@code [data-lievit-scope]}, and
     *     {@code :scope}/{@code &} map to the root itself, so the rules apply only to that subtree
     * @spec.adr   ADR-0063
     * @spec.us    US-129-scoped-css
     */
    @Test
    void wraps_each_selector_in_the_component_scope() {
        String css = ".title { color: red; } :scope { padding: 1rem; }";

        String scoped = ScopedCss.scope(css, "com.acme.ui.Modal");

        assertThat(scoped).contains("[data-lievit-scope=\"com-acme-ui-Modal\"] .title {");
        assertThat(scoped).contains("[data-lievit-scope=\"com-acme-ui-Modal\"] {");
        assertThat(scoped).doesNotContain(" :scope ");
    }

    /**
     * @spec.given two components whose names differ only by namespace but share a class name
     * @spec.when  each stylesheet is scoped
     * @spec.then  the scope ids differ, so one component's rule cannot match the other's subtree
     *     (no leakage across deeply-namespaced names)
     * @spec.adr   ADR-0063
     */
    @Test
    void deeply_namespaced_names_resolve_to_distinct_scopes() {
        String a = ScopedCss.scope(".card {color:red}", "com.acme.ui.deep.Modal");
        String b = ScopedCss.scope(".card {color:red}", "com.acme.ui.Modal");

        assertThat(ScopedCss.scopeId("com.acme.ui.deep.Modal"))
                .isNotEqualTo(ScopedCss.scopeId("com.acme.ui.Modal"));
        assertThat(a).contains("[data-lievit-scope=\"com-acme-ui-deep-Modal\"]");
        assertThat(b).contains("[data-lievit-scope=\"com-acme-ui-Modal\"]");
    }

    /**
     * @spec.given a stylesheet wrapping rules in an {@code @media} at-rule
     * @spec.when  it is scoped
     * @spec.then  the at-rule head is preserved and its inner selectors are scoped (the media query
     *     still applies, but only inside the component)
     * @spec.adr   ADR-0063
     */
    @Test
    void scopes_inside_at_rules() {
        String css = "@media (min-width: 40rem) { .row { display: flex; } }";

        String scoped = ScopedCss.scope(css, "Grid");

        assertThat(scoped).contains("@media (min-width: 40rem) {");
        assertThat(scoped).contains("[data-lievit-scope=\"Grid\"] .row {");
    }

    /**
     * @spec.given two different stylesheets and one repeated
     * @spec.when  their content hashes are computed
     * @spec.then  identical CSS yields the same hash (cacheable) and different CSS yields a different
     *     hash (cache-busted), so the served URL changes exactly when the bytes change
     * @spec.adr   ADR-0063
     */
    @Test
    void content_hash_changes_only_when_the_css_changes() {
        String hashA = ScopedCss.contentHash(".a{}");
        String hashB = ScopedCss.contentHash(".b{}");

        assertThat(ScopedCss.contentHash(".a{}")).isEqualTo(hashA);
        assertThat(hashB).isNotEqualTo(hashA);
    }
}
