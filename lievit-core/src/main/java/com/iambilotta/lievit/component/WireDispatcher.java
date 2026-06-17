/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.component;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import com.iambilotta.lievit.wire.PayloadGuard;
import com.iambilotta.lievit.wire.WireError;
import com.iambilotta.lievit.wire.WireException;

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
 * </ul>
 */
public final class WireDispatcher {

    private final PayloadGuard payloadGuard;
    private final FieldValidator fieldValidator;

    /** Uses the protocol-default {@link PayloadGuard} and the no-op {@link FieldValidator}. */
    public WireDispatcher() {
        this(new PayloadGuard(), NoOpFieldValidator.INSTANCE);
    }

    /**
     * @param payloadGuard the structural-cap and deserialization-allowlist guard (ADR-0013)
     */
    public WireDispatcher(PayloadGuard payloadGuard) {
        this(payloadGuard, NoOpFieldValidator.INSTANCE);
    }

    /**
     * @param payloadGuard the structural-cap and deserialization-allowlist guard (ADR-0013)
     * @param fieldValidator the Jakarta Bean Validation-backed field validator (or a custom
     *     implementation); use {@link NoOpFieldValidator#INSTANCE} to skip validation
     */
    public WireDispatcher(PayloadGuard payloadGuard, FieldValidator fieldValidator) {
        this.payloadGuard = payloadGuard;
        this.fieldValidator = fieldValidator;
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
        try {
            payloadGuard.checkSnapshotWire(props);
            seedProps(metadata, instance, props);
            invokeHook(metadata.mount(), instance);
            // URL query parameters overwrite the URL-bound fields' mount-defaults, before render.
            UrlQueryBinder.seedFromQuery(metadata, instance, queryParams);
            invokeHook(metadata.render(), instance);
            resolveAllComputed(metadata, instance, computedCache);
            return new WireCall(
                    readWire(metadata, instance),
                    effects,
                    computedCache.snapshot(),
                    children.declared());
        } finally {
            ComputedCache.clear();
            LievitEffects.clear();
            LievitChildren.clear();
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
        ComputedCache computedCache = new ComputedCache();
        ComputedCache.bind(computedCache);
        LievitEffects effects = new LievitEffects();
        LievitChildren children = new LievitChildren();
        LievitEffects.bind(effects);
        LievitChildren.bind(children);
        try {
            // Shape-bound the payload (counts, nesting) and prove every value is plain JSON data
            // before anything is bound to a field: the gadget / DoS defense (ADR-0013).
            payloadGuard.checkInbound(updates, calls);
            payloadGuard.checkSnapshotWire(snapshotWire);
            rehydrate(metadata, instance, snapshotWire);
            applyUpdates(metadata, instance, updates);

            // Validate after updates are applied; if errors exist write them to the effects sink
            // and skip the actions for this call. The re-render still runs so the template can
            // read the (unchanged) wire state and render the errors from the model.
            Map<String, List<String>> errors = fieldValidator.validate(instance);
            if (errors != null && !errors.isEmpty()) {
                effects.setValidationErrors(errors);
            } else {
                for (String call : calls) {
                    effects.captureReturn(invokeAction(metadata, instance, call));
                }
            }
            // Re-render with the children sink bound, so a parent re-declares its children (with
            // their current props) on every re-render; the web layer re-mounts them (ADR-0016).
            invokeHook(metadata.render(), instance);
            resolveAllComputed(metadata, instance, computedCache);
            // After the new state settles, reflect any @LievitUrl fields into the url effect so the
            // client pushes/replaces the query string via the History API (ADR-0012, URL binding).
            effects.url(UrlQueryBinder.buildEffect(metadata, instance));
            return new WireCall(
                    readWire(metadata, instance),
                    effects,
                    computedCache.snapshot(),
                    children.declared());
        } finally {
            ComputedCache.clear();
            LievitChildren.clear();
            LievitEffects.clear();
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

    /** Rehydrates every {@code @Wire} field present in the verified snapshot state. */
    private void rehydrate(
            ComponentMetadata metadata, Object instance, Map<String, Object> snapshotWire) {
        for (Map.Entry<String, Object> entry : snapshotWire.entrySet()) {
            WireField field = metadata.wireFields().get(entry.getKey());
            if (field != null) {
                field.write(instance, entry.getValue());
            }
        }
    }

    /**
     * Applies client field updates, rejecting any that target a locked field. Only a {@code @Wire}
     * field is settable: this is the authorization allowlist (ADR-0013). An update naming anything
     * else (a non-{@code @Wire} field, a setter, a private field) is <em>dropped</em>, never
     * applied, so a first POST cannot write a property the component never exposed to the wire. The
     * drop is silent rather than a hard error because the signed snapshot already bounds the
     * non-malicious surface and a stray key is treated as noise; the security property is that the
     * write does not happen, which {@code WireDispatcherTest} pins.
     */
    private void applyUpdates(
            ComponentMetadata metadata, Object instance, Map<String, Object> updates) {
        for (Map.Entry<String, Object> entry : updates.entrySet()) {
            WireField field = metadata.wireFields().get(entry.getKey());
            if (field == null) {
                // Not a @Wire field: outside the settable allowlist. Drop it.
                continue;
            }
            if (field.locked()) {
                throw new WireException(
                        WireError.LOCKED_PROPERTY,
                        "client update rejected for locked @Wire field");
            }
            field.write(instance, entry.getValue());
        }
    }

    /**
     * Seeds parent-supplied props onto a child's {@code @Wire} fields at mount (ADR-0015). Like
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

    private Map<String, Object> readWire(ComponentMetadata metadata, Object instance) {
        Map<String, Object> wire = new LinkedHashMap<>();
        for (WireField field : metadata.wireFields().values()) {
            if (field.serialize()) {
                wire.put(field.name(), field.read(instance));
            }
        }
        return wire;
    }
}
