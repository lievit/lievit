/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * The {@code download} effect ({@code $this.download}, issue #161, ADR-0044): an action returns a
 * file to the browser as a download instead of a page swap. The bytes ride the {@code Lievit-Effects}
 * header base64-encoded, with the file name + content type; the client decodes them into a Blob and
 * triggers a browser download, while the component still re-renders (the HTML body morphs as usual).
 * The protocol reserved this key (wire-protocol.md §5b); this is its realization.
 *
 * <p>For a large export prefer a redirect to a streaming endpoint; the base64 ride-along suits the
 * common gestionale case (a generated report / CSV under the snapshot budget). The name supports
 * RFC 5987 UTF-8 file names round-tripping (the client sets {@code <a download>} from {@link #name()}).
 *
 * @param name the download file name (what the browser saves it as; may be a UTF-8 name)
 * @param base64 the file content, base64-encoded (the bytes never ride as raw binary on the wire)
 * @param contentType the MIME content type the client stamps on the Blob
 */
public record DownloadEffect(String name, String base64, String contentType) {

    /**
     * @param name the file name (must be non-blank)
     * @param base64 the base64-encoded content (must be non-null)
     * @param contentType the content type (must be non-blank)
     */
    public DownloadEffect {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("a download needs a non-blank file name");
        }
        if (base64 == null) {
            throw new IllegalArgumentException("a download needs base64 content (may be empty, not null)");
        }
        if (contentType == null || contentType.isBlank()) {
            throw new IllegalArgumentException("a download needs a content type");
        }
    }

    /**
     * Builds a download effect from raw bytes, base64-encoding them.
     *
     * @param name the file name the browser saves it as
     * @param bytes the file content
     * @param contentType the MIME content type
     * @return the download effect
     */
    public static DownloadEffect of(String name, byte[] bytes, String contentType) {
        return new DownloadEffect(name, Base64.getEncoder().encodeToString(bytes), contentType);
    }

    /**
     * Builds a text download (UTF-8), the common report/CSV case.
     *
     * @param name the file name
     * @param text the text content (encoded UTF-8)
     * @param contentType the MIME content type (e.g. {@code "text/csv"})
     * @return the download effect
     */
    public static DownloadEffect ofText(String name, String text, String contentType) {
        return of(name, text.getBytes(StandardCharsets.UTF_8), contentType);
    }

    /**
     * @return the decoded content bytes (the inverse of {@link #of}); used by the test harness to
     *     assert over what was downloaded without the client
     */
    public byte[] decodedBytes() {
        return Base64.getDecoder().decode(base64);
    }
}
