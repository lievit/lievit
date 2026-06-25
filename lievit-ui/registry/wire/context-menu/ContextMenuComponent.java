/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire;

import java.util.List;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitProperty;
import dev.lievit.Wire;

/**
 * {@code context-menu}: the server-first WIRE replacement for the {@code <lv-context-menu>} Lit
 * island (ADR-0012, Wave 2). A right-click menu whose open-state, pointer position, and current
 * selection live here in typed Java; the items are server-owned data rendered as real menu items in
 * the template, and an item activation is a wire action. No {@code <slot>}: the right-clickable
 * region is OWNED template markup, not a projected slot (the light-DOM slot bug ADR-0012 was written
 * to kill).
 *
 * <p>WHY server-state: the island held {@code open} + the open-submenu chain + the pointer in Lit
 * reactive state and positioned with {@code @floating-ui/dom}. Here the only durable state is
 * {@code open} + the pointer coordinates {@code x}/{@code y} + the last {@code selectedKey}, all
 * {@code @Wire} fields round-tripped in the signed snapshot. The items are a server list (read off
 * {@code _instance} in the template, because a list of records cannot round-trip the generic-Map
 * snapshot codec, the {@code listing-list} pattern). Positioning is the native {@code position:fixed}
 * + CSS custom properties driven by {@code x}/{@code y}: zero floating-ui, CSP-clean.
 *
 * <p>HOW it opens: a tiny CSP-clean typed-TS enhancer ({@code context-menu.ts}) listens for the
 * native {@code contextmenu} event on the trigger region, prevents the browser menu, writes the
 * pointer coordinates into the {@code x}/{@code y} wire fields (the {@code $set} model path) and
 * invokes {@link #openAt()}. Keyboard {@code ContextMenu}/{@code Shift+F10} does the same at the
 * focused element's box. The server then re-renders the menu open at those coordinates; the client
 * morphs it in.
 *
 * <p>Convention (blueprint 1.b): state is {@code @Wire public} fields; actions are
 * {@code @LievitAction} methods; the menu a11y (WAI-ARIA APG menu pattern, Radix {@code ContextMenu}
 * as the source the dropped island cited) lives in the template. {@code x}/{@code y} round-trip
 * (the enhancer sets them); {@code open} + {@code selectedKey} are server-owned. Item selection is
 * the {@code $set('selectedKey', '<key>')} magic-action on each menu item (the {@code $set} row-arm
 * idiom from {@code listing-list.jte}); {@link #closeAfterSelect()} then closes the menu so the
 * server stays the single owner of the open-state.
 *
 * <p>Copied in by {@code lievit add context-menu}: the adopter OWNS this class (rename it, move the
 * package, supply the real item list, add server-side authz on a selection) AND the
 * {@code context-menu.jte} template + the {@code context-menu.ts} enhancer.
 */
@LievitComponent(template = "lievit/context-menu")
public class ContextMenuComponent {

    /**
     * One menu entry. A server-owned data row rendered as a real menu item. {@code separator} entries
     * carry no {@code key}/{@code label}; {@code checkbox}/{@code radio} carry a {@code checked}; the
     * {@code shortcut} is a display-only hint.
     *
     * @param key the selection key emitted into {@code selectedKey} (empty for a separator)
     * @param label the visible label (empty for a separator)
     * @param icon an optional Lucide icon name rendered inline (empty for none)
     * @param shortcut an optional right-aligned keyboard hint (display only)
     * @param type one of {@code item} | {@code checkbox} | {@code radio} | {@code separator}
     * @param checked the checked state for a {@code checkbox}/{@code radio} entry
     * @param disabled when true the item is dimmed and not selectable
     */
    public record Entry(
            String key,
            String label,
            String icon,
            String shortcut,
            String type,
            boolean checked,
            boolean disabled) {

        /**
         * @param key the selection key
         * @param label the visible label
         * @return a plain selectable item with no icon/shortcut
         */
        public static Entry item(String key, String label) {
            return new Entry(key, label, "", "", "item", false, false);
        }

        /**
         * @return a non-selectable divider
         */
        public static Entry separator() {
            return new Entry("", "", "", "", "separator", false, false);
        }

        /**
         * @return true when this entry is a divider (no role, no key)
         */
        public boolean isSeparator() {
            return "separator".equals(type);
        }

        /**
         * @return the WAI-ARIA role for this entry's menu item
         */
        public String role() {
            return switch (type) {
                case "checkbox" -> "menuitemcheckbox";
                case "radio" -> "menuitemradio";
                default -> "menuitem";
            };
        }

        /**
         * @return true for a checkbox/radio entry that exposes aria-checked
         */
        public boolean isCheckable() {
            return "checkbox".equals(type) || "radio".equals(type);
        }
    }

    /** The menu entries, server-owned. Not serialized: a record list cannot round-trip the snapshot
     * codec, so the template reads it off {@code _instance} (the {@code listing-list} pattern). */
    @Wire
    @LievitProperty(serialize = false)
    public List<Entry> items =
            List.of(
                    Entry.item("copy", "Copy"),
                    Entry.item("paste", "Paste"),
                    Entry.separator(),
                    Entry.item("delete", "Delete"));

    /** Open state: the single piece of disclosure state, held server-side. */
    @Wire
    public boolean open = false;

    /** Pointer x at which the menu is anchored (px from the viewport left). Set by the enhancer. */
    @Wire
    public int x = 0;

    /** Pointer y at which the menu is anchored (px from the viewport top). Set by the enhancer. */
    @Wire
    public int y = 0;

    /** The key of the last selected item, or empty. Read by the host page after a selection. */
    @Wire
    public String selectedKey = "";

    /**
     * The menu entries, read by the template off the live instance ({@code _instance}). Exposed as a
     * getter (not via the wire) because a record list cannot round-trip the generic-Map snapshot
     * codec; the template reads it off the freshly-built instance instead (the {@code listing-list}
     * pattern, ADR-0020 blocker).
     *
     * @return the menu entries
     */
    public List<Entry> items() {
        return items;
    }

    /**
     * Opens the menu (at the {@code x}/{@code y} the enhancer set) and clears any prior selection.
     * Invoked from the {@code contextmenu} enhancer after it writes the pointer coordinates.
     */
    @LievitAction
    public void openAt() {
        selectedKey = "";
        open = true;
    }

    /** Closes the menu without selecting anything (Escape / outside click). */
    @LievitAction
    public void close() {
        open = false;
    }

    /**
     * Selects the item whose key was armed into {@code selectedKey} by the template's
     * {@code $set('selectedKey', '<key>')} magic-action, and closes the menu. The two-step
     * (arm-then-close) is the {@code $set} idiom from {@code listing-list.jte}, expressed without a
     * per-key action (actions take no arguments): the item arms the key, this action closes the menu
     * once, so the server stays the single owner of the open-state.
     */
    @LievitAction
    public void closeAfterSelect() {
        open = false;
    }
}
