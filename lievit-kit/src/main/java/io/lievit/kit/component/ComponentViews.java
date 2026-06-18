/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.component;

import io.lievit.kit.AdminAction;
import io.lievit.kit.AdminNotification;
import io.lievit.kit.ModalConfig;
import io.lievit.kit.support.ColorManager;
import io.lievit.kit.support.Size;
import io.lievit.kit.support.Width;

/**
 * Renders the kit's own surfaces through the design-system component view-models (the issue #317
 * dogfood): an {@link AdminAction} becomes the {@link ButtonView} / {@link LinkView} / {@link
 * IconButtonView} / {@link BadgeView} its variant calls for, an {@link AdminNotification} becomes a
 * colored {@link BadgeView}, and a {@link ModalConfig} becomes a {@link ModalView} shell. Proving the
 * kit's actions and notifications resolve their markup through the shared component layer is what
 * keeps the layer honest: if the views could not express the kit's own needs, an adopter's wouldn't
 * either.
 */
public final class ComponentViews {

    private ComponentViews() {}

    /**
     * Renders an action through the component view its variant calls for, carrying the action's
     * label, resolved color, size and icon.
     *
     * @param action the action to render
     * @return the matching view-model (a {@link ButtonView}, {@link LinkView}, {@link
     *     IconButtonView}, or {@link BadgeView})
     */
    public static Object forAction(AdminAction<?> action) {
        String color = action.color() != null ? action.color() : ColorManager.DEFAULT;
        String icon = action.icon();
        Size size = Size.valueOf(action.size().name());
        return switch (action.variant()) {
            case BUTTON -> {
                ButtonView v = ButtonView.make(action.label()).color(color).size(size);
                if (icon != null) {
                    v.icon(icon);
                }
                if (action.isOutlined()) {
                    v.outlined();
                }
                yield v;
            }
            case LINK -> {
                LinkView v = LinkView.make(action.label(), "#").color(color);
                if (icon != null) {
                    v.icon(icon);
                }
                yield v;
            }
            case ICON_BUTTON ->
                    IconButtonView.make(action.label(), icon != null ? icon : "field.x")
                            .color(color)
                            .size(size);
            case BADGE -> {
                BadgeView v = BadgeView.make(action.label()).color(color);
                if (icon != null) {
                    v.icon(icon);
                }
                yield v;
            }
        };
    }

    /**
     * Renders a notification as a colored badge view: the notification's explicit color if set, else
     * the color its severity level maps to.
     *
     * @param notification the notification to render
     * @return a badge view carrying the notification's title and color
     */
    public static BadgeView forNotification(AdminNotification notification) {
        String color =
                notification.color() != null ? notification.color() : levelColor(notification.level());
        return BadgeView.make(notification.title()).color(color).icon(notification.icon());
    }

    /**
     * Bridges an action's {@link ModalConfig} to the {@link ModalView} shell, mapping the width token
     * and carrying the close affordances.
     *
     * @param config the action modal config
     * @return the modal shell view
     */
    public static ModalView forModalConfig(ModalConfig config) {
        ModalView view = ModalView.make(config.heading() != null ? config.heading() : "");
        view.width(widthFromToken(config.width()));
        view.closeByClickingAway(config.closeByClickingAway());
        view.closeByEscaping(config.closeByEscaping());
        return view;
    }

    private static String levelColor(AdminNotification.Level level) {
        return switch (level) {
            case SUCCESS -> "success";
            case INFO -> "info";
            case WARNING -> "warning";
            case DANGER -> "danger";
        };
    }

    private static Width widthFromToken(String token) {
        for (Width w : Width.values()) {
            if (w.token().equals(token)) {
                return w;
            }
        }
        return Width.MEDIUM;
    }
}
