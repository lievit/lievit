/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Specifies {@link RawJs}: a string marked as a raw JS expression so the templating layer emits it
 * verbatim where a JS expression is expected, and HTML-escaped where it would land in markup.
 */
class RawJsTest {

    /**
     * @spec.given a JS expression wrapped in RawJs
     * @spec.when  the raw expression is read
     * @spec.then  it is returned verbatim, unescaped, for the JS-expression slot
     */
    @Test
    void emits_the_expression_verbatim_as_js() {
        RawJs js = RawJs.of("$state === 'active'");

        assertThat(js.expression()).isEqualTo("$state === 'active'");
        assertThat(js.toString()).isEqualTo("$state === 'active'");
    }

    /**
     * @spec.given a RawJs carrying characters that are dangerous in markup
     * @spec.when  it is rendered into an HTML context
     * @spec.then  the markup form is HTML-escaped, so a RawJs never breaks out into HTML
     */
    @Test
    void escapes_when_rendered_into_html() {
        RawJs js = RawJs.of("a < b && c > d");

        assertThat(js.htmlEscaped()).isEqualTo("a &lt; b &amp;&amp; c &gt; d");
    }

    /**
     * @spec.given two RawJs over the same expression
     * @spec.when  they are compared
     * @spec.then  value equality holds (it is a value type)
     */
    @Test
    void is_a_value_type() {
        assertThat(RawJs.of("x")).isEqualTo(RawJs.of("x"));
        assertThat(RawJs.of("x")).hasSameHashCodeAs(RawJs.of("x"));
        assertThatThrownBy(() -> RawJs.of(null)).isInstanceOf(NullPointerException.class);
    }
}
