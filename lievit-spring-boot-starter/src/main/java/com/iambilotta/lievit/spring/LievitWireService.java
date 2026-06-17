/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import com.iambilotta.lievit.component.ComponentMetadata;
import com.iambilotta.lievit.component.LievitEffects;
import com.iambilotta.lievit.component.WireCall;
import com.iambilotta.lievit.component.WireDispatcher;
import com.iambilotta.lievit.render.TemplateAdapter;
import com.iambilotta.lievit.wire.ChecksumFailureLimiter;
import com.iambilotta.lievit.wire.ComponentId;
import com.iambilotta.lievit.wire.Snapshot;
import com.iambilotta.lievit.wire.SnapshotCodec;
import com.iambilotta.lievit.wire.WireError;
import com.iambilotta.lievit.wire.WireException;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * The wire-call orchestrator: ties the codec, the registry, the dispatcher, the template adapter,
 * and the checksum-failure limiter into one stateless lifecycle (ADR-0001, wire-protocol.md).
 *
 * <p>This is the seam between the pure codec / lifecycle (the core) and the HTTP edge (the
 * controller). It is the layer the SECURITY.md HMAC boundary runs through: a signature failure is
 * recorded against the client's rate-limit budget before it is rethrown, so a client cannot grind
 * against the HMAC (the ADR-0001 amendment).
 *
 * <p>Real-time validation: when the dispatcher's {@link com.iambilotta.lievit.component.FieldValidator}
 * returns per-field errors, this service injects them as the {@code _errors} key in the template
 * model before rendering. The template can read {@code _errors} to render per-field error messages
 * inline, without a full submit. The errors ride the {@code Lievit-Effects} header as the
 * {@code errors} effect; {@code _errors} is a convenience alias in the model for the template side.
 */
public final class LievitWireService {

    /** Reserved model key carrying the per-field validation errors to the template. */
    public static final String ERRORS_MODEL_KEY = "_errors";

    private final SnapshotCodec codec;
    private final ComponentRegistry registry;
    private final WireDispatcher dispatcher;
    private final TemplateAdapter templateAdapter;
    private final ChecksumFailureLimiter failureLimiter;
    private final ComponentId componentIds;
    private final ObjectMapper json;

    /**
     * @param codec the snapshot codec (sign / verify)
     * @param registry resolves a snapshot class name to a fresh component instance
     * @param dispatcher the stateless lifecycle engine
     * @param templateAdapter the active template adapter (JTE primary)
     * @param failureLimiter the per-client checksum-failure budget
     * @param componentIds the component id generator (for the initial mount)
     * @param json the mapper used to encode the {@code Lievit-Effects} header bag (ADR-0012)
     */
    public LievitWireService(
            SnapshotCodec codec,
            ComponentRegistry registry,
            WireDispatcher dispatcher,
            TemplateAdapter templateAdapter,
            ChecksumFailureLimiter failureLimiter,
            ComponentId componentIds,
            ObjectMapper json) {
        this.codec = codec;
        this.registry = registry;
        this.dispatcher = dispatcher;
        this.templateAdapter = templateAdapter;
        this.failureLimiter = failureLimiter;
        this.componentIds = componentIds;
        this.json = json;
    }

    /**
     * Mounts a component for the first page load: builds it, runs {@code @LievitMount}, renders, and
     * signs the initial snapshot.
     *
     * @param className the {@code @LievitComponent} class name to mount
     * @return the rendered HTML plus its initial signed snapshot
     */
    public WireCallResult mount(String className) {
        ComponentMetadata metadata = registry.metadata(className);
        Object instance = registry.freshInstance(className);

        Map<String, Object> wire = dispatcher.mount(metadata, instance);
        String html = templateAdapter.render(metadata, instance, wire);

        Instant now = Instant.now();
        Snapshot snapshot =
                Snapshot.fresh(componentIds.next(), className, wire, now, codec.ttl());
        // Mount runs no action, so it can produce no effects (ADR-0012): no Lievit-Effects header.
        return WireCallResult.of(html, codec.sign(snapshot));
    }

    /**
     * Runs one wire call (phase 3-4): verify the snapshot, rehydrate, apply updates (rejecting
     * locked fields), invoke actions (skipped if validation fails), re-render, re-sign.
     *
     * <p>When the {@link com.iambilotta.lievit.component.FieldValidator} finds errors, they are
     * injected into the template model as {@code _errors} so the template can render per-field error
     * messages inline. The errors also ride the {@code Lievit-Effects} header as the {@code errors}
     * effect (the client can read them without needing to parse the HTML).
     *
     * @param signedSnapshot the {@code _snapshot} the client carried back
     * @param updates the client {@code _updates}
     * @param calls the client {@code _calls}
     * @param client the client key for the failure limiter (the IP)
     * @return the new HTML plus the next signed snapshot
     * @throws WireException one of the terminal {@link WireError} states (see wire-protocol §4)
     */
    public WireCallResult call(
            String signedSnapshot,
            Map<String, Object> updates,
            List<String> calls,
            String client) {
        Snapshot snapshot;
        try {
            snapshot = codec.verify(signedSnapshot, Instant.now());
        } catch (WireException e) {
            if (e.error() == WireError.SNAPSHOT_FORGED) {
                // A bad signature counts against the client's brute-force budget, then rethrows
                // (or escalates to 429 if the budget is exhausted).
                failureLimiter.recordFailure(client);
            }
            throw e;
        }

        ComponentMetadata metadata = registry.metadata(snapshot.cls());
        Object instance = registry.freshInstance(snapshot.cls());

        WireCall call = dispatcher.call(metadata, instance, snapshot.wire(), updates, calls);
        Map<String, Object> wire = call.wire();
        Map<String, Object> model = withErrors(wire, call.effects());
        String html = templateAdapter.render(metadata, instance, model);

        Instant now = Instant.now();
        // The snapshot carries the @Wire state only (not errors: they are transient per-call,
        // not part of the durable component state). The next call re-validates from scratch.
        Snapshot next = Snapshot.fresh(snapshot.cid(), snapshot.cls(), wire, now, codec.ttl());
        return new WireCallResult(html, codec.sign(next), encodeEffects(call));
    }

    /**
     * Builds the template model from the wire state, injecting validation errors as {@code _errors}
     * when the effects carry them. Returns the original map unmodified when there are no errors.
     */
    private static Map<String, Object> withErrors(Map<String, Object> wire, LievitEffects effects) {
        Map<String, List<String>> errors = effects.validationErrors();
        if (errors == null || errors.isEmpty()) {
            return wire;
        }
        Map<String, Object> model = new LinkedHashMap<>(wire);
        model.put(ERRORS_MODEL_KEY, errors);
        return model;
    }

    /**
     * Encodes the call's effects into the compact JSON {@code Lievit-Effects} header value, or
     * returns {@code null} when there are none (the header is then omitted; ADR-0012). The bag is
     * server-authored and never signed: nothing the client could tamper rides in it.
     */
    private @Nullable String encodeEffects(WireCall call) {
        WireEffects effects = WireEffects.from(call.effects());
        if (effects == null) {
            return null;
        }
        try {
            return json.writeValueAsString(effects);
        } catch (JacksonException e) {
            throw new IllegalStateException("could not encode the Lievit-Effects header", e);
        }
    }
}
