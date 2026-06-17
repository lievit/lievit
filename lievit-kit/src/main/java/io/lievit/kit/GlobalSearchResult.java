/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * One hit from global search (the Filament {@code GlobalSearchResult}): a title, the url that jumps
 * to the record, and optional secondary details (attribute label to value) shown under the title.
 *
 * @param title the primary display text (typically the record's title attribute)
 * @param url the url that navigates to the record
 * @param details ordered secondary details (label to value), possibly empty
 */
public record GlobalSearchResult(String title, String url, Map<String, String> details) {

    /** Compact constructor: title and url are required; details is defended and never null. */
    public GlobalSearchResult {
        Objects.requireNonNull(title, "title");
        Objects.requireNonNull(url, "url");
        details = Collections.unmodifiableMap(new LinkedHashMap<>(Objects.requireNonNullElse(details, Map.of())));
    }

    /**
     * @param title the result title
     * @param url the result url
     * @return a result with no secondary details
     */
    public static GlobalSearchResult of(String title, String url) {
        return new GlobalSearchResult(title, url, Map.of());
    }
}
