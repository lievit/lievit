/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.util.List;

import org.jspecify.annotations.Nullable;

import io.lievit.wire.synth.SynthesizerRegistry;

/**
 * The {@link LifecyclePhase#CALL} listener that resolves lievit's framework-provided magic actions
 * (ADR-0030, Livewire {@code SupportMagicActions} parity): {@code $set}, {@code $toggle},
 * {@code $refresh}, {@code $get}, {@code $parent}. Register it on the {@link LifecycleBus} (the
 * starter does this when magic actions are enabled) and the dispatcher hands it every call name.
 *
 * <p>When the call name is magic, the listener performs the server-side mutation (for {@code $set} /
 * {@code $toggle}) and {@link LifecycleContext#requestEarlyReturn() short-circuits} the method
 * dispatch, so the {@code @LievitAction} allowlist never sees the synthetic name (it would be an
 * {@code UNKNOWN_COMPONENT}). A non-magic call name is left untouched: the real action runs.
 *
 * <p>Security: a magic action only ever reads a {@code @Wire} field by name and writes it through
 * {@link SynthesizerRegistry#hydrateForUpdate} — exactly the path a client {@code _updates} entry
 * takes, so the settable allowlist and the locked-field rule hold (a {@code $set} on a locked field
 * is dropped, never throws, mirroring how a non-{@code @Wire} update is dropped, ADR-0013). It can
 * never invoke a method, only mutate a declared bound field.
 */
public final class MagicActionListener implements LifecycleListener {

    private final SynthesizerRegistry synthesizers;

    /**
     * @param synthesizers the typed-state registry used to coerce a {@code $set} value to the field's
     *     declared type (ADR-0020), the same path a {@code wire:model} update takes
     */
    public MagicActionListener(SynthesizerRegistry synthesizers) {
        this.synthesizers = synthesizers;
    }

    @Override
    public @Nullable Runnable before(LifecycleContext ctx) {
        String call = ctx.callName();
        if (call == null) {
            return null;
        }
        MagicAction magic = MagicAction.parse(call);
        if (magic == null) {
            return null;
        }
        // A magic call never reaches a method: short-circuit the dispatch.
        ctx.requestEarlyReturn();
        apply(magic, ctx);
        return null;
    }

    private void apply(MagicAction magic, LifecycleContext ctx) {
        switch (magic.name()) {
            // $refresh / $parent are no server mutation: $refresh just lets the re-render run (the
            // dispatcher always re-renders unless renderless), $parent is resolved client-side. Both
            // simply early-return so they are not rejected as a missing method.
            case MagicAction.REFRESH, MagicAction.PARENT, MagicAction.GET -> {
                // $get is read-only on the server (the value already rides the next snapshot); the
                // client reads it from the proxy. Nothing to mutate.
            }
            case MagicAction.SET -> applySet(magic.args(), ctx);
            case MagicAction.TOGGLE -> applyToggle(magic.args(), ctx);
            default -> {
                // An unknown $-prefixed name: early-returned above so it is not a missing-method
                // error, but there is nothing to do. (A future magic name lands here as a no-op
                // until implemented, never a 500.)
            }
        }
    }

    private void applySet(List<Object> args, LifecycleContext ctx) {
        if (args.isEmpty()) {
            return;
        }
        String property = String.valueOf(args.get(0));
        Object value = args.size() > 1 ? args.get(1) : null;
        WireField field = settableField(ctx, property);
        if (field == null) {
            return;
        }
        field.write(ctx.instance(), synthesizers.hydrateForUpdate(field.type(), value));
    }

    private void applyToggle(List<Object> args, LifecycleContext ctx) {
        if (args.isEmpty()) {
            return;
        }
        String property = String.valueOf(args.get(0));
        WireField field = settableField(ctx, property);
        if (field == null) {
            return;
        }
        Object current = field.read(ctx.instance());
        boolean next = !(current instanceof Boolean b && b);
        field.write(ctx.instance(), next);
    }

    /**
     * Resolves a {@code @Wire} field by name for a magic mutation, applying the settable allowlist:
     * a name that is not a {@code @Wire} field, or names a locked field, returns {@code null} (the
     * mutation is dropped, never an exception), mirroring the client-update rules in ADR-0013.
     */
    private static @Nullable WireField settableField(LifecycleContext ctx, String property) {
        WireField field = ctx.metadata().wireFields().get(property);
        if (field == null || field.locked()) {
            return null;
        }
        return field;
    }
}
