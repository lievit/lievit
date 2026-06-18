/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.slots;

import java.util.Map;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitMount;
import io.lievit.LievitRender;
import io.lievit.Wire;
import io.lievit.component.LievitChildren;
import io.lievit.dsl.H;

/**
 * The parent (host) of a slotted {@link CardComponent} (issue #91): in its void render hook it renders
 * the slot content in its OWN scope (the header carries the parent's {@code title}, the body a parent
 * action button), then declares the card child passing that content as named + default slots. A
 * parent re-render (via {@code rename}) re-supplies the slot fragments, proving the slot content
 * survives the child's re-render and stays parent-owned. The host's own markup ({@code slots/host}
 * template) is just the child placeholder.
 */
@LievitComponent(template = "slots/host")
public class CardHostComponent {

    @Wire String title = "";
    @Wire int clicks;

    @LievitMount
    void seed() {
        this.title = "Welcome";
    }

    @LievitAction
    void rename() {
        this.title = "Renamed";
    }

    @LievitAction
    void bump() {
        this.clicks++;
    }

    @LievitRender
    void renderChildren() {
        // Render the slot content in the PARENT's scope: the header reflects this component's title
        // (a @Wire field), the body carries a button wired to this component's bump() action. The
        // child only positions this content; its state/events belong to the parent.
        String header = H.span(H.text(title)).attr("data-host-title", "").render();
        String body =
                H.button(H.text("click")).wireClick("bump").attr("data-host-btn", "").render();

        LievitChildren.current()
                .child(
                        "card",
                        CardComponent.class.getName(),
                        Map.of(),
                        Map.of("header", header, "default", body));
    }
}
