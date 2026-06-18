/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.compiler.convert;

import java.util.List;
import java.util.Optional;

/**
 * The result of parsing one authoring shape into the neutral convert AST (issue #141): the single
 * root {@link ViewNode} (a component renders a single root element, ADR-0018) plus the
 * {@link ConversionWarning}s for any fragment that could not be faithfully represented and was
 * skipped.
 *
 * <p>The root is {@link Optional} because a view that has no convertible content at all (e.g. a JTE
 * template that is entirely a control block) parses to no root and a warning, which the CLI surfaces
 * as a refusal rather than writing an empty component.
 *
 * @param root the single root node, or empty when nothing convertible was found
 * @param warnings the warn-and-skip notes, in source order; empty for a clean, faithful convert
 */
public record ParsedView(Optional<ViewNode> root, List<ConversionWarning> warnings) {

    public ParsedView {
        warnings = List.copyOf(warnings);
    }

    /** @return true when the parse produced no warnings (a faithful, lossless convert) */
    public boolean isFaithful() {
        return warnings.isEmpty();
    }
}
