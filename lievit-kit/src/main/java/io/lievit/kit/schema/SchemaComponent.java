/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Consumer;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.support.EvaluationContext;
import io.lievit.kit.support.EvaluationContext.Operation;
import io.lievit.kit.support.ValueOrClosure;

/**
 * The shared base of every schema component (the filament-schemas v4 unification: forms, infolists,
 * and layout all descend from one {@code Component} with one {@code HasState}). It carries the
 * state-engine behaviors so the concrete fields and layout containers do not each reinvent them:
 *
 * <ul>
 *   <li><strong>state path + casts</strong> ({@link #statePath}, {@link #cast}): where the value
 *       lives in the {@link SchemaState} and how it converts at the boundary.
 *   <li><strong>hydrate / dehydrate lifecycle</strong> ({@link #hydrate}, {@link #dehydrate}): form
 *       data to component on mount, component to persisted data on submit.
 *   <li><strong>default</strong> ({@link #defaultValue}): the value-or-closure used on mount when
 *       the state has none.
 *   <li><strong>conditional visibility / disabling</strong> ({@link #visible}, {@link #disabled},
 *       {@link #visibleOn}/{@link #hiddenOn}): every setter is a value OR a closure over the live
 *       state (the closure-injection engine).
 *   <li><strong>reactivity</strong> ({@link #live}, {@link #afterStateUpdated},
 *       {@link #afterStateHydrated}, {@link #beforeStateDehydrated}): the dependent-field hooks.
 *   <li><strong>dehydration control</strong> ({@link #dehydrated}, {@link #dehydratedWhenHidden}):
 *       whether a value is written at all, and whether a hidden field still persists.
 * </ul>
 *
 * <p>CRTP self-type {@code SELF} keeps the fluent chain typed through the concrete builder.
 *
 * @param <T> the in-memory (hydrated) value type
 * @param <SELF> the concrete component type, for fluent returns
 */
public abstract class SchemaComponent<T extends @Nullable Object, SELF extends SchemaComponent<T, SELF>> {

    private @Nullable String statePath;
    private @Nullable StateCast<T> cast;
    private @Nullable ValueOrClosure<T> defaultValue;

    private ValueOrClosure<Boolean> visible = ValueOrClosure.of(true);
    private ValueOrClosure<Boolean> disabled = ValueOrClosure.of(false);
    private @Nullable Operation visibleOnlyOn;
    private @Nullable Operation hiddenOn;

    private LiveMode live = LiveMode.DEFERRED;
    private final List<BiConsumer<T, EvaluationContext>> afterStateUpdated = new ArrayList<>();
    private final List<Consumer<EvaluationContext>> afterStateHydrated = new ArrayList<>();
    private final List<Consumer<EvaluationContext>> beforeStateDehydrated = new ArrayList<>();

    private boolean dehydrated = true;
    private boolean dehydratedWhenHidden = false;

    private @Nullable BiFunction<T, EvaluationContext, ? extends @Nullable Object> formatState;
    private @Nullable BiFunction<T, EvaluationContext, ? extends @Nullable Object> dehydrateState;

    /** Package-visible: concrete components in this package extend it. */
    protected SchemaComponent() {}

    /**
     * @return {@code this}, typed as the concrete component
     */
    @SuppressWarnings("unchecked")
    protected final SELF self() {
        return (SELF) this;
    }

    // ── state path + casts ──────────────────────────────────────────────────

    /**
     * Sets the dot state path this component binds to.
     *
     * @param statePath the path into the schema state ({@code "country"}, {@code "items.0.qty"})
     * @return this component
     */
    public SELF statePath(String statePath) {
        this.statePath = Objects.requireNonNull(statePath, "statePath");
        return self();
    }

    /**
     * @return the state path, or {@code null} if the component holds no state (a pure layout)
     */
    public @Nullable String statePath() {
        return statePath;
    }

    /**
     * Sets the boundary cast applied on hydrate and dehydrate.
     *
     * @param cast the typed conversion
     * @return this component
     */
    public SELF cast(StateCast<T> cast) {
        this.cast = Objects.requireNonNull(cast, "cast");
        return self();
    }

    /**
     * @return the state cast, or {@code null} if values pass through uncast
     */
    public @Nullable StateCast<T> cast() {
        return cast;
    }

    // ── default ───────────────────────────────────────────────────────────────

    /**
     * Sets a constant default value used on mount when the state has none.
     *
     * @param value the default
     * @return this component
     */
    public SELF defaultValue(T value) {
        this.defaultValue = ValueOrClosure.of(value);
        return self();
    }

    /**
     * Sets a computed default (a closure over the live state) used on mount.
     *
     * @param value the default-producing closure
     * @return this component
     */
    public SELF defaultUsing(java.util.function.Function<EvaluationContext, ? extends T> value) {
        this.defaultValue = ValueOrClosure.ofClosure(value);
        return self();
    }

    // ── visibility / disabling ─────────────────────────────────────────────────

    /**
     * Sets a constant visibility.
     *
     * @param visible whether the component renders (and dehydrates)
     * @return this component
     */
    public SELF visible(boolean visible) {
        this.visible = ValueOrClosure.of(visible);
        return self();
    }

    /**
     * Sets a reactive visibility (a closure over the live state).
     *
     * @param visible the visibility-producing closure
     * @return this component
     */
    public SELF visible(java.util.function.Function<EvaluationContext, Boolean> visible) {
        this.visible = ValueOrClosure.ofClosure(visible);
        return self();
    }

    /**
     * Sets a constant hidden flag (the inverse of {@link #visible(boolean)}).
     *
     * @param hidden whether the component is hidden
     * @return this component
     */
    public SELF hidden(boolean hidden) {
        return visible(!hidden);
    }

    /**
     * Sets a reactive hidden flag (the inverse of the visibility closure).
     *
     * @param hidden the hidden-producing closure
     * @return this component
     */
    public SELF hidden(java.util.function.Function<EvaluationContext, Boolean> hidden) {
        this.visible = ValueOrClosure.ofClosure(ctx -> !Boolean.TRUE.equals(hidden.apply(ctx)));
        return self();
    }

    /**
     * Shows the component only under the given operation (the {@code visibleOn} of Filament).
     *
     * @param operation the only operation under which it is visible
     * @return this component
     */
    public SELF visibleOn(Operation operation) {
        this.visibleOnlyOn = Objects.requireNonNull(operation, "operation");
        return self();
    }

    /**
     * Hides the component under the given operation (the {@code hiddenOn} of Filament).
     *
     * @param operation the operation under which it is hidden
     * @return this component
     */
    public SELF hiddenOn(Operation operation) {
        this.hiddenOn = Objects.requireNonNull(operation, "operation");
        return self();
    }

    /**
     * Resolves whether the component is visible against the live context: the visibility closure
     * AND the operation gates ({@code visibleOn} / {@code hiddenOn}).
     *
     * @param context the live evaluation context
     * @return {@code true} if the component renders
     */
    public boolean isVisible(EvaluationContext context) {
        if (visibleOnlyOn != null && context.operation() != visibleOnlyOn) {
            return false;
        }
        if (hiddenOn != null && context.operation() == hiddenOn) {
            return false;
        }
        return Boolean.TRUE.equals(visible.evaluateOr(context, true));
    }

    /**
     * Sets a constant disabled flag.
     *
     * @param disabled whether the field is disabled
     * @return this component
     */
    public SELF disabled(boolean disabled) {
        this.disabled = ValueOrClosure.of(disabled);
        return self();
    }

    /**
     * Sets a reactive disabled flag (a closure over the live state).
     *
     * @param disabled the disabled-producing closure
     * @return this component
     */
    public SELF disabled(java.util.function.Function<EvaluationContext, Boolean> disabled) {
        this.disabled = ValueOrClosure.ofClosure(disabled);
        return self();
    }

    /**
     * Resolves whether the field is disabled against the live context.
     *
     * @param context the live evaluation context
     * @return {@code true} if the field is disabled
     */
    public boolean isDisabled(EvaluationContext context) {
        return Boolean.TRUE.equals(disabled.evaluateOr(context, false));
    }

    // ── reactivity ──────────────────────────────────────────────────────────

    /**
     * Sets the live binding mode (when a change triggers a round-trip).
     *
     * @param mode the live mode
     * @return this component
     */
    public SELF live(LiveMode mode) {
        this.live = Objects.requireNonNull(mode, "mode");
        return self();
    }

    /**
     * Convenience for {@code live(LiveMode.live())}.
     *
     * @return this component, fully live
     */
    public SELF live() {
        return live(LiveMode.live());
    }

    /**
     * @return the live binding mode
     */
    public LiveMode liveMode() {
        return live;
    }

    /**
     * Registers a hook that fires after this component's state changes; it receives the new value
     * and a (mutable) context so it can read and write sibling fields.
     *
     * @param hook the after-update hook
     * @return this component
     */
    public SELF afterStateUpdated(BiConsumer<T, EvaluationContext> hook) {
        afterStateUpdated.add(Objects.requireNonNull(hook, "hook"));
        return self();
    }

    /**
     * Registers a hook that fires after the component hydrates on mount.
     *
     * @param hook the after-hydrate hook
     * @return this component
     */
    public SELF afterStateHydrated(Consumer<EvaluationContext> hook) {
        afterStateHydrated.add(Objects.requireNonNull(hook, "hook"));
        return self();
    }

    /**
     * Registers a last-chance hook that fires before the value is dehydrated for persist.
     *
     * @param hook the before-dehydrate hook
     * @return this component
     */
    public SELF beforeStateDehydrated(Consumer<EvaluationContext> hook) {
        beforeStateDehydrated.add(Objects.requireNonNull(hook, "hook"));
        return self();
    }

    /**
     * Fires every registered {@code afterStateUpdated} hook (called by the engine when this
     * component's live value changed).
     *
     * @param newValue the new hydrated value
     * @param context the mutable context the hooks read and write through
     */
    public void fireAfterStateUpdated(T newValue, EvaluationContext context) {
        for (BiConsumer<T, EvaluationContext> hook : afterStateUpdated) {
            hook.accept(newValue, context);
        }
    }

    /**
     * Fires every registered {@code afterStateHydrated} hook.
     *
     * @param context the live context
     */
    public void fireAfterStateHydrated(EvaluationContext context) {
        afterStateHydrated.forEach(h -> h.accept(context));
    }

    /**
     * Fires every registered {@code beforeStateDehydrated} hook.
     *
     * @param context the mutable context the hooks may normalize through
     */
    public void fireBeforeStateDehydrated(EvaluationContext context) {
        beforeStateDehydrated.forEach(h -> h.accept(context));
    }

    // ── dehydration control ───────────────────────────────────────────────────

    /**
     * Sets whether this component's value is written to the persisted data at all.
     *
     * @param dehydrated {@code false} to omit the value from persisted data (a display-only field)
     * @return this component
     */
    public SELF dehydrated(boolean dehydrated) {
        this.dehydrated = dehydrated;
        return self();
    }

    /**
     * Sets whether a hidden component still persists its value.
     *
     * @param dehydratedWhenHidden {@code true} to persist even when hidden
     * @return this component
     */
    public SELF dehydratedWhenHidden(boolean dehydratedWhenHidden) {
        this.dehydratedWhenHidden = dehydratedWhenHidden;
        return self();
    }

    /**
     * Resolves whether this component contributes a value to the persisted data, given visibility.
     *
     * @param context the live context
     * @return {@code true} if the value is written to the persisted data
     */
    public boolean isDehydrated(EvaluationContext context) {
        if (!dehydrated || statePath == null) {
            return false;
        }
        if (!isVisible(context)) {
            return dehydratedWhenHidden;
        }
        return true;
    }

    // ── state transforms (filament formatStateUsing / dehydrateStateUsing) ──────

    /**
     * Sets a transform applied to the hydrated value for DISPLAY only (the filament
     * {@code formatStateUsing}): the closure receives the typed value and the live context and
     * returns what the field shows. It never changes what persists ({@link #dehydrate} reads the
     * raw value), so it is the display-side twin of {@link #dehydrateStateUsing}.
     *
     * @param format the display transform (value, context) to the shown representation
     * @return this component
     */
    public SELF formatStateUsing(
            BiFunction<T, EvaluationContext, ? extends @Nullable Object> format) {
        this.formatState = Objects.requireNonNull(format, "format");
        return self();
    }

    /**
     * Resolves the value shown for this component: the raw value transformed by
     * {@link #formatStateUsing} when one is set, otherwise the raw value unchanged.
     *
     * @param state the live schema state
     * @param context the live evaluation context
     * @return the display representation (may differ from the persisted value)
     */
    public @Nullable Object formattedState(SchemaState state, EvaluationContext context) {
        @Nullable T value = read(state);
        if (formatState == null) {
            return value;
        }
        return formatState.apply(value, context);
    }

    /**
     * @return {@code true} if a display transform is set
     */
    public boolean hasFormatState() {
        return formatState != null;
    }

    /**
     * Sets a transform applied to the value just before it persists (the filament
     * {@code dehydrateStateUsing}): the closure receives the typed value and the live context and
     * returns the raw value written to the persisted data. Unlike {@link #formatStateUsing} this
     * DOES change what persists; it runs after the cast's {@code dehydrate}, so the closure sees the
     * already-raw form (for example trimming a string, or stamping a normalized value).
     *
     * @param dehydrate the persist transform (value, context) to the stored representation
     * @return this component
     */
    public SELF dehydrateStateUsing(
            BiFunction<T, EvaluationContext, ? extends @Nullable Object> dehydrate) {
        this.dehydrateState = Objects.requireNonNull(dehydrate, "dehydrate");
        return self();
    }

    /**
     * @return {@code true} if a persist transform is set
     */
    public boolean hasDehydrateState() {
        return dehydrateState != null;
    }

    // ── lifecycle ──────────────────────────────────────────────────────────────

    /**
     * Hydrates this component's value FROM the schema state on mount: applies the default when the
     * state has none, runs the cast, then fires the {@code afterStateHydrated} hooks.
     *
     * @param state the live schema state
     * @param context the live context (carries the operation and record)
     */
    @SuppressWarnings("unchecked")
    public void hydrate(SchemaState state, EvaluationContext context) {
        if (statePath == null) {
            fireAfterStateHydrated(context);
            return;
        }
        @Nullable Object raw = state.get(statePath);
        if (raw == null && defaultValue != null) {
            @Nullable T def = defaultValue.evaluate(context);
            raw = cast != null ? cast.dehydrate(def) : def;
            state.set(statePath, raw);
        }
        fireAfterStateHydrated(context);
    }

    /**
     * Reads this component's hydrated (typed) value out of the schema state.
     *
     * @param state the live schema state
     * @return the typed value (cast applied), or {@code null}
     */
    @SuppressWarnings("unchecked")
    public @Nullable T read(SchemaState state) {
        if (statePath == null) {
            return null;
        }
        @Nullable Object raw = state.get(statePath);
        return cast != null ? cast.hydrate(raw) : (T) raw;
    }

    /**
     * Dehydrates this component's value INTO a persist-ready raw form, honoring visibility and the
     * dehydration flags. Fires the {@code beforeStateDehydrated} hooks first.
     *
     * @param state the live schema state
     * @param context the live context
     * @param sink receives {@code (path, rawValue)} for each value that should persist
     */
    public void dehydrate(SchemaState state, EvaluationContext context, BiConsumer<String, @Nullable Object> sink) {
        if (statePath == null) {
            return;
        }
        fireBeforeStateDehydrated(context);
        if (!isDehydrated(context)) {
            return;
        }
        @Nullable T value = read(state);
        @Nullable Object raw = cast != null ? cast.dehydrate(value) : value;
        if (dehydrateState != null) {
            // The persist transform sees the already-raw form and replaces what is written.
            raw = dehydrateState.apply(value, context);
        }
        sink.accept(statePath, raw);
    }
}
