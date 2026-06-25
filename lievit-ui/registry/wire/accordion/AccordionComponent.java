/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire;

import java.util.ArrayList;
import java.util.List;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitProperty;
import dev.lievit.LievitRender;
import dev.lievit.Wire;

/**
 * {@code accordion}: the server-first WIRE replacement for the {@code <lv-accordion>} Lit island
 * (ADR-0012, Wave 2). A disclosure GROUP: several triggers, each expanding / collapsing its own
 * region; the open set lives here in typed Java, not in client memory, and the server re-renders
 * the template on each toggle (the client morphs the result, preserving focus + scroll). It is the
 * same disclosure idea as {@code collapsible}, composed over many items.
 *
 * <p>WHY server-state: the island held the open set in a Lit reactive {@code Set} and projected
 * each panel through a named {@code <slot>}, which is inert in light DOM, so the panel bodies
 * silently never rendered (the bug class ADR-0012 was written to kill). Here {@link #open} is a
 * {@code @Wire} list round-tripped in the signed snapshot, and the panel bodies are plain
 * server-rendered JTE owned by the template: they cannot fail to project.
 *
 * <p>Convention (blueprint 1.b): state is {@code @Wire public} fields; the toggle is a
 * {@code @LievitAction}; the disclosure a11y (WAI-ARIA APG accordion, the same Radix source the
 * island cited) lives in the template. Because a regular {@code @LievitAction} takes no forwarded
 * arguments (only the magic {@code $set}/{@code $toggle} parse inline args, runtime parity gap), the
 * clicked item is ARMED into {@link #toggleId} via {@code l:click="$set('toggleId','<id>')"} (the
 * canonical Livewire {@code wire:click="$set(...)"} idiom this repo already uses for row-arm in
 * {@code listing-list.jte}); {@link #applyToggle()} then flips that id in the open set on the
 * pre-render hook and clears the arm, so the whole interaction is one click, fully server-side, and
 * idempotent under replay (a cleared arm re-renders to a no-op). The same logic is reachable as the
 * explicit {@link #toggle()} action driven by a render-asserting IT.
 *
 * <p>The item ids + labels are server config ({@code @LievitProperty(locked = true)} so a client
 * cannot inject or rename an item); the panel bodies are OWNED template markup (the server-first
 * equivalent of children, not a {@code <slot>}). Copied in by {@code lievit add accordion}: the
 * adopter OWNS this class AND {@code accordion.jte} (rename the package, change the items, put real
 * panel markup in the owned regions).
 */
@LievitComponent(template = "lievit/accordion")
public class AccordionComponent {

    /**
     * Item ids in render order. Locked: the set of items is server config, a client cannot add,
     * remove, or rename one by editing the snapshot. Paired index-for-index with {@link #labels}.
     */
    @Wire
    @LievitProperty(locked = true)
    public List<String> itemIds = new ArrayList<>();

    /** Trigger labels, index-aligned with {@link #itemIds}. Locked alongside the ids. */
    @Wire
    @LievitProperty(locked = true)
    public List<String> labels = new ArrayList<>();

    /**
     * The currently open item ids. The single piece of disclosure state, held server-side and
     * round-tripped as a plain JSON list. For {@code single} mode it holds at most one id.
     */
    @Wire
    public List<String> open = new ArrayList<>();

    /**
     * {@code "single"} (default): at most one item open at a time; {@code "multiple"}: any number.
     * Locked: the selection mode is server policy, not a client toggle.
     */
    @Wire
    @LievitProperty(locked = true)
    public String mode = "single";

    /**
     * The item a click just armed (via the {@code $set} magic). Consumed + cleared by
     * {@link #applyToggle()} on the next render, so a click reduces to one server round-trip. Empty
     * when no toggle is pending; it never persists across a render.
     */
    @Wire
    public String toggleId = "";

    /**
     * Flips the armed {@link #toggleId} in the open set on every pre-render (the hook the dispatcher
     * runs at mount and before each re-render), then clears the arm. Empty arm = no-op, so a plain
     * re-render (or a snapshot replay carrying a cleared arm) never double-toggles: idempotent.
     */
    @LievitRender
    void applyToggle() {
        if (toggleId.isEmpty() || !itemIds.contains(toggleId)) {
            toggleId = "";
            return;
        }
        flip(toggleId);
        toggleId = "";
    }

    /**
     * Toggles the open/closed state of {@link #toggleId} (the armed item) explicitly. Same effect as
     * the {@code $set}-armed render path: provided so a caller (or a render-asserting test) can drive
     * the transition through the {@code @LievitAction} dispatch with the target supplied as a field
     * update in the same wire call (updates apply before actions, ADR-0001). Clears the arm after.
     */
    @LievitAction
    public void toggle() {
        if (!toggleId.isEmpty() && itemIds.contains(toggleId)) {
            flip(toggleId);
        }
        toggleId = "";
    }

    /** Adds the id to the open set, or removes it if already open; single mode keeps at most one. */
    private void flip(String id) {
        if (open.contains(id)) {
            open.remove(id);
            return;
        }
        if ("single".equals(mode)) {
            open.clear();
        }
        open.add(id);
    }

    /**
     * Whether an item is currently open (read by the template to render aria-expanded + the panel
     * hidden attribute).
     *
     * @param id the item id
     * @return true when the item is in the open set
     */
    public boolean isOpen(String id) {
        return open.contains(id);
    }
}
