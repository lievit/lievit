/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.islands;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import io.lievit.spring.LievitWireService;
import io.lievit.spring.WireCallResult;

/**
 * Island targeting end-to-end (issue #89 server half, ADR-0033): an action that targets a named
 * island returns ONLY that island's fragment (with its markers) instead of the whole component HTML,
 * so the client morphs just that region. Pairs with the shipped client islands.ts.
 */
@SpringBootTest(classes = IslandsTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class IslandTargetingIT {

    @Autowired LievitWireService wireService;

    /**
     * @spec.given a mounted component with a feed island and an action that targets it
     * @spec.when  refreshFeed is called over the wire
     * @spec.then  the response HTML is only the feed island fragment (its markers + the bumped count),
     *     not the rest of the component (the OUTSIDE marker is absent), and the islands effect names
     *     the targeted island for the client
     * @spec.adr   ADR-0033
     * @spec.us    US-089-islands-server
     */
    @Test
    void an_island_targeting_action_returns_only_the_island_fragment() {
        WireCallResult mounted = wireService.mount(IslandComponent.class.getName());
        // The full mount carries both the outside content and the island.
        assertThat(mounted.html()).contains("OUTSIDE-MARKER").contains("[lievit:island feed]");

        WireCallResult after =
                wireService.call(
                        mounted.snapshot(), Map.of(), List.of("refreshFeed"), "127.0.0.1");

        // Only the feed island fragment came back: its markers + the bumped count, no OUTSIDE content.
        assertThat(after.html())
                .contains("<!--[lievit:island feed]-->")
                .contains("data-feed-count")
                .contains(">1<")
                .doesNotContain("OUTSIDE-MARKER");
        // The islands effect names the target for the client (ADR-0012 islands key).
        assertThat(after.effects()).contains("\"islands\"").contains("feed");
    }
}
