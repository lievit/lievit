/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;
import java.util.function.Function;

/**
 * A custom-view table column (the Filament {@code ViewColumn::make()}): the escape hatch out of the
 * sealed {@link Cell} hierarchy. Where {@link TextColumn} / {@link BadgeColumn} / {@link IconColumn}
 * cover the typed-cell shapes, a {@code ViewColumn} renders an <strong>arbitrary</strong> HTML
 * fragment the adopter produces from the whole row, so an adopter is never blocked when a cell needs
 * markup no built-in column emits (a progress bar, a mini avatar+name stack, a sparkline).
 *
 * <p>It mirrors Filament's model: there the column names a Blade view and the record is injected;
 * here the {@link #render(Function) render mapper} is a server-first function {@code row -> html}.
 * The kit carries the produced fragment as a {@link Cell.View} and the template stamps it RAW (the
 * trust boundary: the fragment is the adopter's own server-rendered markup, the same contract as a
 * Blade view file, see {@link Cell.View}). A {@link #url(Function) url mapper} still wraps the cell
 * as a {@link Cell.Link} so a custom-view cell can also be a row deep-link.
 *
 * @param <T> the row type
 */
public final class ViewColumn<T> extends Column<T> {

    private final Function<? super T, String> render;

    private ViewColumn(String label, Function<? super T, String> render) {
        // The base "value" of a view column is its rendered fragment, so the text projection and any
        // summarizer see the produced markup (Filament's ViewColumn has no separate state).
        super(label, render);
        this.render = render;
    }

    /**
     * Creates a custom-view column whose cells are the HTML the {@code render} mapper produces.
     *
     * @param label  the column header
     * @param render maps a row to its trusted HTML fragment (the server-rendered cell body)
     * @param <T>    the row type
     * @return a new view column
     */
    public static <T> ViewColumn<T> make(String label, Function<? super T, String> render) {
        return new ViewColumn<>(label, Objects.requireNonNull(render, "render"));
    }

    /**
     * Marks this column searchable: it folds into the table's global search (the view column's
     * rendered text is matched). Narrows the return type for the fluent chain.
     *
     * @return this column
     */
    public ViewColumn<T> searchable() {
        setSearchable(true);
        return this;
    }

    /**
     * Declares an explicit sort/search key decoupled from the label.
     *
     * @param key the stable key
     * @return this column
     */
    public ViewColumn<T> sortKey(String key) {
        setSortKey(key);
        return this;
    }

    /**
     * Lets the user hide/show this column from the column manager; visible by default.
     *
     * @return this column
     */
    public ViewColumn<T> toggleable() {
        setToggleable(true, false);
        return this;
    }

    /**
     * Makes the cell a link to the URL derived from the row. Narrows the return type for the chain.
     *
     * @param fn maps a row to its URL
     * @return this column
     */
    @Override
    public ViewColumn<T> url(Function<? super T, String> fn) {
        super.url(fn);
        return this;
    }

    /**
     * Renders the fragment for a row (the {@code render} mapper applied), exposed for tests and the
     * cell projection.
     *
     * @param row the row
     * @return the trusted HTML fragment, never null (empty string for a null result)
     */
    public String html(T row) {
        String produced = render.apply(row);
        return produced == null ? "" : produced;
    }

    /**
     * Renders a {@link Cell.View} carrying the row's fragment, wrapped as a {@link Cell.Link} when a
     * {@link #url(Function) url mapper} is declared (so a custom-view cell can deep-link the row).
     */
    @Override
    public Cell cellFor(T row) {
        return linkify(row, new Cell.View(html(row)));
    }
}
