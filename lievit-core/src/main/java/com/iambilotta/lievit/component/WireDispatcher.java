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
     * Mounts a fresh component: runs its {@code @LievitMount} hook (if any), then reads the initial
     * {@code @Wire} state for the first snapshot.
     *
     * @param metadata the component metadata
     * @param instance a fresh component instance
     * @return the serialized initial {@code @Wire} state ({@code serialize = true} fields only)
     */
    public Map<String, Object> mount(ComponentMetadata metadata, Object instance) {
        invokeHook(metadata.mount(), instance);
        invokeHook(metadata.render(), instance);
        return readWire(metadata, instance);
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
        LievitEffects effects = new LievitEffects();
        LievitEffects.bind(effects);
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

            invokeHook(metadata.render(), instance);
            return new WireCall(readWire(metadata, instance), effects);
        } finally {
            LievitEffects.clear();
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
