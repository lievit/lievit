/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.component;

import static org.assertj.core.api.Assertions.assertThat;

import io.lievit.kit.AdminAction;
import io.lievit.kit.AdminNotification;
import io.lievit.kit.ViewAction;
import io.lievit.kit.support.ColorManager;
import io.lievit.kit.support.IconManager;
import io.lievit.kit.support.Size;
import org.junit.jupiter.api.Test;

/**
 * Specifies the design-system component view-models (the kit-level seam for issue #317): the shared
 * rendering layer every action / notification / widget resolves its button / badge / link /
 * icon-button / dropdown / modal / section markup through, instead of each surface re-deriving the
 * same color + icon + size classes. The view-model resolves the CSS classes a JTE partial emits; it
 * is unit-testable without a servlet.
 */
class ComponentViewTest {

    private final ColorManager colors = new ColorManager();
    private final IconManager icons = new IconManager();

    /**
     * @spec.given a colored button view with a size and an icon alias
     * @spec.when  its classes and resolved icon are read
     * @spec.then  it carries the color class, the size class, and the resolved icon name
     */
    @Test
    void a_colored_button_resolves_its_classes() {
        ButtonView button =
                ButtonView.make("Save")
                        .color("primary")
                        .size(Size.LARGE)
                        .icon("actions.create");

        assertThat(button.cssClasses(colors)).contains("lievit-btn", "lievit-btn-primary", "lievit-btn-lg");
        assertThat(button.resolvedIcon(icons)).contains("heroicon-o-plus");
        assertThat(button.label()).isEqualTo("Save");
    }

    /**
     * @spec.given a badge view with a danger color
     * @spec.when  its classes are read
     * @spec.then  it carries the badge base class and the danger color class
     */
    @Test
    void a_colored_badge_resolves_its_classes() {
        BadgeView badge = BadgeView.make("Overdue").color("danger");

        assertThat(badge.cssClasses(colors)).contains("lievit-badge", "lievit-badge-danger");
    }

    /**
     * @spec.given an unknown color name
     * @spec.when  the classes are resolved
     * @spec.then  it falls back to the default color so nothing renders unstyled
     */
    @Test
    void an_unknown_color_falls_back_to_the_default() {
        ButtonView button = ButtonView.make("X").color("chartreuse");

        assertThat(button.cssClasses(colors)).contains("lievit-btn-" + ColorManager.DEFAULT);
    }

    /**
     * @spec.given a modal view configured to disable close-on-click-away and close-button
     * @spec.when  its flags are read
     * @spec.then  it honors close-button / close-by-clicking-away / escaping / autofocus
     */
    @Test
    void a_modal_honors_its_close_flags() {
        ModalView modal =
                ModalView.make("Confirm")
                        .closeButton(false)
                        .closeByClickingAway(false)
                        .closeByEscaping(true)
                        .autofocus(true);

        assertThat(modal.hasCloseButton()).isFalse();
        assertThat(modal.closesByClickingAway()).isFalse();
        assertThat(modal.closesByEscaping()).isTrue();
        assertThat(modal.autofocuses()).isTrue();
        assertThat(modal.heading()).isEqualTo("Confirm");
    }

    /**
     * @spec.given a dropdown view with two items, one a header
     * @spec.when  its items are read
     * @spec.then  the items preserve order and the header item is marked
     */
    @Test
    void a_dropdown_carries_its_items() {
        DropdownView dropdown =
                DropdownView.make()
                        .header("Account")
                        .item(DropdownView.Item.of("Profile", "/profile"))
                        .item(DropdownView.Item.of("Logout", "/logout"));

        assertThat(dropdown.header()).isEqualTo("Account");
        assertThat(dropdown.items())
                .extracting(DropdownView.Item::label)
                .containsExactly("Profile", "Logout");
    }

    /**
     * @spec.given a section view with a heading and a collapsed flag
     * @spec.when  it is read
     * @spec.then  it carries the heading and the collapsed state
     */
    @Test
    void a_section_carries_its_heading_and_state() {
        SectionView section = SectionView.make("Details").collapsed(true);

        assertThat(section.heading()).isEqualTo("Details");
        assertThat(section.isCollapsed()).isTrue();
    }

    /**
     * @spec.given an AdminAction with the BUTTON variant, a color and an icon
     * @spec.when  the component layer renders the action (dogfood)
     * @spec.then  it produces a ButtonView carrying the action's label, color, size and icon
     */
    @Test
    void an_action_renders_through_the_button_view() {
        AdminAction<Object> action =
                new ViewAction<Object>()
                        .color("success")
                        .size(io.lievit.kit.Size.SMALL)
                        .variant(io.lievit.kit.ActionVariant.BUTTON);

        ButtonView view = (ButtonView) ComponentViews.forAction(action);

        assertThat(view.label()).isEqualTo("View");
        assertThat(view.cssClasses(colors)).contains("lievit-btn-success", "lievit-btn-sm");
    }

    /**
     * @spec.given an AdminNotification at danger level
     * @spec.when  the component layer renders it (dogfood)
     * @spec.then  it produces a badge-styled view carrying the notification's color
     */
    @Test
    void a_notification_renders_through_a_colored_view() {
        AdminNotification note = AdminNotification.danger("Failed").body("try again");

        BadgeView view = ComponentViews.forNotification(note);

        assertThat(view.label()).isEqualTo("Failed");
        assertThat(view.cssClasses(colors)).contains("lievit-badge-danger");
    }
}
