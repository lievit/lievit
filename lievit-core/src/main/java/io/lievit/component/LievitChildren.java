/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * The per-render child sink: the server-side, request-scoped collector of the child components a
 * parent mounts during its render (ADR-0016, nested components). A parent declares a child via
 * {@link #child(String, String, Map)} (or the no-props {@link #child(String, String)}); the wire
 * layer then mounts each declared child as an independent component and substitutes its rendered
 * HTML into the placeholder the parent emitted for that key.
 *
 * <p>This is a runtime API, not an annotation: it gives a parent the Livewire
 * {@code <livewire:child :prop="..." :key="..." />} ergonomics without adding to the annotation
 * surface (ADR-0002). It mirrors {@link LievitEffects}: bound to the current {@link WireDispatcher} render
 * via a {@link ThreadLocal}, reset for every mount / call so nothing survives between stateless
 * requests (the ADR-0001 invariant).
 *
 * <p>Bounded nesting: a child mounts on a fresh {@link WireDispatcher} call, which binds a fresh
 * sink, so a child that itself mounts grandchildren is naturally supported. The mount driver bounds
 * the depth ({@code lievit.max-nesting-depth}, ADR-0013/ADR-0016) so an accidental render cycle
 * cannot recurse without limit.
 *
 * <p>Keys must be unique within one parent render: a duplicate key is the morph-identity bug
 * (two children the client cannot tell apart), so it is a hard error here, not a silent overwrite.
 */
public final class LievitChildren {

    private static final ThreadLocal<LievitChildren> CURRENT = new ThreadLocal<>();

    // Insertion-ordered so the parent's render order is the order children are mounted and the
    // placeholders are substituted; keyed so a duplicate key is caught.
    private final Map<String, ChildComponent> byKey = new LinkedHashMap<>();

    // Positional fallback counter for keyless children when no DeterministicKeyScope is bound (a
    // unit test driving the sink directly): keeps lievit-core buildable without the compiler.
    private int positionalCounter = 0;

    LievitChildren() {}

    /**
     * Returns the child sink for the current render.
     *
     * @return the bound sink
     * @throws IllegalStateException if called outside a wire render (no sink is bound)
     */
    public static LievitChildren current() {
        LievitChildren children = CURRENT.get();
        if (children == null) {
            throw new IllegalStateException(
                    "LievitChildren.current() called outside a wire render: no child sink is bound");
        }
        return children;
    }

    /** Binds {@code children} as the sink for the current thread (called by the dispatcher). */
    static void bind(LievitChildren children) {
        CURRENT.set(children);
    }

    /** Clears the bound sink for the current thread (called by the dispatcher in a finally). */
    static void clear() {
        CURRENT.remove();
    }

    /**
     * Declares a child component to mount inside the current render, with props passed down.
     *
     * @param key the stable child key (the {@code @key} equivalent; unique within this render)
     * @param componentClass the child {@code @LievitComponent} class
     * @param props the props to seed onto the child's {@code @Wire} fields before its mount runs
     * @return the placeholder token the parent template must render where the child belongs; the
     *     wire layer substitutes the child's HTML for it (see {@link #placeholderFor(String)})
     * @throws IllegalStateException if {@code key} was already declared in this render
     */
    public String child(String key, Class<?> componentClass, @Nullable Map<String, Object> props) {
        return child(key, componentClass.getName(), props);
    }

    /**
     * Declares a child by class name (the form the template adapter uses).
     *
     * @param key the stable child key
     * @param className the child {@code @LievitComponent} class name
     * @param props the props to seed onto the child (may be {@code null} or empty)
     * @return the placeholder token to render in the parent's markup
     * @throws IllegalStateException if {@code key} was already declared in this render
     */
    public String child(String key, String className, @Nullable Map<String, Object> props) {
        return child(key, className, props, Map.of());
    }

    /**
     * Declares a child with parent-rendered slot content (issue #91). The {@code slots} map carries
     * the HTML the parent rendered <em>in its own scope</em> for each slot ({@code "default"} for the
     * unnamed slot); the child positions it via the {@link LievitSlots} proxy and the web layer
     * substitutes it into the child markup. The content stays parent-owned (its state and events
     * belong to the parent), so a button in a slot mutates the parent.
     *
     * @param key the stable child key (unique within this render)
     * @param className the child {@code @LievitComponent} class name
     * @param props the props seeded onto the child before mount (may be {@code null}/empty)
     * @param slots the parent-rendered slot content by name (may be empty)
     * @return the placeholder token the parent template renders where the child belongs
     * @throws IllegalStateException if {@code key} was already declared in this render
     */
    public String child(
            String key,
            String className,
            @Nullable Map<String, Object> props,
            @Nullable Map<String, String> slots) {
        return child(key, className, props, slots, Map.of(), Map.of());
    }

    /**
     * Declares a child with parent-declared event listeners (issue #69) and forwarded HTML attributes
     * (issue #71), the form the tag-compiler lowering uses when a {@code <lievit:child>} tag carried
     * {@code @event="handler"} listeners or unmapped HTML attributes. The listeners route a
     * child-emitted event to a parent action; the attributes are the {@code $attributes} bag merged
     * onto the child root. Both ride the child's memo / markers so they survive a re-render.
     *
     * @param key the stable child key (unique within this render)
     * @param className the child {@code @LievitComponent} class name
     * @param props the props seeded onto the child before mount (may be {@code null}/empty)
     * @param slots the parent-rendered slot content by name (may be {@code null}/empty)
     * @param listeners the event-name -&gt; parent-handler map (may be {@code null}/empty)
     * @param attributes the forwarded HTML attribute bag (may be {@code null}/empty)
     * @return the placeholder token the parent template renders where the child belongs
     * @throws IllegalStateException if {@code key} was already declared in this render
     */
    public String child(
            String key,
            String className,
            @Nullable Map<String, Object> props,
            @Nullable Map<String, String> slots,
            @Nullable Map<String, String> listeners,
            @Nullable Map<String, String> attributes) {
        ChildComponent child =
                new ChildComponent(
                        key,
                        className,
                        props == null ? Map.of() : props,
                        slots == null ? Map.of() : slots,
                        listeners == null ? Map.of() : listeners,
                        attributes == null ? Map.of() : attributes);
        if (byKey.putIfAbsent(key, child) != null) {
            throw new IllegalStateException(
                    "duplicate child @key '"
                            + key
                            + "' in one parent render: keys must be unique so the client morph can"
                            + " identify each child across re-renders");
        }
        return placeholderFor(key);
    }

    /**
     * Declares a child with no props.
     *
     * @param key the stable child key
     * @param componentClass the child {@code @LievitComponent} class
     * @return the placeholder token to render in the parent's markup
     */
    public String child(String key, Class<?> componentClass) {
        return child(key, componentClass.getName(), Map.of());
    }

    /**
     * Declares a <strong>keyless</strong> child: the sink generates a stable {@code @key} for this
     * template position (ADR-0023, completing ADR-0016's key contract for the keyless case). When a
     * {@link DeterministicKeyScope} is bound for the current render it supplies the key
     * ({@code lw-<crc32(template)>-<counter>} in production, Livewire {@code DeterministicBladeKeys}
     * parity), so a child in a loop has a morph identity stable across re-renders and distinct
     * between siblings; with no scope bound the sink falls back to a positional key
     * ({@code lievit-child-<n>}), which keeps {@code lievit-core} buildable without the compiler.
     *
     * <p>This is what makes {@code <lievit:row :item="..."/>} (or {@code children.child(Row.class)})
     * inside a list safe: the generated key is the morph anchor, so a re-render reuses the right DOM
     * node instead of bleeding one row's state into another.
     *
     * @param componentClass the child {@code @LievitComponent} class
     * @param props the props to seed onto the child's {@code @Wire} fields before its mount runs
     * @return the placeholder token to render in the parent's markup
     */
    public String child(Class<?> componentClass, @Nullable Map<String, Object> props) {
        return child(nextDeterministicKey(), componentClass.getName(), props);
    }

    /**
     * Declares a keyless child with no props (the deterministic-key path; see
     * {@link #child(Class, Map)}).
     *
     * @param componentClass the child {@code @LievitComponent} class
     * @return the placeholder token to render in the parent's markup
     */
    public String child(Class<?> componentClass) {
        return child(componentClass, Map.of());
    }

    /**
     * Declares a keyless child by class name (the form the tag compiler / template adapter uses; see
     * {@link #child(Class, Map)} for the keyed-vs-keyless rule).
     *
     * @param className the child {@code @LievitComponent} class name
     * @param props the props to seed onto the child (may be {@code null} or empty)
     * @return the placeholder token to render in the parent's markup
     */
    public String childKeyless(String className, @Nullable Map<String, Object> props) {
        return child(nextDeterministicKey(), className, props);
    }

    private String nextDeterministicKey() {
        DeterministicKeyScope scope = DeterministicKeyScope.current();
        if (scope != null) {
            return scope.nextKey();
        }
        return "lievit-child-" + positionalCounter++;
    }

    /**
     * The placeholder token a parent renders for a child key; the wire layer replaces this exact
     * token with the child's mounted HTML. Stable and unguessable-free (it carries only the key, no
     * state), so it is safe to sit in the HTML stream until substitution.
     *
     * @param key the child key
     * @return the placeholder token (e.g. {@code <!--lievit:child:row-7-->})
     */
    public static String placeholderFor(String key) {
        return "<!--lievit:child:" + key + "-->";
    }

    /**
     * @return the declared children in render order (empty when the parent mounted none)
     */
    public List<ChildComponent> declared() {
        return List.copyOf(byKey.values());
    }

    /**
     * @return true if the parent declared no children (so this is a leaf render, no substitution)
     */
    public boolean isEmpty() {
        return byKey.isEmpty();
    }
}
