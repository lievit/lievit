/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Spec for the server-side island fragment extraction (ADR-0033, the compiler half of islands; pairs
 * with the shipped client {@code islands.ts}): islands are read from the {@code <!--[lievit:island
 * name]-->} markers, the targeted-extraction path returns only the requested fragments (with their
 * markers) in targeted order, and an unbalanced / absent marker is handled safely.
 */
class IslandFragmentsTest {

    private static final String HTML =
            "<div>"
                    + "<!--[lievit:island feed]--><ul><li>a</li></ul><!--[/lievit:island feed]-->"
                    + "<section><!--[lievit:island side]--><p>x</p><!--[/lievit:island side]--></section>"
                    + "</div>";

    /**
     * @spec.given component HTML with two named islands (one nested in a section)
     * @spec.when  all islands are extracted
     * @spec.then  both fragments are returned by name, each including its own open/close markers so
     *     the client can re-parse them
     * @spec.adr   ADR-0033
     * @spec.us    US-089-islands-server
     */
    @Test
    void extracts_all_named_islands_with_their_markers() {
        var all = IslandFragments.extractAll(HTML);

        assertThat(all.keySet()).containsExactly("feed", "side");
        assertThat(all.get("feed"))
                .startsWith("<!--[lievit:island feed]-->")
                .contains("<li>a</li>")
                .endsWith("<!--[/lievit:island feed]-->");
    }

    /**
     * @spec.given a targeted re-render naming only the "feed" island
     * @spec.when  the targeted fragments are extracted
     * @spec.then  only the feed fragment is returned (the side island is left out): the client morphs
     *     just the targeted region
     * @spec.adr   ADR-0033
     * @spec.us    US-089-islands-server
     */
    @Test
    void targeted_extraction_returns_only_the_named_island() {
        String targeted = IslandFragments.extractTargeted(HTML, List.of("feed"));

        assertThat(targeted).contains("<li>a</li>").doesNotContain("<p>x</p>");
    }

    /**
     * @spec.given an island name the current render did not emit
     * @spec.when  it is targeted
     * @spec.then  the result is empty (the web layer then falls back to the full HTML)
     * @spec.adr   ADR-0033
     * @spec.us    US-089-islands-server
     */
    @Test
    void targeting_an_absent_island_returns_empty() {
        assertThat(IslandFragments.extractTargeted(HTML, List.of("missing"))).isEmpty();
    }
}
