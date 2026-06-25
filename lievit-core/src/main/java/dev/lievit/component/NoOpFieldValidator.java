/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.util.List;
import java.util.Map;

/**
 * The null-object {@link FieldValidator}: passes every instance unchanged. Used when no
 * {@code jakarta.validation.Validator} is available on the classpath (e.g. pure-core unit tests,
 * or apps that opt out of Bean Validation). Zero cost: the {@link WireDispatcher} skips the
 * validation step when this impl returns an empty map.
 */
public final class NoOpFieldValidator implements FieldValidator {

    /** Singleton: stateless, thread-safe, shareable. */
    public static final NoOpFieldValidator INSTANCE = new NoOpFieldValidator();

    private NoOpFieldValidator() {}

    @Override
    public Map<String, List<String>> validate(Object instance) {
        return Map.of();
    }
}
