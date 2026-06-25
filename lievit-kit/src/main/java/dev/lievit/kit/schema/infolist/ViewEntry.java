/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema.infolist;

import java.util.Objects;

/**
 * A custom-view infolist entry (the filament-infolists {@code ViewEntry} carried over): the escape
 * hatch that renders an arbitrary template bound to the entry's state, for a one-off read-only
 * display the built-in entries do not cover. The kit carries the template name and the binding; the
 * template resolves the bound value through the standard {@link Entry#resolveState} path.
 */
public final class ViewEntry extends Entry<ViewEntry> {

    private final String view;

    private ViewEntry(String name, String view) {
        super(name);
        this.view = Objects.requireNonNull(view, "view");
    }

    /**
     * @param name the record attribute the view binds to
     * @param view the template name/path the renderer resolves
     * @return a new view entry
     */
    public static ViewEntry make(String name, String view) {
        return new ViewEntry(name, view);
    }

    /**
     * @return the template name/path
     */
    public String view() {
        return view;
    }
}
