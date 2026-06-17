/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The built-in {@link io.lievit.wire.synth.Synthesizer} set: the JVM analogues of Livewire's synth
 * catalog (temporals, enums, {@code BigDecimal}/{@code BigInteger}, {@code UUID}, collections, maps,
 * records / POJOs, and the {@code Wireable} opt-in), wired into the default
 * {@link io.lievit.wire.synth.SynthesizerRegistry} (ADR-0020). Pure Java, zero Spring (ADR-0007).
 */
@NullMarked
package io.lievit.wire.synth.builtin;

import org.jspecify.annotations.NullMarked;
