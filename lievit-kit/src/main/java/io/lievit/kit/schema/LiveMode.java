/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

/**
 * When a field's change triggers a server round-trip (the filament-schemas
 * {@code HasStateBindingModifiers} {@code live} variants carried over). A non-live field defers its
 * value until submit; a live field pushes it so dependents recompute.
 *
 * @param debounceMillis for {@link #DEBOUNCED}, the coalescing window in milliseconds; {@code 0}
 *     for the other modes
 */
public record LiveMode(Kind kind, int debounceMillis) {

    /** The live binding kinds. */
    public enum Kind {
        /** Not live: value pushed only at submit. */
        DEFERRED,
        /** Live: pushed immediately on every change. */
        LIVE,
        /** Live on blur: pushed when the field loses focus. */
        ON_BLUR,
        /** Live, coalesced: pushed after a quiet window of {@code debounceMillis}. */
        DEBOUNCED
    }

    /** The not-live default. */
    public static final LiveMode DEFERRED = new LiveMode(Kind.DEFERRED, 0);

    /**
     * @return a fully-live binding (push on every change)
     */
    public static LiveMode live() {
        return new LiveMode(Kind.LIVE, 0);
    }

    /**
     * @return a live-on-blur binding
     */
    public static LiveMode onBlur() {
        return new LiveMode(Kind.ON_BLUR, 0);
    }

    /**
     * @param millis the coalescing window in milliseconds
     * @return a debounced live binding
     */
    public static LiveMode debounced(int millis) {
        if (millis <= 0) {
            throw new IllegalArgumentException("debounce window must be positive");
        }
        return new LiveMode(Kind.DEBOUNCED, millis);
    }

    /**
     * @return {@code true} for any binding that pushes before submit
     */
    public boolean isLive() {
        return kind != Kind.DEFERRED;
    }
}
