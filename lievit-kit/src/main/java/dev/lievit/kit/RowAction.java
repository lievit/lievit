/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * One per-row action, fully resolved against a record at view-build time (the Filament
 * {@code Table->actions([...])} resolved per record): the data the table chrome stamps for a single
 * row button, with no engine knowledge. It replaces the older pattern where a host injected typed
 * per-row seams into the template; the kit now resolves the row's actions into this generic shape so
 * the render is the same for every adopter.
 *
 * <p>An action is EITHER a navigation ({@link #href()} non-blank, rendered as a real {@code <a href>},
 * so middle-click / open-in-new-tab work) OR a wire dispatch ({@link #wire()} non-blank, rendered as
 * an {@code l:click="<wire>"} with the {@link #wireArgs()} carried as escaped {@code data-*}). When
 * neither is set the action is inert (a disabled button). The {@link #variant()} is the lievit-ui
 * button variant vocabulary ({@code default} / {@code secondary} / {@code destructive} /
 * {@code ghost} / {@code outline}); {@code default} maps to the button partial's {@code primary}.
 *
 * <p>The {@link #disabled()} / {@link #hidden()} predicate results are resolved to booleans at build
 * time (the kit only carries facts, not closures): a hidden action is simply not in the row's list,
 * a disabled one renders a dimmed, non-activatable button.
 *
 * @param label    the human button label (also the accessible name)
 * @param icon     an optional leading Lucide icon name, or {@code null} for none
 * @param href     the navigation URL when this is a link action, or {@code null}/blank for a wire action
 * @param wire     the wire action name when this is a wire dispatch, or {@code null}/blank for a link
 * @param wireArgs the per-row arguments the wire handler reads (escaped {@code data-*}); empty for none
 * @param variant  the button variant ({@code default} / {@code secondary} / {@code destructive} /
 *                 {@code ghost} / {@code outline})
 * @param confirm  an optional confirmation prompt shown before the action fires, or {@code null} for none
 * @param disabled whether the action renders disabled (resolved from the per-record predicate)
 * @param newTab   whether a navigation action opens in a new browser tab
 */
public record RowAction(
        String label,
        @Nullable String icon,
        @Nullable String href,
        @Nullable String wire,
        Map<String, String> wireArgs,
        String variant,
        @Nullable String confirm,
        boolean disabled,
        boolean newTab) {

    /** Compact constructor: never-nulls the label/variant + defends the wire-args map. */
    public RowAction {
        Objects.requireNonNull(label, "label");
        variant = variant == null || variant.isBlank() ? "default" : variant;
        wireArgs = wireArgs == null ? Map.of() : Map.copyOf(wireArgs);
    }

    /**
     * A navigation row action: a real {@code <a href>} to the given URL.
     *
     * @param label the button label
     * @param href  the navigation URL
     * @return the link action ({@code default} variant, same tab, no confirm)
     */
    public static RowAction link(String label, String href) {
        return new RowAction(label, null, href, null, Map.of(), "default", null, false, false);
    }

    /**
     * A wire-dispatch row action: an {@code l:click="<wire>"} carrying the per-row arguments.
     *
     * @param label the button label
     * @param wire  the wire action name
     * @param args  the per-row arguments the wire handler reads (e.g. {@code Map.of("id", row.id())})
     * @return the wire action ({@code default} variant, no confirm)
     */
    public static RowAction wire(String label, String wire, Map<String, String> args) {
        return new RowAction(label, null, null, wire, args, "default", null, false, false);
    }

    /** @return whether this action navigates to a URL (vs. dispatching over the wire) */
    public boolean hasHref() {
        return href != null && !href.isBlank();
    }

    /** @return whether this action dispatches a wire action (vs. navigating) */
    public boolean hasWire() {
        return wire != null && !wire.isBlank();
    }

    /** @return whether this action shows a leading icon */
    public boolean hasIcon() {
        return icon != null && !icon.isBlank();
    }

    /** @return whether this action carries a confirmation prompt */
    public boolean requiresConfirmation() {
        return confirm != null && !confirm.isBlank();
    }

    /**
     * @param newIcon the leading icon name
     * @return a copy with the icon set
     */
    public RowAction withIcon(@Nullable String newIcon) {
        return new RowAction(label, newIcon, href, wire, wireArgs, variant, confirm, disabled, newTab);
    }

    /**
     * @param newVariant the button variant
     * @return a copy with the variant set
     */
    public RowAction withVariant(String newVariant) {
        return new RowAction(label, icon, href, wire, wireArgs, newVariant, confirm, disabled, newTab);
    }

    /**
     * @param prompt the confirmation prompt
     * @return a copy that confirms before firing
     */
    public RowAction withConfirm(@Nullable String prompt) {
        return new RowAction(label, icon, href, wire, wireArgs, variant, prompt, disabled, newTab);
    }

    /**
     * @param value whether the action renders disabled
     * @return a copy with the disabled flag set
     */
    public RowAction withDisabled(boolean value) {
        return new RowAction(label, icon, href, wire, wireArgs, variant, confirm, value, newTab);
    }

    /**
     * @param value whether a navigation opens in a new tab
     * @return a copy with the new-tab flag set
     */
    public RowAction withNewTab(boolean value) {
        return new RowAction(label, icon, href, wire, wireArgs, variant, confirm, disabled, value);
    }
}
