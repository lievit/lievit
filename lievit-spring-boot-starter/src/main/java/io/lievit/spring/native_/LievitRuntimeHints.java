/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.native_;

import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.aot.hint.TypeReference;

import io.lievit.spring.WireCallRequest;
import io.lievit.spring.WireEffects;

/**
 * The static, component-independent half of lievit's GraalVM native reachability metadata (ADR-0006,
 * zero runtime reflection only if the hints are supplied). It registers the wire DTOs that cross
 * Jackson at the HTTP edge and lievit's own reflective types; the per-application {@code
 * @LievitComponent} classes are registered separately by {@link LievitComponentsAotProcessor},
 * which sees the actual bean definitions at build time.
 *
 * <p>Most controller request/response binding is auto-inferred by Spring AOT, but the wire payload
 * record {@link WireCallRequest} (deserialized from the request body) and the effects bag {@link
 * WireEffects} (serialized into the {@code Lievit-Effects} header by an {@code ObjectMapper}, not by
 * a {@code @RestController} return path Spring can see) are registered explicitly so a native image
 * can reflectively read/write them.
 *
 * <p>Activated by {@code @ImportRuntimeHints} on {@link
 * io.lievit.spring.LievitAutoConfiguration}, so it applies to every lievit app without
 * the adopter writing a hint.
 */
public final class LievitRuntimeHints implements RuntimeHintsRegistrar {

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
        // The wire request body record: deserialized reflectively from JSON by Jackson. Its nested
        // accessor surface (record components) must be reachable.
        hints.reflection()
                .registerType(
                        WireCallRequest.class,
                        MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
                        MemberCategory.INVOKE_DECLARED_METHODS,
                        MemberCategory.DECLARED_FIELDS);

        // The effects bag and its nested Event record: serialized by the ObjectMapper into the
        // Lievit-Effects header. Spring cannot infer this binding (it is not a controller return
        // type), so it is registered for serialization explicitly.
        hints.serialization().registerType(TypeReference.of(WireEffects.class));
        hints.serialization().registerType(TypeReference.of(WireEffects.Event.class));
        // The v4 convergence $js call record (ADR-0024 #131), serialized into the same header.
        hints.serialization().registerType(TypeReference.of(WireEffects.Js.class));
        hints.reflection()
                .registerType(
                        WireEffects.class,
                        MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
                        MemberCategory.INVOKE_DECLARED_METHODS,
                        MemberCategory.DECLARED_FIELDS);
        hints.reflection()
                .registerType(
                        WireEffects.Event.class,
                        MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
                        MemberCategory.INVOKE_DECLARED_METHODS,
                        MemberCategory.DECLARED_FIELDS);
        hints.reflection()
                .registerType(
                        WireEffects.Js.class,
                        MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
                        MemberCategory.INVOKE_DECLARED_METHODS,
                        MemberCategory.DECLARED_FIELDS);
        // The $this.download effect record (#161), serialized into the same header.
        hints.serialization().registerType(TypeReference.of(WireEffects.Download.class));
        hints.reflection()
                .registerType(
                        WireEffects.Download.class,
                        MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
                        MemberCategory.INVOKE_DECLARED_METHODS,
                        MemberCategory.DECLARED_FIELDS);
        // The page-level assets block + scoped-CSS styleModule (issue #171/#129), serialized into the
        // same header (single endpoint) and the batch JSON body.
        hints.serialization().registerType(TypeReference.of(WireEffects.Assets.class));
        hints.serialization().registerType(TypeReference.of(WireEffects.StyleModule.class));
        hints.reflection()
                .registerType(
                        WireEffects.Assets.class,
                        MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
                        MemberCategory.INVOKE_DECLARED_METHODS,
                        MemberCategory.DECLARED_FIELDS);
        hints.reflection()
                .registerType(
                        WireEffects.StyleModule.class,
                        MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
                        MemberCategory.INVOKE_DECLARED_METHODS,
                        MemberCategory.DECLARED_FIELDS);
    }
}
