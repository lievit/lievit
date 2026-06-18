/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import io.lievit.LievitFormObject;
import io.lievit.wire.PayloadGuard;
import io.lievit.wire.WireError;
import io.lievit.wire.WireException;
import io.lievit.wire.synth.SynthesizerRegistry;

/**
 * Drives the stateless component lifecycle for one wire call (ADR-0001, wire-protocol.md phases
 * 1-4). Pure Java, zero Spring (ADR-0007).
 *
 * <p>The two entry points are {@link #mount(ComponentMetadata, Object)} (first page load: run the
 * {@code @LievitMount} hook, then read the initial {@code @Wire} state) and
 * {@link #call(ComponentMetadata, Object, Map, Map, List)} (an interaction: rehydrate the snapshot
 * state, apply the client {@code _updates}, run the {@link FieldValidator}, invoke the
 * {@code _calls} actions in order, read back the new state).
 *
 * <p>The load-bearing security rules live in {@link #applyUpdates} and {@link #invokeAction}:
 *
 * <ul>
 *   <li>only a {@code @Wire} field is client-settable (an update for any other name is dropped, not
 *       applied) and only a {@code @LievitAction} method is client-callable (a call naming anything
 *       else is a {@link WireError#UNKNOWN_COMPONENT}). The annotation <em>is</em> the
 *       authorization allowlist (ADR-0013): lifecycle hooks, getters, and arbitrary methods are
 *       never reachable from the wire, on the first POST or any later one.
 *   <li>a {@code @Wire} field marked {@code @LievitProperty(locked = true)} rejects any inbound
 *       update with a {@link WireError#LOCKED_PROPERTY}. The snapshot signature stops tampering
 *       between requests; the lock stops the first request from writing a server-owned field
 *       (ADR-0001 amendment).
 *   <li>the {@link PayloadGuard} bounds the payload's shape (max updates / calls / nesting) and
 *       enforces the deserialization allowlist before any value is bound (ADR-0013).
 *   <li>the {@link FieldValidator} runs after updates are applied and before any action: if it
 *       returns per-field errors they are written to the effects sink and the actions are skipped.
 *       Validation is server-authoritative; the client renders the errors inline. Idempotent: same
 *       input always produces the same error set.
 *   <li>form-object fields ({@link LievitFormObject}) hydrate from a nested map in the snapshot
 *       and accept dotted-path updates (e.g., {@code "form.email"}) in {@code _updates} (ADR-0017).
 *       Only fields declared on the form object class are settable; depth is bounded at one level.
 * </ul>
 */
public final class WireDispatcher {

    /**
     * Reserved key in the snapshot {@code wire} carrying the lifecycle memo (ADR-0022): the bag a
     * listener writes on {@link LifecyclePhase#DEHYDRATE} and reads on {@link LifecyclePhase#HYDRATE}
     * to pin cross-cutting state (locale, persistent-middleware metadata) across the stateless round
     * trip. It is not a {@code @Wire} field, so the rehydrate/readWire field loops ignore it.
     */
    public static final String MEMO_KEY = "@memo";

    private final PayloadGuard payloadGuard;
    private final FieldValidator fieldValidator;
    private final SynthesizerRegistry synthesizers;
    private final LifecycleBus lifecycle;
    private final java.util.function.BiFunction<String, Integer, String> keyGenerator;

    /**
     * Uses the protocol-default {@link PayloadGuard}, the no-op {@link FieldValidator}, the default
     * {@link SynthesizerRegistry} (typed-state round-trip, ADR-0020), an empty {@link LifecycleBus}
     * (ADR-0022), and the positional {@code @key} generator (ADR-0023).
     */
    public WireDispatcher() {
        this(new PayloadGuard(), NoOpFieldValidator.INSTANCE, new SynthesizerRegistry(),
                new LifecycleBus(), DeterministicKeyScope.POSITIONAL);
    }

    /**
     * @param payloadGuard the structural-cap and deserialization-allowlist guard (ADR-0013)
     */
    public WireDispatcher(PayloadGuard payloadGuard) {
        this(payloadGuard, NoOpFieldValidator.INSTANCE, new SynthesizerRegistry(),
                new LifecycleBus(), DeterministicKeyScope.POSITIONAL);
    }

    /**
     * @param payloadGuard the structural-cap and deserialization-allowlist guard (ADR-0013)
     * @param fieldValidator the Jakarta Bean Validation-backed field validator (or a custom
     *     implementation); use {@link NoOpFieldValidator#INSTANCE} to skip validation
     */
    public WireDispatcher(PayloadGuard payloadGuard, FieldValidator fieldValidator) {
        this(payloadGuard, fieldValidator, new SynthesizerRegistry(), new LifecycleBus(),
                DeterministicKeyScope.POSITIONAL);
    }

    /**
     * @param payloadGuard the structural-cap and deserialization-allowlist guard (ADR-0013)
     * @param fieldValidator the field validator (or {@link NoOpFieldValidator#INSTANCE})
     * @param keyGenerator the deterministic {@code @key} generator for keyless children (ADR-0023):
     *     {@code (templateId, counter) -> key}. The starter passes {@code lievit-compiler}'s crc32
     *     generator ({@code lw-<crc32>-<counter>}); the core default is positional, so a keyless
     *     child still gets a stable key without the compiler module on the classpath. The dispatcher
     *     binds a {@link DeterministicKeyScope} with this generator around every mount / re-render
     *     and enters the component's template namespace, so a child declared without an explicit key
     *     gets a key stable for its template position across re-renders (the morph anchor). Uses the
     *     default {@link SynthesizerRegistry} (ADR-0020) and an empty {@link LifecycleBus} (ADR-0022).
     */
    public WireDispatcher(
            PayloadGuard payloadGuard,
            FieldValidator fieldValidator,
            java.util.function.BiFunction<String, Integer, String> keyGenerator) {
        this(payloadGuard, fieldValidator, new SynthesizerRegistry(), new LifecycleBus(),
                keyGenerator);
    }

    /**
     * @param payloadGuard the structural-cap and deserialization-allowlist guard (ADR-0013)
     * @param fieldValidator the field validator (use {@link NoOpFieldValidator#INSTANCE} to skip)
     * @param synthesizers the typed-state synthesizer registry: dehydrates a non-primitive
     *     {@code @Wire} value to a tuple and hydrates it back to the exact type (ADR-0020)
     */
    public WireDispatcher(
            PayloadGuard payloadGuard,
            FieldValidator fieldValidator,
            SynthesizerRegistry synthesizers) {
        this(payloadGuard, fieldValidator, synthesizers, new LifecycleBus(),
                DeterministicKeyScope.POSITIONAL);
    }

    /**
     * @param payloadGuard the structural-cap and deserialization-allowlist guard (ADR-0013)
     * @param fieldValidator the field validator (use {@link NoOpFieldValidator#INSTANCE} to skip)
     * @param synthesizers the typed-state synthesizer registry (ADR-0020)
     * @param lifecycle the lifecycle interceptor bus: features register listeners on the ordered
     *     phases (hydrate, update, updated, call, render, dehydrate, destroy) instead of editing the
     *     dispatcher (ADR-0022)
     */
    public WireDispatcher(
            PayloadGuard payloadGuard,
            FieldValidator fieldValidator,
            SynthesizerRegistry synthesizers,
            LifecycleBus lifecycle) {
        this(payloadGuard, fieldValidator, synthesizers, lifecycle,
                DeterministicKeyScope.POSITIONAL);
    }

    /**
     * The full collaborator set (the union of ADR-0020 typed state, ADR-0022 lifecycle bus, and
     * ADR-0023 deterministic keys).
     *
     * @param payloadGuard the structural-cap and deserialization-allowlist guard (ADR-0013)
     * @param fieldValidator the field validator (use {@link NoOpFieldValidator#INSTANCE} to skip)
     * @param synthesizers the typed-state synthesizer registry (ADR-0020)
     * @param lifecycle the lifecycle interceptor bus (ADR-0022): features register listeners on the
     *     ordered phases (hydrate, update, updated, call, render, dehydrate, destroy) instead of
     *     editing the dispatcher
     * @param keyGenerator the deterministic {@code @key} generator for keyless children (ADR-0023):
     *     {@code (templateId, counter) -> key}; the dispatcher binds a {@link DeterministicKeyScope}
     *     with it around every mount / re-render and enters the component's template namespace
     */
    public WireDispatcher(
            PayloadGuard payloadGuard,
            FieldValidator fieldValidator,
            SynthesizerRegistry synthesizers,
            LifecycleBus lifecycle,
            java.util.function.BiFunction<String, Integer, String> keyGenerator) {
        this.payloadGuard = payloadGuard;
        this.fieldValidator = fieldValidator;
        this.synthesizers = synthesizers;
        this.lifecycle = lifecycle;
        this.keyGenerator = keyGenerator;
    }

    /**
     * The key-namespace identity for a component's keyless children (ADR-0023): the declared template
     * path for a multi-file component (so components sharing a template share a namespace, the
     * Livewire behavior), else the component FQN for a single-file render. Mirrors
     * {@code CompiledComponent.templateId} in the compiler module without depending on it.
     */
    private static String templateId(ComponentMetadata metadata) {
        return metadata.template().isEmpty() ? metadata.className() : metadata.template();
    }

    /**
     * Mounts a fresh component with no props and no URL query state: the top-level page mount.
     *
     * <p>Binds a {@link ComputedCache} for the duration of the mount so that any {@code
     * @LievitComputed} methods invoked from the mount hook or the render hook are memoized. The
     * computed values resolved during mount are available via the returned {@link WireCall}.
     *
     * @param metadata the component metadata
     * @param instance a fresh component instance
     * @return the wire call outcome: initial {@code @Wire} state, empty effects, computed values
     *     (ADR-0015), plus any children the render declared (ADR-0016)
     */
    public WireCall mount(ComponentMetadata metadata, Object instance) {
        return mount(metadata, instance, Map.of(), Map.of());
    }

    /**
     * Mounts a fresh component, seeding parent-supplied props (a keyed child's props) before the
     * mount hook. Delegates to {@link #mount(ComponentMetadata, Object, Map, Map)} with no URL query
     * state: children are not URL-bound, only the top-level page mount carries query parameters.
     *
     * @param metadata the component metadata
     * @param instance a fresh component instance
     * @param props the parent-supplied props to seed onto {@code @Wire} fields ({@code @key}-keyed
     *     children pass these down); JSON-shaped, may be empty
     * @return the initial {@code @Wire} state, empty effects, computed values (ADR-0015), plus any
     *     children the render declared (ADR-0016)
     */
    public WireCall mount(ComponentMetadata metadata, Object instance, Map<String, Object> props) {
        return mount(metadata, instance, props, Map.of());
    }

    /**
     * Mounts a fresh component, seeding parent-supplied props first, then seeding its
     * {@code @LievitUrl} fields from the host page's query parameters.
     *
     * <p>Order (wire-protocol.md phase 1): props are seeded first (a child gets its parent props),
     * then the {@code @LievitMount} hook runs (it can derive state from a prop and set mount-defaults
     * for URL-bound fields), then the matching query parameters overwrite the URL-bound fields, then
     * the render runs (binding the {@link LievitChildren} sink so it may declare its own children).
     * So a URL with {@code ?search=foo} pre-fills the bound field before the first render, while a
     * parameter absent from the URL leaves the mount-default in place ({@code @LievitUrl}, ADR-0012).
     *
     * <p>Props go through the same settable allowlist as a client update (only a {@code @Wire} field
     * is seeded; the {@link PayloadGuard} proves every prop value is plain JSON data first), but a
     * prop targeting a locked field is honored: the parent is server-side, and locked stops the
     * <em>client</em>, not the owning parent (ADR-0016). URL seeding only ever writes a String into a
     * String field and never touches a non-{@code @LievitUrl} field (ADR-0012).
     *
     * <p>Binds a {@link ComputedCache} for the duration of the mount so that any {@code
     * @LievitComputed} methods invoked from the mount or render hook are memoized; the resolved
     * computed values ride the returned {@link WireCall} (ADR-0015).
     *
     * @param metadata the component metadata
     * @param instance a fresh component instance
     * @param props the parent-supplied props to seed onto {@code @Wire} fields ({@code @key}-keyed
     *     children pass these down); JSON-shaped, may be empty
     * @param queryParams the host request's query parameters (first value per key), never null
     * @return the initial {@code @Wire} state, empty effects, computed values (ADR-0015), plus any
     *     children the render declared (ADR-0016)
     */
    public WireCall mount(
            ComponentMetadata metadata,
            Object instance,
            Map<String, Object> props,
            Map<String, String> queryParams) {
        ComputedCache computedCache = new ComputedCache();
        ComputedCache.bind(computedCache);
        LievitEffects effects = new LievitEffects();
        LievitEffects.bind(effects);
        LievitChildren children = new LievitChildren();
        LievitChildren.bind(children);
        LifecycleContext ctx = new LifecycleContext(metadata, instance, true);
        DeterministicKeyScope keyScope = new DeterministicKeyScope(keyGenerator);
        keyScope.enter(templateId(metadata));
        DeterministicKeyScope.bind(keyScope);
        try {
            payloadGuard.checkSnapshotWire(props);
            seedProps(metadata, instance, props);

            // Phase: MOUNT (props seeded, mount hook about to run).
            List<Runnable> mountFinishes = lifecycle.trigger(LifecyclePhase.MOUNT, ctx);
            invokeHook(metadata.mount(), instance);
            runFinishes(mountFinishes);
            // URL query parameters overwrite the URL-bound fields' mount-defaults, before render.
            UrlQueryBinder.seedFromQuery(metadata, instance, queryParams);

            // Phase: RENDER (skippable, the renderless seam; ADR-0022).
            List<Runnable> renderFinishes = lifecycle.trigger(LifecyclePhase.RENDER, ctx);
            if (!ctx.skipRender()) {
                invokeHook(metadata.render(), instance);
            }
            runFinishes(renderFinishes);
            resolveAllComputed(metadata, instance, computedCache);

            // Phase: DEHYDRATE (a listener seals the snapshot memo here).
            Map<String, Object> wire = readWire(metadata, instance);
            runFinishes(lifecycle.trigger(LifecyclePhase.DEHYDRATE, ctx));
            mergeMemo(wire, ctx);
            return new WireCall(wire, effects, computedCache.snapshot(), children.declared());
        } finally {
            runFinishes(lifecycle.trigger(LifecyclePhase.DESTROY, ctx));
            ComputedCache.clear();
            LievitEffects.clear();
            LievitChildren.clear();
            DeterministicKeyScope.clear();
        }
    }

    /**
     * Runs one wire call against a rehydrated component.
     *
     * <p>Lifecycle: verify payload → rehydrate → apply updates → <strong>validate</strong> (if
     * errors: write to effects, skip actions) → invoke actions → re-render → read wire.
     *
     * @param metadata the component metadata
     * @param instance a fresh component instance to rehydrate onto
     * @param snapshotWire the {@code @Wire} state decoded from the verified snapshot
     * @param updates the client-supplied field updates ({@code _updates})
     * @param calls the action names to invoke, in order ({@code _calls})
     * @return the new {@code @Wire} state plus any {@link LievitEffects} the actions or the
     *     validator produced
     * @throws WireException {@link WireError#LOCKED_PROPERTY} if an update targets a locked field;
     *     {@link WireError#UNKNOWN_COMPONENT} if a call names no {@code @LievitAction}; {@link
     *     WireError#PAYLOAD_TOO_COMPLEX} if a structural cap is exceeded; {@link
     *     WireError#FORBIDDEN_DESERIALIZATION} if a value is not plain JSON data (ADR-0013)
     */
    public WireCall call(
            ComponentMetadata metadata,
            Object instance,
            Map<String, Object> snapshotWire,
            Map<String, Object> updates,
            List<String> calls) {
        return call(metadata, instance, snapshotWire, updates, calls, List.of());
    }

    /**
     * Runs one wire call that also carries inbound events the client routed to this component (the
     * receiving half of {@code dispatch}, ADR-0030). After the {@code _calls} actions run, every
     * matching {@code @LievitOn} listener is invoked with the event payload; a class-level
     * {@code $refresh} listener matches with no handler (it only triggers the re-render). Inbound
     * events are tallied as rendering actions, so a component re-renders when an event it listens for
     * arrives.
     *
     * @param metadata the component metadata
     * @param instance a fresh component instance to rehydrate onto
     * @param snapshotWire the {@code @Wire} state decoded from the verified snapshot
     * @param updates the client-supplied field updates ({@code _updates})
     * @param calls the action names to invoke, in order ({@code _calls})
     * @param inboundEvents the events the client routed to this component's {@code @LievitOn}
     *     listeners ({@code _events}), in order; empty for a plain action call
     * @return the new {@code @Wire} state plus any {@link LievitEffects} produced
     * @throws WireException one of the terminal {@link WireError} states (see wire-protocol §4)
     */
    public WireCall call(
            ComponentMetadata metadata,
            Object instance,
            Map<String, Object> snapshotWire,
            Map<String, Object> updates,
            List<String> calls,
            List<InboundEvent> inboundEvents) {
        ComputedCache computedCache = new ComputedCache();
        ComputedCache.bind(computedCache);
        LievitEffects effects = new LievitEffects();
        LievitChildren children = new LievitChildren();
        LievitEffects.bind(effects);
        LievitChildren.bind(children);
        LifecycleContext ctx = new LifecycleContext(metadata, instance, false);
        DeterministicKeyScope keyScope = new DeterministicKeyScope(keyGenerator);
        keyScope.enter(templateId(metadata));
        DeterministicKeyScope.bind(keyScope);
        try {
            // Shape-bound the payload (counts, nesting) and prove every value is plain JSON data
            // before anything is bound to a field: the gadget / DoS defense (ADR-0013).
            payloadGuard.checkInbound(updates, calls);
            payloadGuard.checkSnapshotWire(snapshotWire);

            // Phase: HYDRATE (state rehydrated from the verified snapshot; a listener reads the
            // snapshot memo here, the locales pattern, ADR-0022).
            seedMemo(snapshotWire, ctx);
            rehydrate(metadata, instance, snapshotWire);
            runFinishes(lifecycle.trigger(LifecyclePhase.HYDRATE, ctx));

            // Phase: UPDATE per field, then UPDATED after ALL updates are applied, so one finisher
            // can override another field's update (ADR-0022 strict ordering).
            applyUpdates(metadata, instance, updates, ctx);
            runFinishes(lifecycle.trigger(LifecyclePhase.UPDATED, ctx));

            // Validate after updates are applied; if errors exist write them to the effects sink
            // and skip the actions for this call. The re-render still runs so the template can
            // read the (unchanged) wire state and render the errors from the model.
            //
            // Real-time per-field validation (ADR-0038, Livewire validateOnly parity): a live
            // wire:model update with no action surfaces ONLY the updated fields' errors, never the
            // still-untouched neighbours' errors (the user has not reached them yet). A submit (a
            // call) validates everything. The submit path keeps the full bag; the live path filters.
            boolean liveUpdate = calls.isEmpty() && !updates.isEmpty();
            Map<String, List<String>> errors =
                    liveUpdate
                            ? validateUpdatedFields(instance, updates)
                            : fieldValidator.validate(instance);
            if (liveUpdate) {
                // Tell the client exactly which fields this live update revalidated, so it merges:
                // it clears these fields' prior errors and keeps untouched fields' errors (ADR-0038).
                effects.setValidatedFields(new ArrayList<>(updates.keySet()));
            }
            if (errors != null && !errors.isEmpty()) {
                effects.setValidationErrors(errors);
            } else {
                // Phase: CALL per action. A listener may requestEarlyReturn() to short-circuit the
                // method dispatch (the magic-action seam); the @LievitAction allowlist still applies.
                for (String call : calls) {
                    ctx.resetEarlyReturn();
                    ctx.callName(call);
                    List<Runnable> finishes = lifecycle.trigger(LifecyclePhase.CALL, ctx);
                    if (!ctx.earlyReturn()) {
                        effects.captureReturn(invokeAction(metadata, instance, call));
                    }
                    runFinishes(finishes);
                }
                // Inbound events (ADR-0030): invoke every matching @LievitOn listener with its
                // payload. A matched event counts as a rendering action so the component re-renders.
                invokeInboundEvents(metadata, instance, inboundEvents, ctx);
            }

            // Phase: RENDER (skippable). A listener may requestSkipRender() (the renderless seam);
            // the render hook then does not run. Children are still re-declared on a render.
            List<Runnable> renderFinishes = lifecycle.trigger(LifecyclePhase.RENDER, ctx);
            if (!ctx.skipRender()) {
                // Re-render with the children sink bound, so a parent re-declares its children
                // (with their current props) on every re-render; the web layer re-mounts them.
                invokeHook(metadata.render(), instance);
            }
            runFinishes(renderFinishes);
            resolveAllComputed(metadata, instance, computedCache);
            // After the new state settles, reflect any @LievitUrl fields into the url effect so the
            // client pushes/replaces the query string via the History API (ADR-0012, URL binding).
            effects.url(UrlQueryBinder.buildEffect(metadata, instance));

            // Phase: DEHYDRATE (state read back; a listener seals the snapshot memo here).
            Map<String, Object> wire = readWire(metadata, instance);
            runFinishes(lifecycle.trigger(LifecyclePhase.DEHYDRATE, ctx));
            mergeMemo(wire, ctx);
            // renderSkipped rides the result so the web layer sends no HTML patch (renderless /
            // redirect): the client leaves the DOM untouched (ADR-0030, ADR-0031).
            return new WireCall(
                    wire, effects, computedCache.snapshot(), children.declared(), ctx.skipRender());
        } finally {
            runFinishes(lifecycle.trigger(LifecyclePhase.DESTROY, ctx));
            ComputedCache.clear();
            LievitChildren.clear();
            LievitEffects.clear();
            DeterministicKeyScope.clear();
        }
    }

    /**
     * Eagerly resolves every {@code @LievitComputed} method so all values are in the cache before
     * the template adapter reads them (ADR-0015). Already-resolved methods (called by action logic
     * during this call) are cache hits and are not re-invoked.
     */
    private void resolveAllComputed(
            ComponentMetadata metadata, Object instance, ComputedCache computedCache) {
        for (Method method : metadata.computedMethods().values()) {
            computedCache.resolve(method, instance);
        }
    }

    /**
     * Rehydrates every {@code @Wire} field present in the verified snapshot state.
     *
     * <p>For form-object fields, the snapshot carries a nested {@link Map}; the dispatcher
     * creates a fresh form object instance and writes each sub-field from that map, then sets
     * the form object instance onto the component (ADR-0017).
     */
    private void rehydrate(
            ComponentMetadata metadata, Object instance, Map<String, Object> snapshotWire) {
        for (Map.Entry<String, Object> entry : snapshotWire.entrySet()) {
            WireField field = metadata.wireFields().get(entry.getKey());
            if (field == null) {
                continue;
            }
            FormObjectMetadata formMeta = metadata.formObject(entry.getKey());
            if (formMeta != null) {
                // The snapshot carries {"form": {"email": "x", ...}}: rehydrate the nested map
                // into a fresh form object and write it onto the component.
                rehydrateFormObject(formMeta, field, instance, entry.getValue());
            } else {
                // Reconstruct the exact type from a @w tuple (ADR-0020); a plain value passes
                // through the registry unchanged for WireField.write's own numeric coercion.
                field.write(instance, synthesizers.hydrate(entry.getValue()));
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void rehydrateFormObject(
            FormObjectMetadata formMeta,
            WireField field,
            Object componentInstance,
            Object snapshotValue) {
        if (!(snapshotValue instanceof Map<?, ?> rawMap)) {
            // A form field whose snapshot value is not a map: write it as-is and let the
            // field's own write() handle the type mismatch (fail-closed INTERNAL_ERROR).
            field.write(componentInstance, snapshotValue);
            return;
        }
        Map<String, Object> nestedMap = (Map<String, Object>) rawMap;

        // Reuse the existing form object from the component, if already initialised (e.g. by a
        // @LievitMount hook), to preserve fields that are not in the snapshot. Otherwise create
        // a fresh instance so the component is never left with a null form reference.
        Object formInstance = field.read(componentInstance);
        if (formInstance == null) {
            formInstance = formMeta.newInstance();
        }
        for (Map.Entry<String, Object> sub : nestedMap.entrySet()) {
            FormField formField = formMeta.fields().get(sub.getKey());
            if (formField != null) {
                formField.write(formInstance, sub.getValue());
            }
        }
        field.write(componentInstance, formInstance);
    }

    /**
     * Applies client field updates, rejecting any that target a locked field. Supports:
     *
     * <ul>
     *   <li><b>Top-level</b> keys ({@code "count"}) — existing behaviour.
     *   <li><b>Dotted-path</b> keys ({@code "form.email"}) — the first segment names a {@code @Wire}
     *       field that is a {@link LievitFormObject}; the second segment names a field on that form
     *       object. Only one level of nesting is supported (ADR-0017 §Security). A dotted path with
     *       three or more segments is silently dropped (the write is outside the settable allowlist
     *       by depth, which is the security property; the drop matches the treatment of non-@Wire
     *       keys in ADR-0013).
     * </ul>
     *
     * <p>Only a {@code @Wire} field (or a field declared on a {@link LievitFormObject} carried by a
     * {@code @Wire} field) is settable: this is the authorization allowlist (ADR-0013). An update
     * naming anything else is <em>dropped</em>, never applied.
     */
    private void applyUpdates(
            ComponentMetadata metadata,
            Object instance,
            Map<String, Object> updates,
            LifecycleContext ctx) {
        // Per-update UPDATE-phase finishers are collected and run after ALL updates are applied,
        // so a finisher observes the fully-updated state (ADR-0022 updated-after-all ordering).
        List<Runnable> updateFinishes = new ArrayList<>();
        for (Map.Entry<String, Object> entry : updates.entrySet()) {
            String key = entry.getKey();
            ctx.update(key, entry.getValue());
            updateFinishes.addAll(lifecycle.trigger(LifecyclePhase.UPDATE, ctx));
            int dot = key.indexOf('.');
            if (dot >= 0) {
                // Dotted path: delegate to the form-object update logic.
                applyFormObjectUpdate(metadata, instance, key, dot, entry.getValue());
            } else {
                applyTopLevelUpdate(metadata, instance, key, entry.getValue());
            }
        }
        runFinishes(updateFinishes);
    }

    private void applyTopLevelUpdate(
            ComponentMetadata metadata, Object instance, String key, Object value) {
        WireField field = metadata.wireFields().get(key);
        if (field == null) {
            // Not a @Wire field: outside the settable allowlist. Drop it.
            return;
        }
        if (field.locked()) {
            throw new WireException(
                    WireError.LOCKED_PROPERTY,
                    "client update rejected for locked @Wire field");
        }
        // Typed-update path (ADR-0020): a raw scalar written from a wire:model (an <input type=date>
        // string, a <select> enum name) is coerced to the field's declared type before binding, so
        // a LocalDate field rehydrates to LocalDate and an enum field to the enum, not a String.
        field.write(instance, synthesizers.hydrateForUpdate(field.type(), value));
    }

    private void applyFormObjectUpdate(
            ComponentMetadata metadata,
            Object instance,
            String key,
            int dot,
            Object value) {
        String formFieldName = key.substring(0, dot);
        String subFieldName = key.substring(dot + 1);

        // A deeper path (a second dot) is outside the one-level bound: drop it.
        if (subFieldName.indexOf('.') >= 0) {
            return;
        }

        WireField field = metadata.wireFields().get(formFieldName);
        if (field == null) {
            // The left side of the dot does not name a @Wire field. Drop.
            return;
        }
        if (field.locked()) {
            throw new WireException(
                    WireError.LOCKED_PROPERTY,
                    "client update rejected for locked @Wire field");
        }

        FormObjectMetadata formMeta = metadata.formObject(formFieldName);
        if (formMeta == null) {
            // The @Wire field exists but is not a form object. Drop the dotted path.
            return;
        }

        FormField formField = formMeta.fields().get(subFieldName);
        if (formField == null) {
            // The right side does not name a declared form field. Drop it (settable allowlist).
            return;
        }

        // Obtain or create the form object instance.
        Object formInstance = field.read(instance);
        if (formInstance == null) {
            formInstance = formMeta.newInstance();
            field.write(instance, formInstance);
        }
        formField.write(formInstance, value);
    }

    /**
     * Seeds parent-supplied props onto a child's {@code @Wire} fields at mount (ADR-0016). Like
     * {@link #applyUpdates} it honors the settable allowlist (only a {@code @Wire} field is seeded;
     * a prop naming anything else is dropped), but unlike a client update a prop targeting a
     * <em>locked</em> field is honored: the parent is server-side, and locked stops the client, not
     * the owning parent. {@link PayloadGuard#checkSnapshotWire} has already proven the props are
     * plain JSON data before this runs.
     */
    private void seedProps(ComponentMetadata metadata, Object instance, Map<String, Object> props) {
        for (Map.Entry<String, Object> entry : props.entrySet()) {
            WireField field = metadata.wireFields().get(entry.getKey());
            if (field == null) {
                // Not a @Wire field: outside the settable allowlist. Drop it (same rule as updates).
                continue;
            }
            field.write(instance, entry.getValue());
        }
    }

    private @Nullable Object invokeAction(ComponentMetadata metadata, Object instance, String name) {
        // Only a @LievitAction is callable: the annotation IS the authorization allowlist
        // (ADR-0013). A call naming a lifecycle hook (@LievitMount/@LievitRender), a getter, or any
        // other method resolves to no action and is refused; the first POST cannot reach a method
        // the component never exposed to the wire.
        Method action = metadata.action(name);
        if (action == null) {
            throw new WireException(
                    WireError.UNKNOWN_COMPONENT, "no @LievitAction matches the requested call");
        }
        return invoke(action, instance);
    }

    /**
     * Invokes every {@code @LievitOn} listener that matches an inbound event (ADR-0030). A matched
     * event is tallied as a rendering action so the renderless listener does not suppress the render
     * for a component that just received an event it listens for. Unmatched events are ignored (the
     * client should only route an event to a component that listens, but a stale route is harmless).
     */
    private void invokeInboundEvents(
            ComponentMetadata metadata,
            Object instance,
            List<InboundEvent> inboundEvents,
            LifecycleContext ctx) {
        if (inboundEvents.isEmpty()) {
            return;
        }
        EventListenerMetadata listeners = EventListenerMetadata.of(metadata.type());
        for (InboundEvent event : inboundEvents) {
            if (EventInvoker.invokeMatching(listeners, instance, event)) {
                ctx.recordAction(false); // a received event re-renders by default
            }
        }
    }

    /**
     * Validates the instance but surfaces only the violations of the fields the client just updated
     * (ADR-0038): the real-time per-field path. The union of each updated key's
     * {@link FieldValidator#validateOnly} keeps a live {@code wire:model} update from surfacing a
     * still-empty neighbour's error. An update key may be a top-level field ({@code "email"}) or a
     * dotted form-object field ({@code "form.email"}); both pass through {@code validateOnly} as-is.
     */
    private Map<String, List<String>> validateUpdatedFields(
            Object instance, Map<String, Object> updates) {
        Map<String, List<String>> merged = new LinkedHashMap<>();
        for (String field : updates.keySet()) {
            merged.putAll(fieldValidator.validateOnly(instance, field));
        }
        return merged;
    }

    private void invokeHook(@Nullable Method hook, Object instance) {
        if (hook != null) {
            invoke(hook, instance);
        }
    }

    private @Nullable Object invoke(Method method, Object instance) {
        try {
            return method.invoke(instance);
        } catch (IllegalAccessException e) {
            throw new IllegalStateException("cannot invoke " + method.getName(), e);
        } catch (InvocationTargetException e) {
            Throwable cause = e.getCause();
            if (cause instanceof RuntimeException re) {
                throw re;
            }
            throw new IllegalStateException("action threw a checked exception", cause);
        }
    }

    /**
     * Reads the {@code @Wire} state for the next snapshot.
     *
     * <p>For a form-object field, the value written into the snapshot is a nested map of the form
     * object's field values (keyed by field name). This mirrors the structure that
     * {@link #rehydrateFormObject} reads back on the next call.
     */
    private Map<String, Object> readWire(ComponentMetadata metadata, Object instance) {
        Map<String, Object> wire = new LinkedHashMap<>();
        for (WireField field : metadata.wireFields().values()) {
            if (!field.serialize()) {
                continue;
            }
            FormObjectMetadata formMeta = metadata.formObject(field.name());
            if (formMeta != null) {
                // Dehydrate the form object to a nested map for the snapshot.
                wire.put(field.name(), dehydrateFormObject(formMeta, field, instance));
            } else {
                // Route the value through the synthesizer registry: a primitive / scalar / plain
                // JSON container passes through unchanged (the Counter snapshot is byte-identical),
                // a typed value (record / enum / date / VO) becomes a @w tuple that hydrates back to
                // the exact type on the next call (ADR-0020, the kit-CRUD blocker).
                wire.put(field.name(), synthesizers.dehydrate(field.read(instance)));
            }
        }
        return wire;
    }

    private Map<String, Object> dehydrateFormObject(
            FormObjectMetadata formMeta, WireField field, Object componentInstance) {
        Object formInstance = field.read(componentInstance);
        Map<String, Object> nested = new LinkedHashMap<>();
        if (formInstance == null) {
            // Null form object: dehydrate all fields as null (the form was never set up).
            for (String name : formMeta.fields().keySet()) {
                nested.put(name, null);
            }
        } else {
            for (FormField formField : formMeta.fields().values()) {
                nested.put(formField.name(), formField.read(formInstance));
            }
        }
        return nested;
    }

    /** Runs each phase {@code finish} callback in order (ADR-0022). */
    private static void runFinishes(List<Runnable> finishes) {
        for (Runnable finish : finishes) {
            finish.run();
        }
    }

    /**
     * Seeds the lifecycle context's memo from the snapshot's reserved {@code @memo} entry before the
     * HYDRATE listeners run, so a listener (the locales pattern) reads what it stored last call.
     */
    @SuppressWarnings("unchecked")
    private static void seedMemo(Map<String, Object> snapshotWire, LifecycleContext ctx) {
        Object memo = snapshotWire.get(MEMO_KEY);
        if (memo instanceof Map<?, ?> map) {
            ctx.memo().putAll((Map<String, Object>) map);
        }
    }

    /**
     * Writes the lifecycle context's memo into the new wire under {@code @memo} so it survives into
     * the next snapshot. Omitted when no listener wrote anything (the common case), keeping the
     * Counter snapshot unchanged.
     */
    private static void mergeMemo(Map<String, Object> wire, LifecycleContext ctx) {
        if (!ctx.memo().isEmpty()) {
            wire.put(MEMO_KEY, new LinkedHashMap<>(ctx.memo()));
        }
    }
}
