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
 * Marks an {@code @LievitAction} method as a JSON RPC endpoint (issue #99, Livewire {@code #[Js]} /
 * {@code SupportJson} parity): the client calls it as {@code $lievit.method()} and gets a
 * {@code Promise} resolving with the method's raw return value, with <strong>no re-render</strong>.
 *
 * <p>It is the typed-RPC half of the action pipeline: a {@code @LievitJson} method returns data the
 * client consumes directly (a lookup, a computed total), decoupled from rendering. The return value
 * rides the effects channel's {@code returns} key (ADR-0012), exactly like an ordinary action's
 * return value, but the render is always skipped so the round trip carries no HTML patch. A
 * validation failure rejects the client {@code Promise} with {@code {status:422, errors}} (the
 * errors effect); any other throwable rejects with its mapped HTTP status; no error overlay is shown.
 *
 * <p>Implemented by a listener on the {@code CALL} + {@code RENDER} phases (the same render-skip seam
 * {@code @LievitRenderless} uses), so it adds no protocol surface beyond the annotation. Governed by
 * ADR-0032.
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitJson {
}
