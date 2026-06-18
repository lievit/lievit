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

        // Bind the parent-rendered slot content (issue #91) for the duration of the child's mount, so
        // the child's render reads LievitSlots.current() and emits slot placeholders. Cleared in the
        // finally so nothing leaks to a sibling child; a slotless child binds an empty proxy.
        io.lievit.component.LievitSlots.bindFor(child.slots());
        WireCall mounted;
        String childHtml;
        try {
            mounted = dispatcher.mount(metadata, instance, child.props());
            childHtml = templateAdapter.render(metadata, instance, mounted.wire());
        } finally {
            io.lievit.component.LievitSlots.clearFor();
        }
        // Substitute the slot placeholders the child emitted with the parent-rendered slot HTML. The
        // content runs in the parent's scope (its events/state belong to the parent); the child only
        // positioned it. An absent slot's placeholder substitutes to nothing.
        childHtml = substituteSlots(childHtml, child.slots());

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
    /**
     * Stamps the top-level wire markers ({@code data-lievit-id} + {@code data-lievit-snapshot}) on a
     * component's root element, without a {@code lievit:key} (a page root has no morph key, unlike a
     * child in a parent's render). Used by the full-page renderer (issue #63/#181) so the client can
     * hydrate a route-target component the same way it hydrates an embedded one.
     *
     * @param html the component's rendered HTML
     * @param cid the component instance id
     * @param signedSnapshot the signed snapshot
     * @return the HTML with the two markers on its root element
     */
    static String stampRoot(String html, String cid, String signedSnapshot) {
        int tagStart = firstElement(html);
        int tagEnd = html.indexOf('>', tagStart);
        if (tagEnd < 0) {
            throw new IllegalStateException("a full-page component's root element is malformed");
        }
        String markers =
                " data-lievit-id=\""
                        + escape(cid)
                        + "\" data-lievit-snapshot=\""
                        + escape(signedSnapshot)
                        + "\"";
        int insertAt = html.charAt(tagEnd - 1) == '/' ? tagEnd - 1 : tagEnd;
        return html.substring(0, insertAt) + markers + html.substring(insertAt);
    }

    private static int firstElement(String html) {
        int tagStart = html.indexOf('<');
        while (tagStart >= 0
                && tagStart + 1 < html.length()
                && (html.charAt(tagStart + 1) == '!' || html.charAt(tagStart + 1) == '?')) {
            tagStart = html.indexOf('<', html.indexOf('>', tagStart) + 1);
        }
        if (tagStart < 0) {
            throw new IllegalStateException("a component rendered no root element to mark");
        }
        return tagStart;
    }

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

    /**
     * Substitutes each slot placeholder the child emitted ({@code <!--lievit:slot:name-->}) with the
     * parent-rendered slot HTML, wrapped in fragment markers so the client can match and morph the
     * slot as a distinct region keeping parent ownership (issue #91). A slot the child positioned but
     * the parent did not supply substitutes to an empty string. A slot the parent supplied but the
     * child never positioned is dropped (the child chose not to render it).
     */
    private static String substituteSlots(
            String childHtml, java.util.Map<String, String> slots) {
        if (childHtml.indexOf("<!--lievit:slot:") < 0) {
            return childHtml;
        }
        String html = childHtml;
        // Replace every positioned slot placeholder. Iterate over the union of positioned names by
        // scanning the markup, but it is enough to replace for each parent-supplied slot plus clear
        // any unfilled placeholders afterwards.
        for (java.util.Map.Entry<String, String> entry : slots.entrySet()) {
            String name = entry.getKey();
            String content = entry.getValue() == null ? "" : entry.getValue();
            String wrapped =
                    "<!--lievit:slot-start:" + name + "-->"
                            + content
                            + "<!--lievit:slot-end:" + name + "-->";
            html = html.replace(io.lievit.component.LievitSlots.placeholderFor(name), wrapped);
        }
        // Any placeholder still present is a slot the child positioned but the parent did not supply:
        // collapse it to nothing.
        html = stripUnfilledSlotPlaceholders(html);
        return html;
    }

    private static String stripUnfilledSlotPlaceholders(String html) {
        String marker = "<!--lievit:slot:";
        StringBuilder out = new StringBuilder(html.length());
        int from = 0;
        int at;
        while ((at = html.indexOf(marker, from)) >= 0) {
            int end = html.indexOf("-->", at);
            if (end < 0) {
                break;
            }
            out.append(html, from, at);
            from = end + 3;
        }
        out.append(html, from, html.length());
        return out.toString();
    }

    private static String placeholder(String key) {
        return io.lievit.component.LievitChildren.placeholderFor(key);
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;");
    }
}
