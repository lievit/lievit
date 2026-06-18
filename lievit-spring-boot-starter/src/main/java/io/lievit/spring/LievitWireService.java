/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import io.lievit.component.ComponentMetadata;
import io.lievit.component.LievitEffects;
import io.lievit.component.WireCall;
import io.lievit.component.WireDispatcher;
import io.lievit.render.TemplateAdapter;
import io.lievit.wire.ChecksumFailureLimiter;
import io.lievit.wire.ComponentId;
import io.lievit.wire.Snapshot;
import io.lievit.wire.SnapshotCodec;
import io.lievit.wire.WireError;
import io.lievit.wire.WireException;

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
 * <p>Real-time validation: when the dispatcher's {@link io.lievit.component.FieldValidator}
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
    private final ChildRenderer childRenderer;

    /**
     * @param codec the snapshot codec (sign / verify)
     * @param registry resolves a snapshot class name to a fresh component instance
     * @param dispatcher the stateless lifecycle engine
     * @param templateAdapter the active template adapter (JTE primary)
     * @param failureLimiter the per-client checksum-failure budget
     * @param componentIds the component id generator (for the initial mount)
     * @param json the mapper used to encode the {@code Lievit-Effects} header bag (ADR-0012)
     * @param maxChildDepth the nested-component depth cap (ADR-0016, reuses the ADR-0013 nesting
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
        // Pass the wire state + any computed values to the template adapter as a merged model.
        // Computed values are NOT serialized into the snapshot (ADR-0015).
        String html = templateAdapter.render(metadata, instance, mergeModel(wire, mounted));
        // Mount and inline any child components the parent declared (ADR-0016); a leaf is unchanged.
        html = childRenderer.substitute(html, mounted.children());

        Instant now = Instant.now();
        Snapshot snapshot =
                Snapshot.fresh(componentIds.next(), className, wire, now, codec.ttl());
        // Mount runs no action, so it can produce no effects (ADR-0012): no Lievit-Effects header.
        return WireCallResult.of(html, codec.sign(snapshot));
    }

    /**
     * Mounts a component for a full-page render (issue #63/#181), seeding the route-bound props onto
     * its {@code @Wire} fields before the mount hook runs, and stamps the wire markers
     * ({@code data-lievit-id} + {@code data-lievit-snapshot}) onto the component's root element so the
     * client can drive its wire calls without a host template hand-wiring the snapshot attribute (the
     * top-level analogue of what {@link ChildRenderer} stamps on a child root). The page renderer then
     * wraps the returned HTML in the resolved layout.
     *
     * @param className the {@code @LievitComponent} class name to mount as a page
     * @param props the route-bound props (path variables) seeded before mount; may be empty
     * @return the stamped component HTML plus its initial signed snapshot
     */
    public WireCallResult mountStamped(String className, Map<String, Object> props) {
        ComponentMetadata metadata = registry.metadata(className);
        Object instance = registry.freshInstance(className);

        WireCall mounted = dispatcher.mount(metadata, instance, props);
        Map<String, Object> wire = mounted.wire();
        String html = templateAdapter.render(metadata, instance, mergeModel(wire, mounted));
        html = childRenderer.substitute(html, mounted.children());

        Instant now = Instant.now();
        String cid = componentIds.next();
        Snapshot snapshot = Snapshot.fresh(cid, className, wire, now, codec.ttl());
        String signed = codec.sign(snapshot);
        // Stamp the top-level wire markers on the component root so the client hydrates it (the
        // top-level peer of ChildRenderer's child-root markers). No lievit:key on a page root.
        String stamped = ChildRenderer.stampRoot(html, cid, signed);
        return WireCallResult.of(stamped, signed);
    }

    /**
     * Runs one wire call (phase 3-4): verify the snapshot, rehydrate, apply updates (rejecting
     * locked fields), invoke actions (skipped if validation fails), re-render, re-sign.
     *
     * <p>When the {@link io.lievit.component.FieldValidator} finds errors, they are
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
        return call(signedSnapshot, updates, calls, List.of(), client);
    }

    /**
     * Runs one wire call that also carries inbound events the client routed to this component's
     * {@code @LievitOn} listeners (ADR-0030, the receiving half of {@code dispatch}).
     *
     * @param signedSnapshot the {@code _snapshot} the client carried back
     * @param updates the client {@code _updates}
     * @param calls the client {@code _calls}
     * @param inboundEvents the client {@code _events} routed to this component's listeners
     * @param client the client key for the failure limiter (the IP)
     * @return the new HTML plus the next signed snapshot and the effects header
     * @throws WireException one of the terminal {@link WireError} states (see wire-protocol §4)
     */
    public WireCallResult call(
            String signedSnapshot,
            Map<String, Object> updates,
            List<String> calls,
            List<io.lievit.component.InboundEvent> inboundEvents,
            String client) {
        // The per-component endpoint is the single-component fast path: it shares the lifecycle with
        // the batch endpoint (issue #177) via runCall, then rides the snapshot + effects on response
        // headers (ADR-0001/ADR-0012) rather than in a JSON body.
        return runCall(signedSnapshot, updates, calls, inboundEvents, client).result();
    }

    /**
     * Runs one batched update (issue #177): commits an array of components in a single request, each
     * through its own stateless lifecycle, and returns one result per component plus a page-level
     * assets block. A reactive child that carried no work ({@link BatchUpdateRequest.Component#isInert()})
     * is skipped server-side: its snapshot is verified only to recover its id, no lifecycle runs, and
     * the result is a bare {@code {skip, id}} marker (Livewire's reactive-child skip optimization).
     *
     * <p>The batch is the page-level transport; the per-component {@link #call} endpoint stays the
     * single-component fast path. Both share the same dispatcher + codec + child renderer, so a
     * component behaves identically whether it commits alone or in a batch.
     *
     * @param components the components to commit, in request order
     * @param client the client key for the failure limiter (the IP)
     * @return one result per component (committed or skipped), index-aligned with the request
     * @throws WireException a terminal {@link WireError} from any component's snapshot verification
     */
    public BatchUpdateResponse batch(
            List<BatchUpdateRequest.Component> components, String client) {
        List<BatchUpdateResponse.ComponentResult> results = new java.util.ArrayList<>(components.size());
        for (BatchUpdateRequest.Component component : components) {
            if (component.isInert()) {
                // Reactive-child skip: recover the id from the verified snapshot, run no lifecycle.
                Snapshot snapshot = codec.verify(component.snapshot(), Instant.now());
                results.add(BatchUpdateResponse.ComponentResult.skipped(snapshot.cid()));
                continue;
            }
            WireCallOutcome outcome =
                    runCall(
                            component.snapshot(),
                            component.updatesOrEmpty(),
                            component.callsOrEmpty(),
                            component.inboundEvents(),
                            client);
            results.add(
                    BatchUpdateResponse.ComponentResult.committed(
                            outcome.cid(),
                            outcome.result().snapshot(),
                            outcome.result().html(),
                            outcome.effects()));
        }
        // No page-level late assets yet (issue #171 owns the asset pipeline); empty map is omitted.
        return new BatchUpdateResponse(results, Map.of());
    }

    /**
     * The shared per-component lifecycle, returning the cid + the structured effects alongside the
     * HTML/snapshot result, so both the header-based per-component endpoint and the JSON batch
     * endpoint reuse one implementation. The per-component {@link #call} delegates here and discards
     * the cid / structured effects (it encodes the effects to the header instead).
     */
    WireCallOutcome runCall(
            String signedSnapshot,
            Map<String, Object> updates,
            List<String> calls,
            List<io.lievit.component.InboundEvent> inboundEvents,
            String client) {
        Snapshot snapshot;
        try {
            snapshot = codec.verify(signedSnapshot, Instant.now());
        } catch (WireException e) {
            if (e.error() == WireError.SNAPSHOT_FORGED) {
                failureLimiter.recordFailure(client);
            }
            throw e;
        }

        ComponentMetadata metadata = registry.metadata(snapshot.cls());
        Object instance = registry.freshInstance(snapshot.cls());

        WireCall call =
                dispatcher.call(metadata, instance, snapshot.wire(), updates, calls, inboundEvents);
        Map<String, Object> wire = call.wire();
        String html;
        if (call.renderSkipped()) {
            html = "";
        } else {
            Map<String, Object> model = withErrors(mergeModel(wire, call), call.effects());
            html = templateAdapter.render(metadata, instance, model);
            html = childRenderer.substitute(html, call.children());
            // Island targeting (server half of islands; pairs with the shipped client islands.ts):
            // when the action targeted one or more named islands, return ONLY those island fragments
            // instead of the full component HTML, so the client morphs just those regions. The whole
            // component is rendered first (the island content is computed in context), then the
            // targeted fragments are extracted by their <!--[lievit:island name]--> markers.
            List<String> islands = call.effects().islands();
            if (!islands.isEmpty()) {
                String targeted = io.lievit.compiler.IslandFragments.extractTargeted(html, islands);
                // Only narrow to the fragment when the render actually emitted the targeted island(s);
                // if none matched (the island was behind a removed conditional), fall back to the full
                // HTML so the client still has something correct to morph.
                if (!targeted.isEmpty()) {
                    html = targeted;
                }
            }
        }

        Instant now = Instant.now();
        Snapshot next = Snapshot.fresh(snapshot.cid(), snapshot.cls(), wire, now, codec.ttl());
        WireEffects effects = WireEffects.from(call.effects());
        String encoded = encodeEffects(effects);
        return new WireCallOutcome(
                snapshot.cid(), new WireCallResult(html, codec.sign(next), encoded), effects);
    }

    /** The internal per-component outcome: the cid, the wire result, and the structured effects. */
    record WireCallOutcome(
            String cid, WireCallResult result, @Nullable WireEffects effects) {}

    /**
     * Merges the snapshot-bound {@code @Wire} state with the per-call computed values into one flat
     * model map for the template adapter. Wire fields take precedence in insertion order; computed
     * values follow. The returned map is used ONLY for rendering, not for signing (ADR-0015).
     */
    private static Map<String, Object> mergeModel(Map<String, Object> wire, WireCall call) {
        Map<String, Object> model = new LinkedHashMap<>(wire);
        model.putAll(call.computed());
        return model;
    }

    /**
     * Injects the per-field validation errors into the template model as {@code _errors} when the
     * effects carry them, so the template can render per-field error messages inline. Returns the
     * model unmodified when there are no errors. The errors are transient per-call (re-validated
     * from scratch on the next call), never serialized into the snapshot.
     */
    private static Map<String, Object> withErrors(Map<String, Object> model, LievitEffects effects) {
        Map<String, List<String>> errors = effects.validationErrors();
        if (errors == null || errors.isEmpty()) {
            return model;
        }
        model.put(ERRORS_MODEL_KEY, errors);
        return model;
    }

    /**
     * Encodes the structured effects into the compact JSON {@code Lievit-Effects} header value, or
     * returns {@code null} when there are none (the header is then omitted; ADR-0012). The bag is
     * server-authored and never signed: nothing the client could tamper rides in it.
     */
    private @Nullable String encodeEffects(@Nullable WireEffects effects) {
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
