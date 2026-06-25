/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.render;

import java.util.Map;

import dev.lievit.component.ComponentMetadata;

/**
 * The single template-adapter SPI (ADR-0004): the wire runtime renders a component's bound state to
 * HTML through this one abstraction, and each engine (JTE primary, Thymeleaf, Mustache, FreeMarker,
 * raw) implements it in its own module without depending on the others.
 *
 * <p>The core stays free of template-engine knowledge (ADR-0007): it hands the adapter the
 * component metadata, the instance, and the current {@code @Wire} state, and gets back the rendered
 * fragment. The adapter decides how the named template consumes that state.
 */
public interface TemplateAdapter {

    /**
     * Renders a component to its HTML fragment.
     *
     * @param metadata the component metadata (the template name lives on it)
     * @param instance the mounted / rehydrated component instance
     * @param wire the current {@code @Wire} state, as it will ride in the next snapshot
     * @return the rendered HTML fragment for the component root
     */
    String render(ComponentMetadata metadata, Object instance, Map<String, Object> wire);
}
