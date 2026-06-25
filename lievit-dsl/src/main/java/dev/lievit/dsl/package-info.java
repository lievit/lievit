/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The single-file DSL authoring mode (ADR-0003, ADR-0018): a type-safe HTML builder and the
 * {@link dev.lievit.dsl.TemplateAdapter} that renders a component's {@code @LievitRender}
 * {@link dev.lievit.dsl.Html} tree through the same wire pipeline as a template component.
 *
 * <p>Authors import {@link dev.lievit.dsl.H} statically and write the view inline as a
 * tree of {@link dev.lievit.dsl.Element} / {@link dev.lievit.dsl.TextNode}
 * nodes; the Java compiler checks the markup and the renderer escapes by construction (no string
 * templates, no inline {@code <script>} path). {@link dev.lievit.dsl.DslTemplateAdapter}
 * implements the core {@code TemplateAdapter} SPI; {@link
 * dev.lievit.dsl.DslOrEngineTemplateAdapter} routes between DSL and engine components.
 *
 * <p>Depends only on {@code lievit-core}; no Spring, no other adapter, no new runtime reflection
 * (ArchUnit-enforced, ADR-0004/0006/0007).
 */
@NullMarked
package dev.lievit.dsl;

import org.jspecify.annotations.NullMarked;
