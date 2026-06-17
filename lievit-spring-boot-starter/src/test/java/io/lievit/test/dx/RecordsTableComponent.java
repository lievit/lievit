/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.test.dx;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitMount;
import io.lievit.Wire;

/**
 * A fixture table for the domain table test-DX helpers: it holds a fixed set of rows, a
 * {@code search} field, and a {@code search} action that filters the visible rows by substring. The
 * template stamps {@code data-lievit-row} on each visible row so {@code assertCountTableRecords} can
 * count them, and prints each row's value so {@code assertCanSeeTableRecords} can find it.
 */
@LievitComponent(template = "dx/records-table")
public class RecordsTableComponent {

    private static final List<String> ALL = List.of("Anna", "Marco", "Luca", "Bob");

    @Wire String search = "";

    @Wire List<String> visible = new ArrayList<>();

    @LievitMount
    void seed() {
        this.visible = new ArrayList<>(ALL);
    }

    @LievitAction
    void search() {
        String needle = search.toLowerCase(Locale.ROOT);
        this.visible =
                ALL.stream().filter(r -> r.toLowerCase(Locale.ROOT).contains(needle)).collect(
                        java.util.stream.Collectors.toCollection(ArrayList::new));
    }
}
