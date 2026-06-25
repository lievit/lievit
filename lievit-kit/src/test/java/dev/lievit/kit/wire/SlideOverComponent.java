/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.wire;

import org.jspecify.annotations.Nullable;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitProperty;
import dev.lievit.LievitRender;
import dev.lievit.Wire;
import dev.lievit.kit.Resource;
import dev.lievit.kit.SlideOver;
import dev.lievit.kit.hello.Listing;

/**
 * {@code slide-over}: the kit-level SlideOver affordance (roadmap K2), a right-anchored detail panel
 * hosting a record's {@link dev.lievit.kit.schema.infolist.Infolist Infolist} (the "view in panel"
 * outcome the calendar / table opens in-context).
 *
 * <p>It is built <strong>on the existing {@code drawer} wire</strong>: it carries the SAME
 * open-state-server model as {@link DrawerComponent} (the {@code open} boolean + {@code open()} /
 * {@code close()} actions, the {@code dismissible} lock) and its template renders the same
 * {@code data-lv-drawer} structure (right-anchored, {@code role=dialog}, {@code hidden} when closed)
 * so the drawer's typed-TS focus-trap / Escape enhancement applies unchanged. It does NOT reinvent
 * the open/close/focus-trap; it adds the hosted content: a {@link SlideOver} resolved from a
 * record's infolist.
 *
 * <p>The {@code side} is locked to {@code "right"} (a slide-over is the right-edge specialization of
 * the drawer). {@link #showRecord(String)} is the kit API a host wires to "view a row in the panel":
 * it resolves the infolist over the record and opens the panel.
 */
@LievitComponent(template = "lievit/slide-over")
public class SlideOverComponent {

    private final Resource<Listing> resource;

    /** Open state: the single piece of modal state, held server-side (the drawer model). */
    @Wire public boolean open = false;

    /** Locked to the right edge: a slide-over is the right-anchored drawer specialization. */
    @Wire @LievitProperty(locked = true) public String side = "right";

    /** Panel title; wired to {@code aria-labelledby}. Round-trips. */
    @Wire public String heading = "";

    /** Backdrop / Escape closes the panel. Locked (the drawer dismissible lock). */
    @Wire @LievitProperty(locked = true) public boolean dismissible = true;

    /** The id of the record shown in the panel; round-trips so a re-render re-resolves it. */
    @Wire public String recordId = "";

    // The resolved hosted content: NOT serialized (a complex record cannot round-trip the
    // generic-Map snapshot codec; it is rebuilt from recordId on each render).
    @Wire @LievitProperty(serialize = false) @Nullable SlideOver content;

    /**
     * @param resource the resource whose infolist the panel hosts
     */
    public SlideOverComponent(Resource<Listing> resource) {
        this.resource = resource;
    }

    /**
     * The kit "view in panel" API: resolve the resource's infolist over the record and open the
     * panel showing it. A host wires this to a row / calendar-event click.
     *
     * @param id the record id to show
     */
    public void showRecord(String id) {
        this.recordId = id == null ? "" : id;
        resolve();
        this.open = true;
    }

    /** Opens the panel for the current {@link #recordId} (the drawer {@code open} action). */
    @LievitAction
    public void open() {
        resolve();
        this.open = true;
    }

    /** Closes the panel (the drawer {@code close} action; unconditional so the server owns state). */
    @LievitAction
    public void close() {
        this.open = false;
    }

    /**
     * Re-resolves the hosted content from {@link #recordId} on EVERY render (mount + each call), so a
     * round-tripped recordId rebuilds the {@code serialize=false} content. A blank / missing id
     * clears the content.
     */
    @LievitRender
    void render() {
        resolve();
    }

    private void resolve() {
        if (recordId == null || recordId.isBlank() || resource.infolist().isEmpty()) {
            this.content = null;
            return;
        }
        Listing record = resource.repository().findById(recordId).orElse(null);
        if (record == null) {
            this.content = null;
            return;
        }
        this.content =
                SlideOver.over(
                        heading.isBlank() ? resource.label() : heading,
                        resource.infolist().orElseThrow(),
                        resource.recordAttributes(record));
    }

    /**
     * @return the resolved hosted content, or {@code null} when no (valid) record is shown; read off
     *     the live instance because a complex record cannot round-trip the snapshot codec
     */
    public @Nullable SlideOver content() {
        return content;
    }
}
