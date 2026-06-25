/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Persists a {@code @Wire} field into the HTTP session, restoring it on mount so the value survives
 * a full page refresh (ADR-0031, Livewire {@code #[Session]} parity).
 *
 * <p><b>Against the grain, on purpose.</b> lievit is stateless by design (ADR-0001): the snapshot
 * carries all component state, the server keeps nothing between calls. {@code @LievitSession} is the
 * deliberate, opt-in exception — it stores a property in server session state — so it is documented
 * as a sharp tool. Reach for it only for cross-refresh UI preferences (a chosen filter, a collapsed
 * panel) where the query string ({@link LievitUrl}) does not fit. It does NOT make the field secure
 * (a session value is still server-trusted only as far as the session is) and it scales the server's
 * session memory with the number of such fields; for shareable / bookmarkable state prefer
 * {@link LievitUrl}, which keeps the stateless contract.
 *
 * <p>On the first page load the field is read from the session if a value was stored under its key;
 * on dehydrate (after every call) the current value is written back. The default key is derived from
 * the component class plus the field name; an explicit {@link #key()} may embed a
 * {@code {dotted.path}} placeholder resolved against component state, so a per-entity preference gets
 * a per-entity key.
 *
 * <p>Adding {@code @LievitSession} is governed by ADR-0031.
 */
@Documented
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitSession {

    /**
     * An explicit session key, optionally embedding a {@code {dotted.path}} placeholder resolved
     * against component state. Empty (the default) derives the key from the component class and the
     * field name.
     *
     * @return the session key template, or empty for the derived default
     */
    String key() default "";
}
