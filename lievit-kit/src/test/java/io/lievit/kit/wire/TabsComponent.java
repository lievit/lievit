/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import java.util.ArrayList;
import java.util.List;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitProperty;
import io.lievit.LievitRender;
import io.lievit.Wire;

/**
 * In-repo proof copy of the shipped {@code registry:wire} tabs component (ADR-0012, Wave 2).
 *
 * <p>This is the same source {@code lievit add tabs} copies from
 * {@code lievit-ui/registry/wire/tabs/TabsComponent.java}, vendored into the kit test tree (package
 * adjusted to {@code io.lievit.kit.wire}) so {@link TabsComponentIT} can drive it through the REAL
 * lievit runtime (codec + registry + dispatcher + JTE adapter) and assert both the server-side
 * active-tab transition and the rendered HTML.
 *
 * <p>Convention (blueprint 1.b): state in {@code @Wire public} fields. The active tab is a SCALAR,
 * so the canonical wire mechanism is the {@code $set('active','<id>')} magic; {@link #select()} is
 * the explicit {@code @LievitAction} equivalent (selecting the armed {@link #pending} tab). A
 * disabled tab is never made active (server-enforced).
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

    /** Disabled tab ids: skipped by selection (server-enforced). Locked. */
    @Wire
    @LievitProperty(locked = true)
    public List<String> disabledIds = new ArrayList<>();

    /** The active tab id: the tab state, held server-side, set by the {@code $set('active',..)} click. */
    @Wire
    public String active = "";

    /** A tab armed for the explicit {@link #select()} action. Cleared after select consumes it. */
    @Wire
    public String pending = "";

    /** Falls back to the first enabled tab, refuses a disabled/unknown active id, on every render. */
    @LievitRender
    void ensureActive() {
        if (!active.isEmpty() && tabIds.contains(active) && !disabledIds.contains(active)) {
            return;
        }
        active = firstEnabled();
    }

    /** Selects the armed {@link #pending} tab over the {@code @LievitAction} dispatch; clears it. */
    @LievitAction
    public void select() {
        if (!pending.isEmpty() && tabIds.contains(pending) && !disabledIds.contains(pending)) {
            active = pending;
        }
        pending = "";
    }

    private String firstEnabled() {
        for (String id : tabIds) {
            if (!disabledIds.contains(id)) {
                return id;
            }
        }
        return "";
    }

    /**
     * @param id the tab id
     * @return true when the tab is currently active
     */
    public boolean isActive(String id) {
        return active.equals(id);
    }

    /**
     * @param id the tab id
     * @return true when the tab id is in the disabled set
     */
    public boolean isDisabled(String id) {
        return disabledIds.contains(id);
    }
}
