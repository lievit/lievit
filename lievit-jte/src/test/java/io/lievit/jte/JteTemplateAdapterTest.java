/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.jte;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.resolve.ResourceCodeResolver;
import io.lievit.LievitComponent;
import io.lievit.Wire;
import io.lievit.component.ComponentMetadata;

/**
 * Specifies the JTE adapter: it renders the named template with the {@code @Wire} state as the
 * model, auto-escaping on (ADR-0004, the JTE canonical primary).
 */
class JteTemplateAdapterTest {

    @LievitComponent(template = "greeter")
    static class Greeter {
        @Wire String name = "world";
    }

    /**
     * @spec.given a Greeter component, its wire state, and a JTE engine resolving classpath
     *     templates
     * @spec.when  the adapter renders it
     * @spec.then  the named template is rendered with the wire value spread into the model
     * @spec.adr   ADR-0004
     */
    @Test
    void renders_the_named_template_with_the_wire_state() {
        TemplateEngine engine =
                TemplateEngine.create(new ResourceCodeResolver("jte"), ContentType.Html);
        JteTemplateAdapter adapter = new JteTemplateAdapter(engine);
        ComponentMetadata meta = ComponentMetadata.of(Greeter.class);

        String html = adapter.render(meta, new Greeter(), Map.of("name", "lievit"));

        assertThat(html).contains("Hello, lievit!");
    }
}
