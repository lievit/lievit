/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * RENDER test for the button partial's two extra-attribute channels (security).
 *
 * The vitest golden suite asserts on the partial SOURCE as text and the sibling
 * jte-compile smoke proves the partial COMPILES; neither RENDERS the template, so
 * neither can prove that the dynamic data-attribute channel is actually
 * HTML-escaped. This does: it compiles button.jte on the fly with the same gg.jte
 * 3.2.4 compiler in ContentType.Html (DirectoryCodeResolver over registry/jte) and
 * renders it with a HOSTILE dataAttrs value, asserting the value lands inert
 * (quotes/markup escaped, no raw script tag, no tag breakout) -- while the trusted
 * `attrs` channel ($unsafe) still lands its static directive raw.
 */
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;
import gg.jte.resolve.DirectoryCodeResolver;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class XssEscapingTest {

    /** The button partials live two dirs up from this throwaway Maven project. */
    private static final Path JTE_DIR = Path.of("..", "..", "registry", "jte");

    private static final TemplateEngine ENGINE =
            TemplateEngine.create(new DirectoryCodeResolver(JTE_DIR), ContentType.Html);

    /** A classic attribute-breakout XSS payload, as a user/DB-derived value would be. */
    private static final String HOSTILE = "\"><scr" + "ipt>alert(1)</scr" + "ipt>";

    private String renderButton(Map<String, Object> overrides) {
        Map<String, Object> model = new HashMap<>();
        model.put("variant", "danger");
        // gg.jte.Content label: write a plain string into the output.
        model.put("content", (gg.jte.Content) out -> out.writeContent("Reset"));
        model.putAll(overrides);
        StringOutput out = new StringOutput();
        ENGINE.render("button.jte", model, out);
        return out.toString();
    }

    @Test
    void dynamic_dataAttrs_value_is_html_escaped_so_a_hostile_value_renders_inert() {
        String html = renderButton(Map.of("dataAttrs", Map.of("confirm", HOSTILE)));

        // The data-confirm attribute is present...
        assertTrue(html.contains("data-confirm="), "data-confirm attribute should be rendered");
        // ...but the hostile value is escaped INERT. The two characters that matter for an
        // attribute-value breakout are the double-quote (closes the attribute) and the
        // less-than (opens a tag); JTE's htmlAttribute escaper turns both into entities, so the
        // payload can never break out of data-confirm="...". (A bare > inside the value is
        // harmless and JTE leaves it as-is.)
        assertFalse(html.contains("<scr" + "ipt>"), "raw script tag leaked -- value was NOT escaped:\n" + html);
        assertFalse(html.contains("\"><scr"), "attribute breakout leaked -- value was NOT escaped:\n" + html);
        assertTrue(html.contains("&#34;"), "the breakout double-quote must be entity-escaped (&#34;):\n" + html);
        assertTrue(html.contains("&lt;scr" + "ipt"), "the tag-opening < must be entity-escaped (&lt;):\n" + html);
    }

    @Test
    void trusted_attrs_channel_lands_its_static_directive_raw() {
        String html = renderButton(Map.of("attrs", "l:click=\"armReset\""));

        // attrs is $unsafe by design: a trusted, author-typed directive must land verbatim.
        assertTrue(html.contains("l:click=\"armReset\""), "trusted attrs directive should land raw:\n" + html);
    }

    @Test
    void both_channels_coexist_value_escaped_directive_raw() {
        String html = renderButton(Map.of(
                "dataAttrs", Map.of("confirm", HOSTILE),
                "attrs", "l:click=\"armReset\""));

        assertTrue(html.contains("l:click=\"armReset\""), "trusted directive missing:\n" + html);
        assertFalse(html.contains("<scr" + "ipt>"), "hostile dataAttrs value leaked raw:\n" + html);
    }
}
