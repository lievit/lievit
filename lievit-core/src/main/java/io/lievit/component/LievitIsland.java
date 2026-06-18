/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

/**
 * Emits the island boundary comment markers a template wraps a named island region in (the
 * server half of islands; pairs with the client {@code islands.ts} already shipped). The client
 * parses {@code <!--[lievit:island name]-->} … {@code <!--[/lievit:island name]-->} to find and
 * selectively morph an island; this is the single source of that exact marker text on the server, so
 * a template author writes {@code $unsafe{LievitIsland.open("feed")}} … {@code
 * $unsafe{LievitIsland.close("feed")}} (JTE) or interpolates the same in a DSL fragment.
 *
 * <p>An island is a named region of a component's markup the server can re-render in isolation: when
 * an action targets it (via {@link LievitEffects#island(String)}), the response carries only that
 * island's fragment and the client morphs just that region, leaving the rest of the component's DOM
 * untouched. Wrapping a region in these markers is what makes the region addressable; without the
 * markers, the whole component re-renders.
 *
 * <p>Pure string assembly, zero Spring, zero state: the marker text is a stable protocol constant
 * shared with the client bundle (kept byte-identical to {@code islands.ts}'s
 * {@code islandOpenMarker} / {@code islandCloseMarker}).
 */
public final class LievitIsland {

    private LievitIsland() {}

    /**
     * The open marker for a named island region.
     *
     * @param name the island name (matched against {@link LievitEffects#island(String)} targets)
     * @return the HTML comment that opens the region (e.g. {@code <!--[lievit:island feed]-->})
     */
    public static String open(String name) {
        return "<!--[lievit:island " + name + "]-->";
    }

    /**
     * The close marker for a named island region.
     *
     * @param name the island name (must match the {@link #open(String)} it pairs with)
     * @return the HTML comment that closes the region (e.g. {@code <!--[/lievit:island feed]-->})
     */
    public static String close(String name) {
        return "<!--[/lievit:island " + name + "]-->";
    }

    /**
     * Wraps {@code inner} in the open/close markers for {@code name} (the convenience form when the
     * island content is already a string).
     *
     * @param name the island name
     * @param inner the island's inner HTML
     * @return the inner HTML bracketed by the island markers
     */
    public static String wrap(String name, String inner) {
        return open(name) + inner + close(name);
    }
}
