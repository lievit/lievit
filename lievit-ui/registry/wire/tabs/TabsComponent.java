/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire;

import java.util.ArrayList;
import java.util.List;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitProperty;
import io.lievit.LievitRender;
import io.lievit.Wire;

/**
 * {@code tabs}: the server-first WIRE replacement for the {@code <lv-tabs>} Lit island (ADR-0012,
 * Wave 2). A tab bar + panels where the active tab is server state; only the active panel is
 * rendered visible, the others are {@code hidden}. The active id lives here in typed Java, not in
 * client memory, and the server re-renders on each tab switch (the client morphs the result).
 *
 * <p>WHY server-state: the island held the active tab in a Lit reactive property and projected each
 * panel through a named {@code <slot>}, which is inert in light DOM, so the panel bodies silently
 * never rendered (the bug class ADR-0012 was written to kill). Here {@link #active} is a
 * {@code @Wire} string round-tripped in the signed snapshot, and the panel bodies are plain
 * server-rendered JTE owned by the template: they cannot fail to project.
 *
 * <p>Convention (blueprint 1.b): state is {@code @Wire public} fields; the a11y (WAI-ARIA APG tabs,
 * the same Radix source the island cited) lives in the template. The active tab being a SCALAR, the
 * canonical wire mechanism is the {@code $set} magic: a tab click is
 * {@code l:click="$set('active','<tabId>')"} (the same {@code wire:click="$set(...)"} idiom this
 * repo uses in {@code listing-list.jte}), which mutates {@link #active} server-side and re-renders.
 * {@link #select()} is the explicit {@code @LievitAction} equivalent (selecting the armed
 * {@link #pending} tab) for callers / a render-asserting IT, since a regular action takes no
 * forwarded args. A disabled tab is never made active (server-enforced).
 *
 * <p>HTMX alternative (blueprint §2): a content-on-demand tab set can instead be a plain HTMX
 * recipe, the tab bar links carrying {@code hx-get} to a controller endpoint that returns the panel
 * partial and swaps it into the panel container, no wire snapshot at all. That is the lighter path
 * when the panels are independent server fragments; this WIRE component is the richer path when the
 * tab set shares server state with the rest of the page (and is the form Wave 2 ships).
 *
 * <p>The tab ids + labels are server config ({@code @LievitProperty(locked = true)}); the panel
 * bodies are OWNED template markup (the server-first equivalent of children, not a {@code <slot>}).
 * Copied in by {@code lievit add tabs}: the adopter OWNS this class AND {@code tabs.jte}.
 */
@LievitComponent(template = "lievit/tabs")
public class TabsComponent {

    /** Tab ids in render order. Locked: the tab set is server config. Paired with {@link #labels}. */
    @Wire
    @LievitProperty(locked = true)
    public List<String> tabIds = new ArrayList<>();

    /** Tab labels, index-aligned with {@link #tabIds}. Locked alongside the ids. */
    @Wire
    @LievitProperty(locked = true)
    public List<String> labels = new ArrayList<>();

    /** Disabled tab ids: skipped by selection (server-enforced). Locked alongside the tab set. */
    @Wire
    @LievitProperty(locked = true)
    public List<String> disabledIds = new ArrayList<>();

    /**
     * The active tab id: the single piece of tab state, held server-side and round-tripped as a
     * scalar. Set directly by the {@code $set('active','<id>')} click. Defaults to the first enabled
     * tab on the first render via {@link #ensureActive()}.
     */
    @Wire
    public String active = "";

    /**
     * A tab a caller armed to select via the explicit {@link #select()} action (the action path,
     * since a regular {@code @LievitAction} takes no forwarded args). Empty when unused; the
     * {@code $set} click path does not touch it. Cleared after {@link #select()} consumes it.
     */
    @Wire
    public String pending = "";

    /**
     * Falls back to the first enabled tab when no tab is active, and refuses an active id that is
     * unknown or disabled (a client cannot select a disabled tab by editing the snapshot). Runs on
     * every pre-render (mount + each re-render), so the rendered state is always a valid selection.
     */
    @LievitRender
    void ensureActive() {
        if (!active.isEmpty() && tabIds.contains(active) && !disabledIds.contains(active)) {
            return;
        }
        active = firstEnabled();
    }

    /**
     * Selects the armed {@link #pending} tab explicitly over the {@code @LievitAction} dispatch (the
     * scalar equivalent of {@code $set('active', pending)}); ignored when the pending tab is unknown
     * or disabled. Clears the arm after. The template's tab clicks use the {@code $set} magic
     * directly; this exists for the action-driven caller / the render-asserting IT.
     */
    @LievitAction
    public void select() {
        if (!pending.isEmpty() && tabIds.contains(pending) && !disabledIds.contains(pending)) {
            active = pending;
        }
        pending = "";
    }

    /** The first non-disabled tab id, or empty when every tab is disabled / there are none. */
    private String firstEnabled() {
        for (String id : tabIds) {
            if (!disabledIds.contains(id)) {
                return id;
            }
        }
        return "";
    }

    /**
     * Whether a tab is the active one (read by the template for aria-selected, tabindex, and the
     * panel hidden attribute).
     *
     * @param id the tab id
     * @return true when the tab is currently active
     */
    public boolean isActive(String id) {
        return active.equals(id);
    }

    /**
     * Whether a tab is disabled.
     *
     * @param id the tab id
     * @return true when the tab id is in the disabled set
     */
    public boolean isDisabled(String id) {
        return disabledIds.contains(id);
    }
}
