/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.dsl;

import java.util.List;

/**
 * A group of sibling {@link Html} nodes with no wrapping element, the DSL analogue of a React
 * fragment ({@code <>...</>}). It renders its children in order with nothing around them. Useful for
 * a {@code @param Content}-style slot or a list of rows, but a component's <em>root</em> render
 * should be a single {@link Element} so the wire can stamp and morph one root (see {@code
 * DslTemplateAdapter}).
 *
 * @param children the sibling nodes, in order
 */
public record Fragment(List<Html> children) implements Html {

    /**
     * @param children the sibling nodes; defensively copied
     */
    public Fragment {
        children = List.copyOf(children);
    }

    @Override
    public void renderTo(StringBuilder out) {
        for (Html child : children) {
            child.renderTo(out);
        }
    }
}
