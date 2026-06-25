/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Extracts the named island fragments from a component's rendered HTML (the server-side peer of the
 * client {@code islands.ts} {@code parseIslands}; the compiler half of islands). When an action
 * targets one or more islands ({@code LievitEffects.island(name)}), the web layer renders the whole
 * component, then asks this extractor for just the targeted island fragments and returns only those,
 * so the client morphs just those regions and leaves the rest of the DOM untouched (the bandwidth +
 * DOM-stability win islands buy).
 *
 * <p>It reads the same comment-marker contract the template author writes via
 * {@code dev.lievit.component.LievitIsland}: {@code <!--[lievit:island name]-->} …
 * {@code <!--[/lievit:island name]-->}. The fragment is the markup between a matching open/close
 * pair, <strong>markers included</strong>, so the returned fragment is itself a parseable island the
 * client re-reads with the same markers (the round-trip contract). Flat set per render (no nested
 * islands in v0.1, matching the client); the first close after an open ends the region.
 *
 * <p>Pure string scanning, zero Spring, zero reflection: it lives in the compiler module beside the
 * tag compiler because it is the same "compile the markup contract" concern, and keeps the dispatcher
 * and HTTP edge untouched.
 */
public final class IslandFragments {

    private IslandFragments() {}

    private static final String OPEN_PREFIX = "<!--[lievit:island ";
    private static final String CLOSE_PREFIX = "<!--[/lievit:island ";
    private static final String SUFFIX = "]-->";

    /**
     * Extracts every island fragment from {@code html}, keyed by island name in document order.
     *
     * @param html the rendered component HTML carrying island markers
     * @return a name -&gt; fragment map (the fragment includes its own markers); empty if none
     */
    public static Map<String, String> extractAll(String html) {
        Map<String, String> out = new LinkedHashMap<>();
        int from = 0;
        while (true) {
            int open = html.indexOf(OPEN_PREFIX, from);
            if (open < 0) {
                break;
            }
            int openNameEnd = html.indexOf(SUFFIX, open);
            if (openNameEnd < 0) {
                break;
            }
            String name = html.substring(open + OPEN_PREFIX.length(), openNameEnd).trim();
            String closeMarker = CLOSE_PREFIX + name + SUFFIX;
            int close = html.indexOf(closeMarker, openNameEnd);
            if (close < 0) {
                // Unbalanced marker: stop, do not emit a half-open island.
                break;
            }
            int fragmentEnd = close + closeMarker.length();
            out.put(name, html.substring(open, fragmentEnd));
            from = fragmentEnd;
        }
        return out;
    }

    /**
     * Extracts only the named island fragments (the targeted-re-render path): the union of the
     * requested {@code names} that are present in {@code html}, concatenated in document order. An
     * unknown / absent name is skipped (the action targeted an island the current render did not
     * emit, e.g. behind a removed conditional).
     *
     * @param html the rendered component HTML
     * @param names the island names the action targeted
     * @return the concatenated fragments (each with its markers), or empty string if none matched
     */
    public static String extractTargeted(String html, List<String> names) {
        if (names.isEmpty()) {
            return "";
        }
        Map<String, String> all = extractAll(html);
        StringBuilder out = new StringBuilder();
        // Emit in the targeted order so the client applies append/prepend feeds deterministically.
        for (String name : names) {
            String fragment = all.get(name);
            if (fragment != null) {
                out.append(fragment);
            }
        }
        return out.toString();
    }
}
