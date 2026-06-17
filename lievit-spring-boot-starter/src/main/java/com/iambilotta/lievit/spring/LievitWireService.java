/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import com.iambilotta.lievit.component.ComponentMetadata;
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
 */
public final class LievitWireService {

    private final SnapshotCodec codec;
    private final ComponentRegistry registry;
    private final WireDispatcher dispatcher;
    private final TemplateAdapter templateAdapter;
    private final ChecksumFailureLimiter failureLimiter;
    private final ComponentId componentIds;
    private final ObjectMapper json;
    private final ChildRenderer childRenderer;

    /**
     * @param codec the snapshot codec (sign / verify)
     * @param registry resolves a snapshot class name to a fresh component instance
     * @param dispatcher the stateless lifecycle engine
     * @param templateAdapter the active template adapter (JTE primary)
     * @param failureLimiter the per-client checksum-failure budget
     * @param componentIds the component id generator (for the initial mount)
     * @param json the mapper used to encode the {@code Lievit-Effects} header bag (ADR-0012)
     * @param maxChildDepth the nested-component depth cap (ADR-0015, reuses the ADR-0013 nesting
     *     cap): a render cycle deeper than this is a {@code PAYLOAD_TOO_COMPLEX}
     */
    public LievitWireService(
            SnapshotCodec codec,
            ComponentRegistry registry,
            WireDispatcher dispatcher,
            TemplateAdapter templateAdapter,
            ChecksumFailureLimiter failureLimiter,
            ComponentId componentIds,
            ObjectMapper json,
            int maxChildDepth) {
        this.codec = codec;
        this.registry = registry;
        this.dispatcher = dispatcher;
        this.templateAdapter = templateAdapter;
        this.failureLimiter = failureLimiter;
        this.componentIds = componentIds;
        this.json = json;
        this.childRenderer =
                new ChildRenderer(
                        registry, dispatcher, templateAdapter, codec, componentIds, maxChildDepth);
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

        WireCall mounted = dispatcher.mount(metadata, instance);
        Map<String, Object> wire = mounted.wire();
        String html = templateAdapter.render(metadata, instance, wire);
        // Mount and inline any child components the parent declared (ADR-0015); a leaf is unchanged.
        html = childRenderer.substitute(html, mounted.children());

        Instant now = Instant.now();
        Snapshot snapshot =
                Snapshot.fresh(componentIds.next(), className, wire, now, codec.ttl());
        // Mount runs no action, so it can produce no effects (ADR-0012): no Lievit-Effects header.
        return WireCallResult.of(html, codec.sign(snapshot));
    }

    /**
     * Runs one wire call (phase 3-4): verify the snapshot, rehydrate, apply updates (rejecting
     * locked fields), invoke actions, re-render, re-sign.
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
        String html = templateAdapter.render(metadata, instance, wire);
        // Re-mount and inline children on every re-render; the client morph keeps each child's DOM
        // stable by its lievit:key, so a parent re-render does not thrash unchanged children
        // (ADR-0015). A leaf re-render is unchanged.
        html = childRenderer.substitute(html, call.children());

        Instant now = Instant.now();
        Snapshot next = Snapshot.fresh(snapshot.cid(), snapshot.cls(), wire, now, codec.ttl());
        return new WireCallResult(html, codec.sign(next), encodeEffects(call));
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
