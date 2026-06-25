/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Pins the server-side island boundary markers (ADR-0033, the server half of islands): the open/close
 * comment text must stay byte-identical to the client {@code islands.ts} contract
 * ({@code [lievit:island name]} / {@code [/lievit:island name]} inside an HTML comment), or the
 * client cannot parse the regions.
 */
class LievitIslandTest {

    /**
     * @spec.given an island name
     * @spec.when  the open/close markers are produced
     * @spec.then  they are HTML comments carrying the exact [lievit:island name] contract text the
     *     client islands.ts parses, and wrap() brackets inner HTML with both
     * @spec.adr   ADR-0033
     * @spec.us    US-089-islands-server
     */
    @Test
    void emits_the_client_contract_marker_text() {
        assertThat(LievitIsland.open("feed")).isEqualTo("<!--[lievit:island feed]-->");
        assertThat(LievitIsland.close("feed")).isEqualTo("<!--[/lievit:island feed]-->");
        assertThat(LievitIsland.wrap("feed", "<p>x</p>"))
                .isEqualTo("<!--[lievit:island feed]--><p>x</p><!--[/lievit:island feed]-->");
    }
}
