/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.compiler.convert;

/**
 * A non-fatal note emitted while parsing a view that the convert could not faithfully represent
 * (issue #141). The convert philosophy is <em>convert what is safe, warn and skip the rest</em>
 * rather than emit wrong output: when a parser meets a construct it cannot map to the neutral
 * {@link ViewNode} AST (a JTE {@code @if}/{@code @for} control block, a DSL {@code fragment(...)} or
 * a programmatic loop in the render body), it records a warning here and drops that fragment instead
 * of guessing.
 *
 * @param construct a short identifier for the unsupported construct (e.g. {@code "@if"},
 *     {@code "fragment"}), for the CLI to group on
 * @param detail a one-line human-readable explanation of what was skipped and why
 */
public record ConversionWarning(String construct, String detail) {}
