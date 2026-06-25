/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler.convert;

import java.util.List;
import java.util.Optional;

/**
 * The result of converting one component across the SFC&lt;-&gt;MFC boundary (issue #141, ADR-0072):
 * the rewritten Java class source, the template (present after an SFC-&gt;MFC convert, empty after an
 * MFC-&gt;SFC convert because single-file colocates the markup), and the {@link ConversionWarning}s
 * for any fragment that could not be faithfully converted and was skipped.
 *
 * @param classSource the rewritten {@code .java} source
 * @param template the {@code .jte} template source when the target shape is multi-file, else empty
 * @param warnings the warn-and-skip notes, in source order; empty for a faithful, lossless convert
 */
public record ConvertResult(
        String classSource, Optional<String> template, List<ConversionWarning> warnings) {

    public ConvertResult {
        warnings = List.copyOf(warnings);
    }

    /** @return true when nothing was skipped (the convert was faithful and lossless) */
    public boolean isFaithful() {
        return warnings.isEmpty();
    }
}
