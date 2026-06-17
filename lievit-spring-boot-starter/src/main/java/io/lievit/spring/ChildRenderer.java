/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import java.time.Instant;
import java.util.List;

import io.lievit.component.ChildComponent;
import io.lievit.component.ComponentMetadata;
import io.lievit.component.WireCall;
import io.lievit.component.WireDispatcher;
import io.lievit.render.TemplateAdapter;
import io.lievit.wire.ComponentId;
import io.lievit.wire.Snapshot;
import io.lievit.wire.SnapshotCodec;
import io.lievit.wire.WireError;
import io.lievit.wire.WireException;

/**
 * Mounts the child components a parent declared and substitutes their rendered HTML into the
 * parent's placeholders (ADR-0016, nested components). Pulled out of {@link LievitWireService} so the
 * substitution + marker-injection is unit-testable without a servlet context.
 *
 * <p>A child is an <strong>independent</strong> component: it is mounted on its own
 * {@link WireDispatcher} call (props seeded first), gets its own signed snapshot and its own
 * {@code cid}, and renders its own HTML, which is then inlined into the parent's markup at the
 * placeholder comment the parent emitted for that key. The statelessness invariant of ADR-0001 holds
 * per component: the parent's snapshot carries only the parent's state, never the child's.
 *
 * <p>Each child root gets three client-glue markers injected onto its first element tag (the
 * contract with the sibling client bundle, see {@code docs/adr/0016}):
 *
 * <ul>
 *   <li>{@code data-lievit-snapshot} — the child's signed snapshot, so the client can drive the
 *       child's own wire calls (the same attribute the host page stamps on a top-level component).
 *   <li>{@code lievit:key} — the stable {@code @key}, so Idiomorph identifies the child across the
 *       parent's re-renders and preserves its DOM (no thrash, no lost focus / child state).
 *   <li>{@code data-lievit-id} — the child's {@code cid}, the endpoint path component.
 * </ul>
 *
 * <p>Nesting is bounded: a child may itself declare grandchildren (its own render binds a fresh child
 * sink), and the depth is capped at {@code maxChildDepth} so an accidental render cycle (a component
 * that mounts itself) is a {@link WireError#PAYLOAD_TOO_COMPLEX}, not a stack overflow.
 */
final class ChildRenderer {

    private final ComponentRegistry registry;
    private final WireDispatcher dispatcher;
    private final TemplateAdapter templateAdapter;
    private final SnapshotCodec codec;
    private final ComponentId componentIds;
    private final int maxChildDepth;

    ChildRenderer(
            ComponentRegistry registry,
            WireDispatcher dispatcher,
            TemplateAdapter templateAdapter,
            SnapshotCodec codec,
            ComponentId componentIds,
            int maxChildDepth) {
        this.registry = registry;
        this.dispatcher = dispatcher;
        this.templateAdapter = templateAdapter;
        this.codec = codec;
        this.componentIds = componentIds;
        this.maxChildDepth = maxChildDepth;
    }

    /**
     * Substitutes every declared child's mounted HTML into {@code parentHtml}, recursively. A leaf
     * render (no children) returns {@code parentHtml} unchanged.
     *
     * @param parentHtml the parent's rendered HTML, carrying one placeholder per declared child
     * @param children the children the parent declared, in render order
     * @return the parent HTML with each placeholder replaced by its child's mounted, marked HTML
     */
    String substitute(String parentHtml, List<ChildComponent> children) {
        return substitute(parentHtml, children, 1);
    }

    private String substitute(String parentHtml, List<ChildComponent> children, int depth) {
        if (children.isEmpty()) {
            return parentHtml;
        }
        if (depth > maxChildDepth) {
            // A render cycle (a component that mounts itself, directly or transitively): refuse it
            // before the recursion blows the stack. Same error class as the payload nesting cap.
            throw new WireException(
                    WireError.PAYLOAD_TOO_COMPLEX,
                    "nested components exceeded the maximum depth");
        }
        String html = parentHtml;
        for (ChildComponent child : children) {
            String childHtml = mountChild(child, depth);
            html = html.replace(placeholder(child.key()), childHtml);
        }
        return html;
    }

    /** The prop key by which a parent names the property a child's modelable field binds to. */
    static final String MODELABLE_PROP = "_modelable";

    private String mountChild(ChildComponent child, int depth) {
        ComponentMetadata metadata = registry.metadata(child.className());
        Object instance = registry.freshInstance(child.className());

        WireCall mounted = dispatcher.mount(metadata, instance, child.props());
        String childHtml = templateAdapter.render(metadata, instance, mounted.wire());

        // Recurse into the child's own children first, so the inner HTML is complete before this
        // child's root markers are injected.
        childHtml = substitute(childHtml, mounted.children(), depth + 1);

        Instant now = Instant.now();
        Snapshot snapshot =
                Snapshot.fresh(componentIds.next(), child.className(), mounted.wire(), now,
                        codec.ttl());
        childHtml = injectMarkers(childHtml, child.key(), snapshot.cid(), codec.sign(snapshot));
        return injectModelable(childHtml, metadata, child);
    }

    /**
     * If the parent declared a modelable bind (passed the {@code _modelable} prop naming its own
     * property) and the child has a modelable field, stamp {@code lievit:modelable="<childField>:
     * <parentProp>"} on the child root. The client uses it to route the child's modelable change
     * back up to the parent's bound property (ADR-0016; the up-leg of the two-way bind). No marker
     * is emitted if either side is absent, so a child mounted without a bind is unaffected.
     */
    private static String injectModelable(
            String childHtml, ComponentMetadata metadata, ChildComponent child) {
        String childField = metadata.modelableField();
        Object parentProp = child.props().get(MODELABLE_PROP);
        if (childField == null || !(parentProp instanceof String parent) || parent.isBlank()) {
            return childHtml;
        }
        int tagEnd = childHtml.indexOf('>');
        if (tagEnd < 0) {
            return childHtml;
        }
        String marker =
                " lievit:modelable=\"" + escape(childField) + ":" + escape(parent) + "\"";
        int insertAt = childHtml.charAt(tagEnd - 1) == '/' ? tagEnd - 1 : tagEnd;
        return childHtml.substring(0, insertAt) + marker + childHtml.substring(insertAt);
    }

    /**
     * Injects the client-glue markers onto the child's root element (its first {@code <tag>}). The
     * markers are added only if not already present, so a re-render is idempotent.
     */
    static String injectMarkers(String childHtml, String key, String cid, String signedSnapshot) {
        int tagStart = childHtml.indexOf('<');
        // Skip a leading comment / doctype to reach the first real element tag.
        while (tagStart >= 0
                && tagStart + 1 < childHtml.length()
                && (childHtml.charAt(tagStart + 1) == '!'
                        || childHtml.charAt(tagStart + 1) == '?')) {
            tagStart = childHtml.indexOf('<', childHtml.indexOf('>', tagStart) + 1);
        }
        if (tagStart < 0) {
            throw new IllegalStateException(
                    "a child component rendered no root element to mark (key '" + key + "')");
        }
        int tagEnd = childHtml.indexOf('>', tagStart);
        if (tagEnd < 0) {
            throw new IllegalStateException(
                    "a child component's root element is malformed (key '" + key + "')");
        }
        String markers =
                " data-lievit-id=\""
                        + escape(cid)
                        + "\" lievit:key=\""
                        + escape(key)
                        + "\" data-lievit-snapshot=\""
                        + escape(signedSnapshot)
                        + "\"";
        // Insert before the closing '>' (handling a self-closing '/>' tag).
        int insertAt = childHtml.charAt(tagEnd - 1) == '/' ? tagEnd - 1 : tagEnd;
        return childHtml.substring(0, insertAt) + markers + childHtml.substring(insertAt);
    }

    private static String placeholder(String key) {
        return io.lievit.component.LievitChildren.placeholderFor(key);
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;");
    }
}
