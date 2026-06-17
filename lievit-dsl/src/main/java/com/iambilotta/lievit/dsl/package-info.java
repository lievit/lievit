/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The single-file DSL authoring mode (ADR-0003, ADR-0018): a type-safe HTML builder and the
 * {@link com.iambilotta.lievit.dsl.TemplateAdapter} that renders a component's {@code @LievitRender}
 * {@link com.iambilotta.lievit.dsl.Html} tree through the same wire pipeline as a template component.
 *
 * <p>Authors import {@link com.iambilotta.lievit.dsl.H} statically and write the view inline as a
 * tree of {@link com.iambilotta.lievit.dsl.Element} / {@link com.iambilotta.lievit.dsl.TextNode}
 * nodes; the Java compiler checks the markup and the renderer escapes by construction (no string
 * templates, no inline {@code <script>} path). {@link com.iambilotta.lievit.dsl.DslTemplateAdapter}
 * implements the core {@code TemplateAdapter} SPI; {@link
 * com.iambilotta.lievit.dsl.DslOrEngineTemplateAdapter} routes between DSL and engine components.
 *
 * <p>Depends only on {@code lievit-core}; no Spring, no other adapter, no new runtime reflection
 * (ArchUnit-enforced, ADR-0004/0006/0007).
 */
@NullMarked
package com.iambilotta.lievit.dsl;

import org.jspecify.annotations.NullMarked;
