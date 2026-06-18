/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.compiler;

import java.util.List;

/**
 * The per-component head assets captured at compile time (issue #119, ADR-0061): the lievit analogue
 * of Livewire's {@code @assets} block. A component declares shared third-party head tags (a CDN
 * stylesheet, a charting library {@code <script src>}) in a colocated {@code <Simple>.lievit.assets}
 * file, one head tag per non-blank line; the compiler captures them verbatim and stamps a
 * <strong>deterministic key</strong> derived from the component identity, so the page ships them
 * <em>once</em> regardless of how many instances of the component render (the {@code @assets}
 * once-per-page semantic).
 *
 * <p>The key is {@code lw-<crc32(templateId)>-assets} ({@link DeterministicKeys}-family), stable
 * across re-renders and distinct per component, so the starter's page/session tracking can record "this
 * component's assets already shipped" and not re-emit them. Unlike the per-component
 * {@code .lievit.ts} script (which runs once <em>per component instance</em> on init, the
 * {@code @script} analogue), {@code @assets} ship once <em>per page</em> across all instances.
 *
 * <p>Capture is verbatim: the compiler does not parse, evaluate, or rewrite the tags (no Blade-text
 * slicing, ADR-0023). Validity and CSP-compliance of a tag are the author's responsibility, the same
 * as a hand-written head tag. Immutable, pure data.
 *
 * @param key the deterministic once-per-page dedup key (stable, distinct per component)
 * @param headTags the head tags to emit once, in declared order (verbatim, may be empty)
 */
public record ComponentAssets(String key, List<String> headTags) {

    public ComponentAssets {
        headTags = List.copyOf(headTags);
    }

    /** @return true when the component declared no head assets. */
    public boolean isEmpty() {
        return headTags.isEmpty();
    }
}
