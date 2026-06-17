/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The typed-state round-trip: a {@link io.lievit.wire.synth.Synthesizer} SPI and the
 * {@link io.lievit.wire.synth.SynthesizerRegistry} that dehydrates a non-primitive {@code @Wire}
 * value to a {@code {@literal @}w}-tagged tuple and hydrates it back to the exact Java type
 * (ADR-0020). A {@link io.lievit.wire.synth.Wireable} user type opts into round-trip without a
 * bespoke synth. The {@link io.lievit.wire.synth.ClassInstantiationGuard} gates reflective
 * instantiation on the hydrate path (ADR-0021). Pure Java, zero Spring (ADR-0007).
 */
@NullMarked
package io.lievit.wire.synth;

import org.jspecify.annotations.NullMarked;
