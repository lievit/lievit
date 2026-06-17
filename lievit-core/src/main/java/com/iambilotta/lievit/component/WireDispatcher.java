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

import com.iambilotta.lievit.LievitFormObject;
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
 * state, apply the client {@code _updates}, invoke the {@code _calls} actions in order, read back
 * the new state).
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
 *   <li>form-object fields ({@link LievitFormObject}) hydrate from a nested map in the snapshot
 *       and accept dotted-path updates (e.g., {@code "form.email"}) in {@code _updates} (ADR-0015).
 *       Only fields declared on the form object class are settable; depth is bounded at one level.
 * </ul>
 */
public final class WireDispatcher {

    private final PayloadGuard payloadGuard;

    /** Uses the protocol-default {@link PayloadGuard} (wire-protocol.md §6). */
    public WireDispatcher() {
        this(new PayloadGuard());
    }

    /**
     * @param payloadGuard the structural-cap and deserialization-allowlist guard (ADR-0013)
     */
    public WireDispatcher(PayloadGuard payloadGuard) {
        this.payloadGuard = payloadGuard;
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
     * @param metadata the component metadata
     * @param instance a fresh component instance to rehydrate onto
     * @param snapshotWire the {@code @Wire} state decoded from the verified snapshot
     * @param updates the client-supplied field updates ({@code _updates})
     * @param calls the action names to invoke, in order ({@code _calls})
     * @return the new {@code @Wire} state plus any {@link LievitEffects} the actions produced
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
            for (String call : calls) {
                effects.captureReturn(invokeAction(metadata, instance, call));
            }
            invokeHook(metadata.render(), instance);
            return new WireCall(readWire(metadata, instance), effects);
        } finally {
            LievitEffects.clear();
        }
    }

    /**
     * Rehydrates every {@code @Wire} field present in the verified snapshot state.
     *
     * <p>For form-object fields, the snapshot carries a nested {@link Map}; the dispatcher
     * creates a fresh form object instance and writes each sub-field from that map, then sets
     * the form object instance onto the component (ADR-0015).
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
                field.write(instance, entry.getValue());
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
     *       object. Only one level of nesting is supported (ADR-0015 §Security). A dotted path with
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
            ComponentMetadata metadata, Object instance, Map<String, Object> updates) {
        for (Map.Entry<String, Object> entry : updates.entrySet()) {
            String key = entry.getKey();
            int dot = key.indexOf('.');
            if (dot >= 0) {
                // Dotted path: delegate to the form-object update logic.
                applyFormObjectUpdate(metadata, instance, key, dot, entry.getValue());
            } else {
                applyTopLevelUpdate(metadata, instance, key, entry.getValue());
            }
        }
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
        field.write(instance, value);
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
                wire.put(field.name(), field.read(instance));
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
}
