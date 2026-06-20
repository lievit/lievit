/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import io.lievit.LievitComponent;
import io.lievit.LievitProperty;
import io.lievit.LievitRender;
import io.lievit.Wire;
import io.lievit.kit.schema.infolist.Infolist;
import io.lievit.kit.schema.infolist.ResolvedNode;

/**
 * A headless wire host that resolves a layout-bearing {@link Infolist} (sections / tabs / fieldset /
 * grid / key-value) into its {@link ResolvedNode} tree and exposes it to the
 * {@code lievit/infolist-tree} template for the layout-completeness IT. It proves the structured
 * resolve path the {@code AdminViewView} flat path does NOT exercise: a real JTE render of a nested
 * infolist schema, including the {@link io.lievit.kit.schema.infolist.KeyValueEntry} map (the
 * audit's "unwired" fix).
 *
 * <p>The infolist + the record are supplied at construction (the test app wires a fixed fixture);
 * the resolved tree is rebuilt on every render so it never has to round-trip the snapshot codec.
 */
@LievitComponent(template = "lievit/infolist-tree")
public class InfolistViewComponent {

    private final Infolist infolist;
    private final Map<String, @Nullable Object> record;

    /** The resolved render tree. NOT serialized: rebuilt from the fixture on each render. */
    @Wire @LievitProperty(serialize = false) @Nullable List<ResolvedNode> nodes;

    /**
     * @param infolist the layout-bearing infolist to resolve
     * @param record the record attributes to resolve it against
     */
    public InfolistViewComponent(Infolist infolist, Map<String, @Nullable Object> record) {
        this.infolist = infolist;
        this.record = record;
    }

    /** Re-resolves the tree on every render so the {@code serialize=false} field is always present. */
    @LievitRender
    void render() {
        this.nodes = infolist.resolveTree(record);
    }

    /** @return the resolved top-level nodes (resolved on render) */
    public List<ResolvedNode> nodes() {
        return nodes == null ? List.of() : nodes;
    }
}
