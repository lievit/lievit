/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.Objects;
import java.util.function.Consumer;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.support.EvaluationContext;

/**
 * A schema-embedded action button (the filament-schemas {@code Action} placed inside a form): a
 * named, labelled button that runs a closure over the LIVE form state, for the inline "Generate",
 * "Verify", "Fill from API" buttons that sit next to a field or in a section toolbar.
 *
 * <p>Unlike the resource-level {@link io.lievit.kit.AdminAction} (which gates through the authorizer
 * and writes through a repository), a schema action's body is a closure over the mutable evaluation
 * context, so it reads and writes sibling fields directly: {@code Action.make("generate")
 * .action(ctx -> ctx.set("slug", slugify(ctx.getString("title"))))}. It carries the small
 * presentation surface a button needs and the same value-or-closure visibility/disabling as any
 * schema component is built from, kept self-contained here so it can also serve as a field affix.
 */
public final class SchemaAction {

    /** How a schema action renders. */
    public enum Variant {
        /** A filled button. */
        BUTTON,
        /** A text link. */
        LINK,
        /** An icon-only button. */
        ICON_BUTTON
    }

    private final String name;
    private String label;
    private @Nullable Consumer<EvaluationContext> action;
    private @Nullable String icon;
    private @Nullable String color;
    private Variant variant = Variant.BUTTON;
    private boolean requiresConfirmation;
    private boolean disabled;

    private SchemaAction(String name) {
        this.name = Objects.requireNonNull(name, "name");
        this.label = SchemaField.humanize(name);
    }

    /**
     * @param name the action name (stable id + default label)
     * @return a new schema action
     */
    public static SchemaAction make(String name) {
        return new SchemaAction(name);
    }

    /**
     * Sets the button label (defaults to the humanized name).
     *
     * @param label the button label
     * @return this action
     */
    public SchemaAction label(String label) {
        this.label = Objects.requireNonNull(label, "label");
        return this;
    }

    /**
     * Sets the action body: a closure over the mutable live context, so it can read and write
     * sibling fields.
     *
     * @param action the action body
     * @return this action
     */
    public SchemaAction action(Consumer<EvaluationContext> action) {
        this.action = Objects.requireNonNull(action, "action");
        return this;
    }

    /**
     * Sets the button icon (an icon name/alias resolved by the icon registry).
     *
     * @param icon the icon name/alias
     * @return this action
     */
    public SchemaAction icon(String icon) {
        this.icon = Objects.requireNonNull(icon, "icon");
        return this;
    }

    /**
     * Sets the semantic colour (for example {@code "primary"}, {@code "danger"}).
     *
     * @param color the colour name
     * @return this action
     */
    public SchemaAction color(String color) {
        this.color = Objects.requireNonNull(color, "color");
        return this;
    }

    /**
     * Sets how the action renders.
     *
     * @param variant the render variant
     * @return this action
     */
    public SchemaAction variant(Variant variant) {
        this.variant = Objects.requireNonNull(variant, "variant");
        return this;
    }

    /**
     * Requires a confirmation affordance before the action runs.
     *
     * @return this action
     */
    public SchemaAction requiresConfirmation() {
        this.requiresConfirmation = true;
        return this;
    }

    /**
     * Disables the action (rendered but not invokable).
     *
     * @param disabled whether the action is disabled
     * @return this action
     */
    public SchemaAction disabled(boolean disabled) {
        this.disabled = disabled;
        return this;
    }

    /** @return the stable action name */
    public String name() {
        return name;
    }

    /** @return the button label */
    public String label() {
        return label;
    }

    /** @return the icon name/alias, or {@code null} */
    public @Nullable String icon() {
        return icon;
    }

    /** @return the semantic colour name, or {@code null} for the default */
    public @Nullable String color() {
        return color;
    }

    /** @return the render variant (default {@link Variant#BUTTON}) */
    public Variant variant() {
        return variant;
    }

    /** @return whether the action needs a confirmation before it runs */
    public boolean isRequiringConfirmation() {
        return requiresConfirmation;
    }

    /** @return whether the action is disabled */
    public boolean isDisabled() {
        return disabled;
    }

    /**
     * Runs the action body against the live (mutable) context, so it can read and write sibling
     * fields. A no-op when no body was set or the action is disabled.
     *
     * @param context the live mutable evaluation context
     */
    public void run(EvaluationContext context) {
        Objects.requireNonNull(context, "context");
        if (disabled || action == null) {
            return;
        }
        action.accept(context);
    }
}
