/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.upload;

import java.util.Map;

/**
 * A presigned direct-to-object-storage upload descriptor (issue #191): the {@link DirectUploadProvider}
 * returns it, the client PUTs the bytes to {@link #url()} with {@link #method()} + {@link #headers()},
 * and on success the component records {@link #key()} as the durable reference. The bytes go straight
 * to object storage; the application never sees them (no proxy), which is the point of direct upload.
 *
 * @param url the presigned URL the browser PUTs the bytes to (single object, opaque, time-limited)
 * @param method the HTTP method to use (typically {@code PUT})
 * @param headers headers the client must send with the PUT (e.g. a bound {@code Content-Type});
 *     defensively copied, may be empty
 * @param key the object key the component records as the durable reference once the PUT succeeds
 */
public record DirectUpload(String url, String method, Map<String, String> headers, String key) {

    /**
     * @param url the presigned URL (must be non-blank)
     * @param method the HTTP method (must be non-blank)
     * @param headers the required PUT headers (defensively copied)
     * @param key the recorded object key (must be non-blank)
     */
    public DirectUpload {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("a direct upload needs a presigned URL");
        }
        if (method == null || method.isBlank()) {
            throw new IllegalArgumentException("a direct upload needs an HTTP method");
        }
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("a direct upload needs an object key");
        }
        headers = headers == null ? Map.of() : Map.copyOf(headers);
    }

    /**
     * A presigned PUT with no extra required headers.
     *
     * @param url the presigned URL
     * @param key the recorded object key
     * @return a {@code PUT} descriptor with no headers
     */
    public static DirectUpload put(String url, String key) {
        return new DirectUpload(url, "PUT", Map.of(), key);
    }
}
