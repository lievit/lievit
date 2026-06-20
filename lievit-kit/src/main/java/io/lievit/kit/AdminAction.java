/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * A first-class admin action (the filament-internals.md "Action as a first-class object"): a named,
 * labelled operation a page or row triggers, which runs server-side and emits its outcome on the
 * lievit {@link io.lievit.component.LievitEffects effects substrate} (a flash
 * notification + a redirect).
 *
 * <p>Every action gates itself through the {@link AdminAuthorizer} before it touches the repository
 * (the boundary-not-the-view lesson), and reports its outcome as an {@link AdminActionResult} so the
 * page component can branch without exceptions. v0.1 ships the three built-ins:
 * {@link CreateAction}, {@link EditAction}, {@link DeleteAction}.
 *
 * <p>Confirmation for a destructive action is, in v0.1, a simple server-confirmed flag
 * ({@link #requiresConfirmation()}): the page renders a confirm affordance and only calls the action
 * once confirmed. A Lit modal confirmation is deferred to the nested-component wave; this flag is the
 * data the page needs either way.
 *
 * @param <T> the resource row type the action operates on
 */
public abstract class AdminAction<T> {

    private final String name;
    private final String label;
    private final AdminOperation operation;

    private @org.jspecify.annotations.Nullable String icon;
    private @org.jspecify.annotations.Nullable String color;
    private Size size = Size.MEDIUM;
    private ActionVariant variant = ActionVariant.BUTTON;
    private @org.jspecify.annotations.Nullable String tooltip;
    private @org.jspecify.annotations.Nullable String badge;
    private boolean outlined;
    private boolean disabled;
    private java.util.function.Predicate<@org.jspecify.annotations.Nullable Object> hidden = r -> false;
    private @Nullable Function<@Nullable Object, @Nullable String> url;
    private boolean urlNewTab;

    /**
     * @param name the action name (stable id, the {@code @LievitAction}-side handle the page wires)
     * @param label the human label shown on the button
     * @param operation the CRUD operation this action performs (the authorizer gate)
     */
    protected AdminAction(String name, String label, AdminOperation operation) {
        this.name = Objects.requireNonNull(name, "name");
        this.label = Objects.requireNonNull(label, "label");
        this.operation = Objects.requireNonNull(operation, "operation");
    }

    /** @return the stable action name */
    public final String name() {
        return name;
    }

    /** @return the human button label */
    public final String label() {
        return label;
    }

    /** @return the CRUD operation this action performs */
    public final AdminOperation operation() {
        return operation;
    }

    // --- presentation surface (Filament Action: icon/color/size/variant/tooltip/badge/...) ---

    /**
     * Sets the action's icon name (resolved against the host's icon vocabulary).
     *
     * @param iconName the icon name
     * @return this action
     */
    public AdminAction<T> icon(String iconName) {
        this.icon = Objects.requireNonNull(iconName, "iconName");
        return this;
    }

    /**
     * Sets the action's semantic colour (e.g. {@code "primary"}, {@code "danger"}).
     *
     * @param colorName the colour name
     * @return this action
     */
    public AdminAction<T> color(String colorName) {
        this.color = Objects.requireNonNull(colorName, "colorName");
        return this;
    }

    /**
     * Sets the action's size.
     *
     * @param s the size
     * @return this action
     */
    public AdminAction<T> size(Size s) {
        this.size = Objects.requireNonNull(s, "s");
        return this;
    }

    /**
     * Sets how the action renders (button / link / icon-button / badge).
     *
     * @param v the variant
     * @return this action
     */
    public AdminAction<T> variant(ActionVariant v) {
        this.variant = Objects.requireNonNull(v, "v");
        return this;
    }

    /**
     * Sets a hover tooltip.
     *
     * @param text the tooltip text
     * @return this action
     */
    public AdminAction<T> tooltip(String text) {
        this.tooltip = Objects.requireNonNull(text, "text");
        return this;
    }

    /**
     * Sets a badge value shown on the action.
     *
     * @param value the badge value
     * @return this action
     */
    public AdminAction<T> badge(String value) {
        this.badge = Objects.requireNonNull(value, "value");
        return this;
    }

    /**
     * Renders the button outlined rather than filled.
     *
     * @return this action
     */
    public AdminAction<T> outlined() {
        this.outlined = true;
        return this;
    }

    /**
     * Disables the action (rendered but not invokable).
     *
     * @param value whether the action is disabled
     * @return this action
     */
    public AdminAction<T> disabled(boolean value) {
        this.disabled = value;
        return this;
    }

    /**
     * Hides the action when the predicate matches the host record (or {@code null} for a
     * resource-scoped action). Goes beyond the binary authorizer result: a per-record visibility
     * gate.
     *
     * @param predicate matches a record to hide the action for it
     * @return this action
     */
    public AdminAction<T> hidden(java.util.function.Predicate<@org.jspecify.annotations.Nullable Object> predicate) {
        this.hidden = Objects.requireNonNull(predicate, "predicate");
        return this;
    }

    /** @return the icon name, or {@code null} if none */
    public @org.jspecify.annotations.Nullable String icon() {
        return icon;
    }

    /** @return the semantic colour name, or the default for this action's kind */
    public @org.jspecify.annotations.Nullable String color() {
        return color != null ? color : defaultColor();
    }

    /** @return the action size */
    public Size size() {
        return size;
    }

    /** @return the render variant */
    public ActionVariant variant() {
        return variant;
    }

    /** @return the tooltip text, or {@code null} */
    public @org.jspecify.annotations.Nullable String tooltip() {
        return tooltip;
    }

    /** @return the badge value, or {@code null} */
    public @org.jspecify.annotations.Nullable String badge() {
        return badge;
    }

    /** @return whether the button is rendered outlined */
    public boolean isOutlined() {
        return outlined;
    }

    /** @return whether the action is disabled */
    public boolean isDisabled() {
        return disabled;
    }

    /**
     * @param record the host record (or {@code null} for a resource-scoped action)
     * @return whether the action is hidden for that record
     */
    public boolean isHiddenFor(@org.jspecify.annotations.Nullable Object record) {
        return hidden.test(record);
    }

    // --- URL navigation (Filament Action::url(): the action is a quick "open X" link) ---

    /**
     * Makes this action a <strong>URL navigation</strong> (the Filament {@code Action::url()}):
     * instead of mutating the domain, running it navigates the host to the URL the mapper derives
     * from the action's record (open a detail page, the calendar on a date, an external link). The
     * mapper receives the resolved record (or {@code null} for a resource/header-scoped action) and
     * returns the target URL. Authorization still runs first; the outcome is
     * {@link AdminActionResult#navigate(String)}.
     *
     * @param mapper maps the (nullable) record to the navigation URL
     * @return this action
     */
    public AdminAction<T> url(Function<@Nullable Object, @Nullable String> mapper) {
        this.url = Objects.requireNonNull(mapper, "mapper");
        return this;
    }

    /**
     * Makes this action navigate to a static URL (the record-independent Filament {@code Action::url()}):
     * a header "Export"/"Open calendar" toolbar button, or a row action whose target ignores the row.
     *
     * @param staticUrl the navigation URL (must be non-blank)
     * @return this action
     */
    public AdminAction<T> url(String staticUrl) {
        Objects.requireNonNull(staticUrl, "staticUrl");
        if (staticUrl.isBlank()) {
            throw new IllegalArgumentException("staticUrl must be non-blank");
        }
        return url(record -> staticUrl);
    }

    /**
     * Opens this action's URL navigation in a new browser tab (the Filament
     * {@code Action::url($url, shouldOpenInNewTab: true)}). Only meaningful together with
     * {@link #url(java.util.function.Function) a url}.
     *
     * @return this action
     */
    public AdminAction<T> openUrlInNewTab() {
        this.urlNewTab = true;
        return this;
    }

    /** @return whether this action navigates to a URL (a url mapper was declared) */
    public boolean isUrlNavigation() {
        return url != null;
    }

    /** @return whether this action's URL navigation opens in a new tab */
    public boolean opensUrlInNewTab() {
        return urlNewTab;
    }

    /**
     * The navigation URL this action targets for a record, when it carries a {@link #url url mapper}
     * that yields a non-blank URL.
     *
     * @param record the resolved record (or {@code null} for a resource/header-scoped action)
     * @return the navigation URL, or empty if this action is not a URL navigation (or the mapper
     *     yields null/blank)
     */
    public Optional<String> urlFor(@Nullable Object record) {
        if (url == null) {
            return Optional.empty();
        }
        @Nullable String href = url.apply(record);
        return href == null || href.isBlank() ? Optional.empty() : Optional.of(href);
    }

    /**
     * The default semantic colour for this action's kind, used when none is set. The base default
     * is {@code null} (the host's neutral); destructive actions and built-ins override.
     *
     * @return the default colour name, or {@code null}
     */
    protected @org.jspecify.annotations.Nullable String defaultColor() {
        return isDestructive() ? "danger" : null;
    }

    // --- confirmation modal config (Filament CanRequireConfirmation) ---

    /**
     * @return the confirmation modal config (heading / description / submit label / icon), used when
     *     {@link #requiresConfirmation()} is true; defaults are Filament's confirmation defaults
     */
    public ConfirmationModal confirmationModal() {
        return new ConfirmationModal(
                "Are you sure?",
                isDestructive() ? "This cannot be undone." : null,
                "Confirm",
                "Cancel",
                "heroicon-o-exclamation-triangle");
    }

    /**
     * @return whether the page must confirm with the user before invoking this action (defaults to
     *     {@code false}; a destructive action like {@link DeleteAction} overrides to {@code true})
     */
    public boolean requiresConfirmation() {
        return false;
    }

    /**
     * @return whether this action is destructive (styling + the confirmation default); defaults to
     *     {@code false}
     */
    public boolean isDestructive() {
        return false;
    }

    /**
     * Runs the action: checks authorization, then either navigates (a {@link #url url}-bearing
     * action, the Filament {@code Action::url()}) or performs the operation and emits its effects
     * (flash + redirect) onto the context's effects sink.
     *
     * <p>A URL navigation short-circuits {@link #perform}: once authorized, it queues the redirect
     * effect onto the sink and returns {@link AdminActionResult#navigate}. The mapper is fed the
     * authorized record (already resolved for the gate), so a row "open detail" action reaches the
     * row's URL without a second lookup.
     *
     * @param context the per-invocation context (resource, routes, authorizer, effects, inputs)
     * @return the outcome (navigate / completed / invalid / forbidden)
     */
    public final AdminActionResult run(AdminActionContext<T> context) {
        Objects.requireNonNull(context, "context");
        Object record = authorizationRecord(context);
        if (!context.authorizer().isAllowed(operation, context.resource(), record)) {
            return AdminActionResult.forbidden();
        }
        if (isUrlNavigation()) {
            return urlFor(record)
                    .map(
                            href -> {
                                context.effects().redirect(href);
                                return AdminActionResult.navigate(href, urlNewTab);
                            })
                    .orElseGet(() -> AdminActionResult.completed(null));
        }
        return perform(context);
    }

    /**
     * The record handed to the authorizer for a row-scoped operation, or {@code null} for a
     * resource-scoped one. The default is {@code null} (resource-scoped); {@link EditAction} and
     * {@link DeleteAction} resolve the targeted record.
     *
     * @param context the invocation context
     * @return the record to authorize against, or {@code null}
     */
    protected Object authorizationRecord(AdminActionContext<T> context) {
        return context.recordId() == null
                ? null
                : context.repository().findById(context.recordId()).orElse(null);
    }

    /**
     * Performs the operation after authorization has passed; concrete actions implement the write
     * and the effects.
     *
     * @param context the invocation context
     * @return the outcome
     */
    protected abstract AdminActionResult perform(AdminActionContext<T> context);
}
