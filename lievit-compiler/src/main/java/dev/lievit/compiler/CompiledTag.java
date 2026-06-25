/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler;

import java.util.Map;
import java.util.Optional;

/**
 * The parsed form of a {@code <lievit:...>} tag (ADR-0023, issue #175): a declarative mount
 * description the render layer turns into a {@link dev.lievit.component.LievitChildren} child call. It
 * is the output of {@link LievitTagCompiler}: a pure data record, no mounting, no expression
 * evaluation, no HTML emission, so the compile layer stays out of the dispatcher.
 *
 * <p>Attributes split two ways (Livewire {@code LivewireTagPrecompiler} parity):
 *
 * <ul>
 *   <li><strong>literal</strong> ({@code label="Name"}) — the value is text, passed down as-is;
 *   <li><strong>bound</strong> ({@code :user-id="u.id"}) — the value is an expression the render
 *       layer evaluates against the parent model; the name is kebab-&gt;camel'd to the child's
 *       {@code @Wire} field name.
 * </ul>
 *
 * <p>Reserved params ({@code lazy}, {@code defer}, {@code wire:ref}/{@code l:ref}) and the explicit
 * key ({@code wire:key}/{@code l:key}/{@code key}) are pulled out of the props so they never leak
 * into the child's seeded fields. The dynamic-component form ({@code :is="expr"}) and the
 * {@code <lievit:styles>}/{@code <lievit:scripts>} asset shortcuts are flagged distinctly.
 *
 * @param componentName the kebab tag segment after {@code lievit:} (the component to mount, or the
 *     asset-directive name for the shortcut tags)
 * @param literalAttributes literal text attributes (keys kebab-&gt;camel'd), the down-leg props
 * @param boundAttributes bound expression attributes (keys kebab-&gt;camel'd) to evaluate against
 *     the parent model
 * @param explicitKey the author-supplied {@code wire:key}/{@code l:key}/{@code key}, if any; when
 *     empty the render layer generates a {@link DeterministicKeys} key
 * @param ref the {@code wire:ref}/{@code l:ref} reference name, if any
 * @param lazy whether the {@code lazy} reserved param was present (deferred mount + placeholder)
 * @param defer whether the {@code defer} reserved param was present
 * @param closing whether this is a closing tag ({@code </lievit:foo>}, the slot-end marker)
 * @param selfClosing whether this is a self-closing tag ({@code <lievit:foo .../>})
 * @param dynamic whether this is the dynamic-component form ({@code :is="expr"})
 * @param isExpression the {@code :is} expression when {@link #dynamic}, else empty
 * @param assetDirective the asset-directive kind for {@code <lievit:styles>}/{@code <lievit:scripts>},
 *     else empty
 * @param eventListeners the {@code @event-name="handler"} listeners the parent declared on the child
 *     tag (issue #69, Livewire {@code SupportNestedComponentListeners} parity): a map from the
 *     child-emitted event name (kebab, as authored) to the parent action that handles it. The render
 *     layer persists these in the child's memo and the client routes the bubbled child event to the
 *     parent handler. Empty when the tag declares no listeners.
 */
public record CompiledTag(
        String componentName,
        Map<String, String> literalAttributes,
        Map<String, String> boundAttributes,
        Optional<String> explicitKey,
        Optional<String> ref,
        boolean lazy,
        boolean defer,
        boolean closing,
        boolean selfClosing,
        boolean dynamic,
        Optional<String> isExpression,
        Optional<CompiledTag.AssetKind> assetDirective,
        Map<String, String> eventListeners) {

    /** The asset-directive kinds the shortcut tags map to (the runtime-bundle injection points). */
    public enum AssetKind {
        /** {@code <lievit:styles>} — the runtime stylesheet injection point. */
        STYLES,
        /** {@code <lievit:scripts>} — the runtime script injection point. */
        SCRIPTS
    }

    public CompiledTag {
        literalAttributes = Map.copyOf(literalAttributes);
        boundAttributes = Map.copyOf(boundAttributes);
        eventListeners = eventListeners == null ? Map.of() : Map.copyOf(eventListeners);
    }

    /**
     * @return true when this tag mounts a component (not an asset shortcut, not a closing tag)
     */
    public boolean mountsComponent() {
        return assetDirective.isEmpty() && !closing;
    }
}
