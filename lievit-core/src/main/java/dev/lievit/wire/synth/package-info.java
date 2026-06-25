/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The typed-state round-trip: a {@link dev.lievit.wire.synth.Synthesizer} SPI and the
 * {@link dev.lievit.wire.synth.SynthesizerRegistry} that dehydrates a non-primitive {@code @Wire}
 * value to a {@code {@literal @}w}-tagged tuple and hydrates it back to the exact Java type
 * (ADR-0020). A {@link dev.lievit.wire.synth.Wireable} user type opts into round-trip without a
 * bespoke synth. A {@link dev.lievit.wire.synth.DynamicObject} is a schemaless, open-shape property
 * (the stdClass analogue) whose dotted-path keys are created on set and round-trip as plain JSON
 * (ADR-0065). The {@link dev.lievit.wire.synth.ClassInstantiationGuard} gates reflective
 * instantiation on the hydrate path (ADR-0021). Pure Java, zero Spring (ADR-0007).
 */
@NullMarked
package dev.lievit.wire.synth;

import org.jspecify.annotations.NullMarked;
