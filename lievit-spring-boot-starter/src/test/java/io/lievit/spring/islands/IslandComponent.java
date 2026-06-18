/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.islands;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.Wire;
import io.lievit.component.LievitEffects;

/**
 * A component with a named island region (issue #89 server half): {@code refreshFeed} bumps the feed
 * counter and targets the {@code feed} island, so the wire response carries only the island fragment
 * (not the whole component HTML). The {@code outside} field proves the rest of the component is NOT
 * in the targeted response.
 */
@LievitComponent(template = "islands/panel")
public class IslandComponent {

    @Wire int feed;
    @Wire String outside = "OUTSIDE-MARKER";

    @LievitAction
    void refreshFeed() {
        this.feed++;
        // Target the feed island: the response carries only that fragment (server half of islands).
        LievitEffects.current().island("feed");
    }
}
