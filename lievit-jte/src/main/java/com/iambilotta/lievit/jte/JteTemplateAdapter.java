/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.jte;

import java.util.LinkedHashMap;
import java.util.Map;

import com.iambilotta.lievit.component.ComponentMetadata;
import com.iambilotta.lievit.render.TemplateAdapter;

import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;

/**
 * The JTE template adapter: the canonical primary engine (ADR-0004). Renders a component's bound
 * state to HTML by delegating to a {@link gg.jte.TemplateEngine}.
 *
 * <p>It wraps the engine directly, so it is independent of Spring and of the other adapters
 * (ArchUnit-enforced, ADR-0004). The template named by {@link ComponentMetadata#template()} is
 * rendered with a {@code Map<String, Object>} model: the {@code @Wire} state spread at top level
 * plus {@code _component} (the metadata) so the template can stamp the root element's lievit
 * attributes.
 */
public final class JteTemplateAdapter implements TemplateAdapter {

    private static final String SUFFIX = ".jte";

    private final TemplateEngine engine;

    /**
     * @param engine the JTE engine the host application already configures
     */
    public JteTemplateAdapter(TemplateEngine engine) {
        this.engine = engine;
    }

    @Override
    public String render(ComponentMetadata metadata, Object instance, Map<String, Object> wire) {
        Map<String, Object> model = new LinkedHashMap<>(wire);
        model.put("_component", metadata);
        model.put("_instance", instance);

        StringOutput output = new StringOutput();
        engine.render(templateName(metadata), model, output);
        return output.toString();
    }

    private String templateName(ComponentMetadata metadata) {
        String template = metadata.template();
        if (template.isEmpty()) {
            throw new IllegalStateException(
                    "@LievitComponent("
                            + metadata.className()
                            + ") declares no template; single-file render is not supported by the"
                            + " JTE adapter");
        }
        return template.endsWith(SUFFIX) ? template : template + SUFFIX;
    }
}
