/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.dsl;

import java.util.Map;

import com.iambilotta.lievit.component.ComponentMetadata;
import com.iambilotta.lievit.render.TemplateAdapter;

/**
 * The routing {@link TemplateAdapter} that lets single-file DSL and template components coexist in
 * one application (ADR-0015). For each render it asks {@link DslTemplateAdapter#handles}: a component
 * with no template and an {@code @LievitRender} returning {@link Html} renders through the DSL
 * adapter; everything else delegates to the engine adapter (JTE primary, ADR-0004). It is the only
 * wiring the runtime needs to add a second authoring mode without forking the dispatcher: the
 * dispatcher, codec, registry, and HTTP edge are untouched, because routing happens entirely behind
 * the single {@code TemplateAdapter} SPI.
 *
 * <p>Pure Java, zero Spring. The starter installs it as the primary {@code TemplateAdapter} bean
 * (still {@code @ConditionalOnMissingBean}, so an app can override the whole strategy).
 */
public final class DslOrEngineTemplateAdapter implements TemplateAdapter {

    private final DslTemplateAdapter dsl;
    private final TemplateAdapter engine;

    /**
     * @param dsl the single-file DSL adapter
     * @param engine the engine adapter to delegate template components to (JTE primary)
     */
    public DslOrEngineTemplateAdapter(DslTemplateAdapter dsl, TemplateAdapter engine) {
        this.dsl = dsl;
        this.engine = engine;
    }

    @Override
    public String render(ComponentMetadata metadata, Object instance, Map<String, Object> wire) {
        if (DslTemplateAdapter.handles(metadata)) {
            return dsl.render(metadata, instance, wire);
        }
        return engine.render(metadata, instance, wire);
    }
}
